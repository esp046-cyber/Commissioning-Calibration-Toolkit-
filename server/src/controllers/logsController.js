import { createHash } from 'node:crypto'
import { pool } from '../db.js'
import { processQueue } from './scadaController.js'

const TYPES = new Set(['Flow', 'Pressure', 'Level'])
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const isStr = (v, max = 64) => typeof v === 'string' && v.trim() !== '' && v.length <= max

export function validate(l) {
  if (!l || typeof l !== 'object') return 'not an object'
  if (!isStr(l.assetTag)) return 'assetTag'
  if (!TYPES.has(l.instrumentType)) return 'instrumentType'
  for (const k of ['rawmA', 'scaledValue', 'rangeLow', 'rangeHigh']) if (!isNum(l[k])) return k
  if (l.rawmA < 0 || l.rawmA > 30) return 'rawmA out of range'
  if (!isStr(l.unit, 16)) return 'unit'
  if (!isStr(l.technician, 128)) return 'technician'
  if (Number.isNaN(Date.parse(l.timestamp))) return 'timestamp'
  return null
}

const keyFor = (l, deviceId) =>
  typeof l.clientId === 'string'
    ? l.clientId
    : createHash('sha256').update([deviceId, l.assetTag, l.timestamp, l.rawmA, l.technician].join('|')).digest('hex')

// Accepts one log, an array, or { logs: [...] }. Used by POST /api/logs/sync and the
// PWA's existing /api/aveva/sync route.
export async function syncLogs(req, res, next) {
  const body = req.body
  const items = Array.isArray(body) ? body : Array.isArray(body?.logs) ? body.logs : [body]
  if (items.length < 1 || items.length > 500) return res.status(400).json({ error: 'Send 1-500 logs' })
  const deviceId = String(req.get('x-device-id') || body?.deviceId || 'unknown').slice(0, 128)

  const results = []
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const l of items) {
      const bad = validate(l)
      if (bad) { results.push({ clientId: l?.id ?? null, status: 'rejected', reason: bad }); continue }
      const syncedBy = String(req.user?.id || l.technician).slice(0, 128)
      const { rows } = await client.query(
        `INSERT INTO calibration_logs (idempotency_key, asset_tag, instrument_type, raw_ma, scaled_value,
           unit, range_low, range_high, technician_name, device_id, created_at, synced_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
        [keyFor(l, deviceId), l.assetTag.trim().toUpperCase(), l.instrumentType, l.rawmA, l.scaledValue,
         l.unit, l.rangeLow, l.rangeHigh, l.technician.trim(), deviceId, l.timestamp, syncedBy],
      )
      if (!rows.length) { results.push({ clientId: l.id ?? null, status: 'duplicate' }); continue }
      await client.query(
        `INSERT INTO audit_events (log_id, event, actor, detail) VALUES ($1,'received',$2,$3)`,
        [rows[0].id, syncedBy, JSON.stringify({ deviceId })],
      )
      results.push({ clientId: l.id ?? null, status: 'accepted', id: rows[0].id })
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    return next(err)
  } finally {
    client.release()
  }

  // The log is durable in Postgres at this point, so the PWA can mark it synced.
  // Forwarding to SCADA happens from the outbox, so a SCADA outage never loses data.
  if (results.some((r) => r.status === 'accepted')) setImmediate(() => processQueue().catch(console.error))
  // All-rejected batches get 422 so clients don't treat them as stored.
  res.status(results.some((r) => r.status !== 'rejected') ? 200 : 422).json({ results })
}
