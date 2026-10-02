import express from 'express'
import helmet from 'helmet'
import { pool } from './db.js'
import logsRouter from './routes/logs.js'
import { startScadaWorker } from './controllers/scadaController.js'

const app = express()
app.disable('x-powered-by')
app.use(helmet())
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true }) } catch { res.status(503).json({ ok: false }) }
})
app.use('/api', logsRouter)
app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(err.type === 'entity.parse.failed' ? 400 : 500).json({ error: err.type === 'entity.parse.failed' ? 'Invalid JSON' : 'Internal error' })
})

const server = app.listen(process.env.PORT || 3000, () => console.log('API listening'))
startScadaWorker()
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => pool.end().then(() => process.exit(0))))
