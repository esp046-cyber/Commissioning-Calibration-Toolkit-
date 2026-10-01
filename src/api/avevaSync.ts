import { db, type CalibrationLog } from '../db'

// The service worker intercepts POSTs to this path and queues them when offline.
export const SYNC_URL = import.meta.env.VITE_AVEVA_SYNC_URL ?? '/api/aveva/sync'

export async function syncLog(log: CalibrationLog): Promise<void> {
  try {
    const res = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Log-Id': String(log.id) },
      body: JSON.stringify(log),
    })
    if (res.ok) await db.logs.update(log.id!, { status: 'synced' })
  } catch {
    // Offline: the service worker has queued the request (aveva-sync-queue).
    // The log stays 'pending' until the worker reports a successful replay.
  }
}

// Fallback for when no service worker controls the page (e.g. first load, dev server).
export async function retryPending(): Promise<void> {
  const pending = await db.logs.where('status').equals('pending').toArray()
  for (const log of pending) await syncLog(log)
}
