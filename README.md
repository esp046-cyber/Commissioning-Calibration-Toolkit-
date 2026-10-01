# Offline-First Commissioning & Calibration Toolkit

PWA for logging instrument calibrations (4-20 mA loops) with no network, then syncing to an
AVEVA System Platform / GeoSCADA REST API when coverage returns.

- React + Vite + TypeScript, Tailwind CSS
- Dexie (IndexedDB) stores logs in `CalibrationDB.logs`
- Workbox `BackgroundSyncPlugin` queue `aveva-sync-queue` replays `POST /api/aveva/sync`

## Run
    npm install
    npm run build && npm run preview   # service worker only registers in production builds

Set `VITE_AVEVA_SYNC_URL` to point at your gateway. Serve the PWA and the sync endpoint
from the same origin (or a reverse proxy), over HTTPS, so the service worker can intercept the POST.
