/* global self */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkOnly } from 'workbox-strategies'
import { BackgroundSyncPlugin } from 'workbox-background-sync'

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true })
  clients.forEach((c) => c.postMessage(message))
}

// Replays queued POSTs when connectivity returns, then tells the app which logs landed.
const avevaSync = new BackgroundSyncPlugin('aveva-sync-queue', {
  maxRetentionTime: 7 * 24 * 60, // minutes: keep queued logs for a week
  onSync: async ({ queue }) => {
    let entry
    while ((entry = await queue.shiftRequest())) {
      try {
        const res = await fetch(entry.request.clone())
        if (!res.ok) throw new Error(`Sync failed: ${res.status}`)
        await notifyClients({ type: 'LOG_SYNCED', id: entry.request.headers.get('X-Log-Id') })
      } catch (err) {
        await queue.unshiftRequest(entry)
        throw err // tells the browser to retry later
      }
    }
  },
})

registerRoute(
  ({ url }) => url.pathname === '/api/aveva/sync',
  new NetworkOnly({ plugins: [avevaSync] }),
  'POST',
)

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
