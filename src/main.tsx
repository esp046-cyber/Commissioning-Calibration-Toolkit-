import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Workbox } from 'workbox-window'
import './index.css'
import App from './App'
import { db } from './db'
import { retryPending } from './api/avevaSync'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const wb = new Workbox('/sw.js')
  wb.register()
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'LOG_SYNCED') db.logs.update(Number(e.data.id), { status: 'synced' })
  })
}

// Without a controlling service worker nothing queues requests, so retry directly.
window.addEventListener('online', () => {
  if (!navigator.serviceWorker?.controller) retryPending()
})
