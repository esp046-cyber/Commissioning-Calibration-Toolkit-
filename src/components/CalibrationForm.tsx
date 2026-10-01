import { useState } from 'react'
import { Save } from 'lucide-react'
import { db, type InstrumentType } from '../db'
import { syncLog } from '../api/avevaSync'

const TYPES: InstrumentType[] = ['Flow', 'Pressure', 'Level']
const DEFAULT_UNIT: Record<InstrumentType, string> = { Flow: 'L/s', Pressure: 'bar', Level: 'm' }
const UNITS: Record<InstrumentType, string[]> = {
  Flow: ['L/s', 'm³/h'],
  Pressure: ['bar', 'PSI'],
  Level: ['m', '%'],
}

const field = 'w-full rounded border-2 border-[var(--ink)]/30 bg-white px-3 py-3 text-base'

export default function CalibrationForm() {
  const [assetTag, setAssetTag] = useState('')
  const [type, setType] = useState<InstrumentType>('Flow')
  const [technician, setTechnician] = useState(() => localStorage.getItem('technician') ?? '')
  const [mA, setMA] = useState('')
  const [low, setLow] = useState('0')
  const [high, setHigh] = useState('100')
  const [unit, setUnit] = useState(DEFAULT_UNIT.Flow)
  const [saved, setSaved] = useState('')

  const raw = parseFloat(mA)
  const valid = !Number.isNaN(raw)
  const span = parseFloat(high) - parseFloat(low)
  const fraction = valid ? (raw - 4) / 16 : 0
  const scaled = valid ? parseFloat(low) + fraction * span : NaN
  const outOfRange = valid && (raw < 4 || raw > 20)
  const canSave = assetTag.trim() && technician.trim() && valid && !Number.isNaN(scaled)

  async function save(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!canSave) return
    localStorage.setItem('technician', technician)
    const log = {
      assetTag: assetTag.trim().toUpperCase(),
      instrumentType: type,
      rawmA: raw,
      scaledValue: Math.round(scaled * 1000) / 1000,
      unit,
      rangeLow: parseFloat(low),
      rangeHigh: parseFloat(high),
      technician: technician.trim(),
      status: 'pending' as const, // becomes 'synced' only after the API confirms
      timestamp: new Date().toISOString(),
    }
    const id = await db.logs.add(log)
    setSaved(`${log.assetTag} saved${navigator.onLine ? '' : ' offline'}.`)
    setAssetTag('')
    setMA('')
    syncLog({ ...log, id }) // offline, the service worker queues this request
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <label className="block">
        <span className="mb-1 block font-semibold">Asset tag</span>
        <input className={field} value={assetTag} onChange={(e) => setAssetTag(e.target.value)} placeholder="FIT-101" autoCapitalize="characters" />
      </label>

      <fieldset>
        <legend className="mb-1 font-semibold">Instrument type</legend>
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map((t) => (
            <button
              type="button"
              key={t}
              aria-pressed={type === t}
              onClick={() => { setType(t); setUnit(DEFAULT_UNIT[t]) }}
              className={`rounded border-2 border-[var(--ink)] py-3 font-semibold ${type === t ? 'bg-[var(--ink)] text-white' : 'bg-white'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="mb-1 block font-semibold">Range low</span>
          <input className={field} inputMode="decimal" value={low} onChange={(e) => setLow(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block font-semibold">Range high</span>
          <input className={field} inputMode="decimal" value={high} onChange={(e) => setHigh(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block font-semibold">Unit</span>
          <select className={field} value={unit} onChange={(e) => setUnit(e.target.value)}>
            {UNITS[type].map((u) => <option key={u}>{u}</option>)}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block font-semibold">Loop current (mA)</span>
        <input className={field} inputMode="decimal" value={mA} onChange={(e) => setMA(e.target.value)} placeholder="12.00" />
      </label>

      {/* The loop span: 4 mA at the left edge, 20 mA at the right */}
      <div aria-live="polite">
        <div className="relative h-6 overflow-hidden rounded bg-[var(--ink)]/15">
          <div
            className="h-full bg-[var(--loop)] transition-[width]"
            style={{ width: `${Math.min(Math.max(fraction, 0), 1) * 100}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-sm">
          <span>4 mA</span>
          <span className="text-xl font-bold">
            {valid && !Number.isNaN(scaled) ? `${scaled.toFixed(2)} ${unit}` : `Enter a reading`}
          </span>
          <span>20 mA</span>
        </div>
        {outOfRange && (
          <p className="mt-1 font-semibold text-amber-800">Reading is outside 4–20 mA. Check for a loop fault before saving.</p>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block font-semibold">Technician</span>
        <input className={field} value={technician} onChange={(e) => setTechnician(e.target.value)} />
      </label>

      <button
        type="submit"
        disabled={!canSave}
        className="flex w-full items-center justify-center gap-2 rounded bg-[var(--ink)] py-4 text-lg font-bold text-white disabled:opacity-40"
      >
        <Save size={20} /> Save log
      </button>
      {saved && <p role="status" className="font-semibold text-[var(--ok)]">{saved}</p>}
    </form>
  )
}
