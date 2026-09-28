import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import { initDb, usePg } from './src/db.js'
import { resolveKeys, availableProviders } from './src/providers.js'
import { analyzePrd, buildStoryMap, refineStory } from './src/pipeline.js'
import { listProjects, getProject, saveProject, deleteProject } from './src/store.js'
import { register, login, getUser, requireAuth } from './src/auth.js'
import { INTEGRATIONS } from './src/integrations.js'

const app = express()
const PORT = process.env.PORT || 3001
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } })

app.use(cors())
app.use(express.json({ limit: '10mb' }))

const wrap = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error(err)
    res.status(err.status || 500).json({ error: err.message || 'Internal error' })
  })

/* ------------------------------- auth ------------------------------- */
app.post('/api/auth/register', wrap(async (req, res) => res.json(await register(req.body))))
app.post('/api/auth/login', wrap(async (req, res) => res.json(await login(req.body))))
app.get('/api/auth/me', requireAuth, wrap(async (req, res) => {
  const user = await getUser(req.userId)
  if (!user) return res.status(401).json({ error: 'Please sign in to continue' })
  res.json({ user })
}))

/* ----------------------------- providers ---------------------------- */
// Which providers have keys (env or headers) — the UI uses this for status dots.
app.get('/api/providers', (req, res) => {
  res.json({ providers: availableProviders(resolveKeys(req)) })
})

/* --------------------------- AI pipeline ---------------------------- */
// Extract text from an uploaded PRD file (.pdf, .txt, .md).
app.post('/api/extract', requireAuth, upload.single('file'), wrap(async (req, res) => {
  if (!req.file) throw Object.assign(new Error('No file uploaded'), { status: 400 })
  const name = req.file.originalname.toLowerCase()
  let text
  if (name.endsWith('.pdf')) {
    text = (await pdfParse(req.file.buffer)).text
  } else {
    text = req.file.buffer.toString('utf8')
  }
  res.json({ text: text.trim(), filename: req.file.originalname })
}))

// Stage 1: personas, goals, user flows, requirements, open questions.
app.post('/api/analyze', requireAuth, wrap(async (req, res) => {
  const { prdText, provider } = req.body
  res.json(await analyzePrd({ keys: resolveKeys(req), provider, prdText }))
}))

// Stage 2: activities -> steps -> stories with releases and requirements.
app.post('/api/storymap', requireAuth, wrap(async (req, res) => {
  const { prdText, provider, analysis } = req.body
  if (!analysis) throw Object.assign(new Error('analysis is required'), { status: 400 })
  res.json(await buildStoryMap({ keys: resolveKeys(req), provider, prdText, analysis }))
}))

// Per-story AI assist: rewrite, acceptance criteria, split.
app.post('/api/refine', requireAuth, wrap(async (req, res) => {
  const { story, action, context, provider } = req.body
  res.json(await refineStory({ keys: resolveKeys(req), provider, story, action, context }))
}))

/* ----------------------------- projects ----------------------------- */
app.get('/api/projects', requireAuth, wrap(async (req, res) =>
  res.json({ projects: await listProjects(req.userId) })
))
app.get('/api/projects/:id', requireAuth, wrap(async (req, res) =>
  res.json(await getProject(req.params.id, req.userId))
))
app.post('/api/projects', requireAuth, wrap(async (req, res) =>
  res.json(await saveProject(req.body, req.userId))
))
app.delete('/api/projects/:id', requireAuth, wrap(async (req, res) => {
  await deleteProject(req.params.id, req.userId)
  res.json({ ok: true })
}))

/* --------------------------- integrations --------------------------- */
// Credentials come in the request body and are never persisted server-side.
app.post('/api/integrations/:tool/test', requireAuth, wrap(async (req, res) => {
  const integration = INTEGRATIONS[req.params.tool]
  if (!integration) throw Object.assign(new Error('Unknown integration'), { status: 404 })
  res.json(await integration.test(req.body.config || {}))
}))

app.post('/api/integrations/:tool/export', requireAuth, wrap(async (req, res) => {
  const integration = INTEGRATIONS[req.params.tool]
  if (!integration) throw Object.assign(new Error('Unknown integration'), { status: 404 })
  const { config, storyMap, releaseFilter = 'all' } = req.body
  if (!storyMap?.activities?.length) throw Object.assign(new Error('Story map is empty'), { status: 400 })
  res.json(await integration.export(config || {}, storyMap, releaseFilter))
}))

/* ---------------------- static frontend (production) ---------------------- */
// On Render the frontend is built into prd_fe/prd-fe/dist and served here,
// so one web service hosts both the API and the app.
const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'prd_fe', 'prd-fe', 'dist')
if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')))
  console.log('Serving frontend from', distDir)
}

await initDb()

app.listen(PORT, () => {
  console.log(`StoryMapper backend listening on http://localhost:${PORT}`)
  console.log(`Storage: ${usePg ? 'Postgres (DATABASE_URL)' : 'local files (data/)'}`)
  const env = availableProviders({
    groq: process.env.GROQ_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
  })
  console.log(env.length ? `Providers configured via .env: ${env.join(', ')}` : 'No .env API keys — add keys in the UI Settings or in .env')
})
