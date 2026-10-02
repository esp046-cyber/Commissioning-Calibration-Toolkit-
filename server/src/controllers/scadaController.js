import { pool } from '../db.js'

const cfg = () => ({
  url: process.env.SCADA_URL,
  timeout: Number(process.env.SCADA_TIMEOUT_MS || 10000),
  maxAttempts: Number(process.env.SCADA_MAX_ATTEMPTS || 12),
  template: process.env.SCADA_TAG_TEMPLATE || '{asset}.Calibration.{point}',
})
const GOOD_QUALITY = 192 // OPC "Good" as used by Wonderware/AVEVA historians

// Maps a calibration row to a tag/value/quality/timestamp message.
// ASSUMPTION: adjust this shape to whatever your AVEVA/GeoSCADA gateway accepts
// (e.g. an AVEVA Insight/Historian REST bridge or an OPC UA/MQTT gateway).
export function mapToAveva(row, template = cfg().template) {
  const ts = new Date(row.created_at).toISOString()
  const tag = (point) => template.replace('{asset}', row.asset_tag).replace('{point}', point)
  const point = (name, value) => ({ tagName: tag(name), value: Number(value), quality: GOOD_QUALITY, timestamp: ts })
  return {
    messageId: row.id, // lets the receiver de-duplicate retries
    source: 'calibration-pwa',
    deviceId: row.device_id,
    points: [
      point('RawmA', row.raw_ma),
      point('ScaledValue', row.scaled_value),
      point('RangeLow', row.range_low),
      point('RangeHigh', row.range_high),
    ],
    context: { assetTag: row.asset_tag, instrumentType: row.instrument_type, unit: row.unit, technician: row.technician_name },
  }
}

async function push(payload) {
  const { url, timeout } = cfg()
  const headers = { 'Content-Type': 'application/json' }
  if (process.env.SCADA_AUTH_HEADER) headers.Authorization = process.env.SCADA_AUTH_HEADER
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(timeout) })
  if (res.ok) return
  const err = new Error(`SCADA ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`)
  err.retryable = res.status >= 500 || [408, 429].includes(res.status) // other 4xx = bad data, don't retry
  throw err
}

const backoffSeconds = (attempts) => Math.min(30 * 2 ** attempts, 3600) * (0.75 + Math.random() * 0.5)

let running = false

// Claims due rows, sends them, records the outcome. Safe to call concurrently.
export async function processQueue() {
  const { url, maxAttempts } = cfg()
  if (!url || running) return
  running = true
  try {
    const { rows } = await pool.query(
      `UPDATE calibration_logs SET scada_next_attempt_at = now() + interval '2 minutes'  -- short lease
       WHERE id IN (SELECT id FROM calibration_logs WHERE scada_status = 'pending' AND scada_next_attempt_at <= now()
                    ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED)
       RETURNING *`,
    )
    for (const row of rows) {
      try {
        await push(mapToAveva(row))
        await pool.query(`UPDATE calibration_logs SET scada_status='sent', scada_sent_at=now(), scada_attempts=scada_attempts+1, scada_last_error=NULL WHERE id=$1`, [row.id])
        await pool.query(`INSERT INTO audit_events (log_id, event, actor) VALUES ($1,'scada_sent','system')`, [row.id])
      } catch (err) {
        const attempts = row.scada_attempts + 1
        const retryable = err.retryable !== false // network errors and timeouts are retryable
        const dead = !retryable || attempts >= maxAttempts
        await pool.query(
          `UPDATE calibration_logs SET scada_status=$2, scada_attempts=$3, scada_last_error=$4,
             scada_next_attempt_at = now() + make_interval(secs => $5) WHERE id=$1`,
          [row.id, dead ? 'failed' : 'pending', attempts, String(err.message).slice(0, 500), backoffSeconds(attempts)],
        )
        if (dead) await pool.query(`INSERT INTO audit_events (log_id, event, actor, detail) VALUES ($1,'scada_failed','system',$2)`, [row.id, JSON.stringify({ error: err.message })])
        if (retryable) break // server looks down: stop this pass, the rest wait for their lease
      }
    }
  } finally {
    running = false
  }
}

export function startScadaWorker() {
  if (!cfg().url) return console.warn('SCADA_URL not set: logs stay in the outbox as "pending".')
  setInterval(() => processQueue().catch((e) => console.error('SCADA worker:', e.message)), Number(process.env.SCADA_POLL_MS || 15000))
}
