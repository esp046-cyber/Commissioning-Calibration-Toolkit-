import { Router } from 'express'
import { auth } from '../middleware/auth.js'
import { syncLogs } from '../controllers/logsController.js'

const router = Router()
// /aveva/sync is the path the PWA's service worker already queues, so no frontend change is needed.
router.post(['/logs/sync', '/aveva/sync'], auth, syncLogs)
export default router
