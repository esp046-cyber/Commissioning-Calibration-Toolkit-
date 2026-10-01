import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CloudOff, RefreshCw, Wifi } from 'lucide-react'
import { db } from '../db'

export default function SyncStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  const pending = useLiveQuery(() => db.logs.where('status').equals('pending').count(), [], 0)

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  return (
    <p role="status" className="mt-1 flex flex-wrap items-center gap-3 text-sm">
      <span className="flex items-center gap-1.5 font-semibold">
        {online ? <Wifi size={16} /> : <CloudOff size={16} />}
        {online ? 'Online' : 'Offline. Logs save on this device.'}
      </span>
      <span className="flex items-center gap-1.5 rounded bg-white/15 px-2 py-0.5">
        <RefreshCw size={14} />
        {pending === 0 ? 'All logs synced' : `${pending} calibration ${pending === 1 ? 'log' : 'logs'} pending sync`}
      </span>
    </p>
  )
}
