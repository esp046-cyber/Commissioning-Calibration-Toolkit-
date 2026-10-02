import { createHash, timingSafeEqual } from 'node:crypto'

const digest = (s) => createHash('sha256').update(s).digest()

// AUTH_MODE=none (dev only) | apikey (X-API-Key must match one of API_KEYS)
export function auth(req, res, next) {
  req.user = { id: req.get('x-technician-id') || null }
  if ((process.env.AUTH_MODE || 'apikey') === 'none') return next()
  const keys = (process.env.API_KEYS || '').split(',').map((k) => k.trim()).filter(Boolean)
  const given = req.get('x-api-key')
  if (given && keys.some((k) => timingSafeEqual(digest(k), digest(given)))) return next()
  res.status(401).json({ error: 'Unauthorized' })
}
