import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

export default function LogViewer() {
  const logs = useLiveQuery(() => db.logs.orderBy('timestamp').reverse().toArray(), [])

  return (
    <section className="mt-8">
      <h2 className="mb-2 text-lg font-bold">Saved logs</h2>
      {!logs?.length ? (
        <p>No logs yet. Save a calibration reading above and it will appear here.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse bg-white text-left text-sm">
            <thead>
              <tr className="border-b-2 border-[var(--ink)]">
                <th className="p-2">Tag</th>
                <th className="p-2">Type</th>
                <th className="p-2">mA</th>
                <th className="p-2">Value</th>
                <th className="p-2">Technician</th>
                <th className="p-2">Time</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-[var(--ink)]/15">
                  <td className="p-2 font-semibold">{l.assetTag}</td>
                  <td className="p-2">{l.instrumentType}</td>
                  <td className="p-2">{l.rawmA.toFixed(2)}</td>
                  <td className="p-2">{l.scaledValue} {l.unit}</td>
                  <td className="p-2">{l.technician}</td>
                  <td className="p-2">{new Date(l.timestamp).toLocaleString()}</td>
                  <td className={`p-2 font-semibold ${l.status === 'synced' ? 'text-[var(--ok)]' : 'text-amber-800'}`}>
                    {l.status === 'synced' ? 'Synced' : 'Pending'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
