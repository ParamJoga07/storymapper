// Project store: Postgres when DATABASE_URL is set (production/Render),
// otherwise one JSON file per project under data/projects.
// Every project belongs to a user; all reads/writes are scoped to that user.
import { mkdir, readdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { usePg, query } from './db.js'

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'projects')

const notFound = () => Object.assign(new Error('Project not found'), { status: 404 })

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true })
}

function fileFor(id) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw Object.assign(new Error('Invalid project id'), { status: 400 })
  return path.join(DATA_DIR, `${id}.json`)
}

export async function listProjects(userId) {
  if (usePg) {
    const r = await query(
      'SELECT id, name, created_at AS "createdAt", updated_at AS "updatedAt" FROM projects WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    )
    return r.rows
  }
  await ensureDir()
  const files = await readdir(DATA_DIR)
  const projects = []
  for (const f of files) {
    if (!f.endsWith('.json')) continue
    try {
      const p = JSON.parse(await readFile(path.join(DATA_DIR, f), 'utf8'))
      if (p.userId !== userId) continue
      projects.push({ id: p.id, name: p.name, updatedAt: p.updatedAt, createdAt: p.createdAt })
    } catch {
      // skip corrupt files
    }
  }
  projects.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  return projects
}

export async function getProject(id, userId) {
  if (usePg) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw Object.assign(new Error('Invalid project id'), { status: 400 })
    const r = await query(
      `SELECT id, user_id AS "userId", name, prd_text AS "prdText", analysis, story_map AS "storyMap",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM projects WHERE id = $1 AND user_id = $2`,
      [id, userId]
    )
    if (!r.rows[0]) throw notFound()
    return r.rows[0]
  }
  await ensureDir()
  let p
  try {
    p = JSON.parse(await readFile(fileFor(id), 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') throw notFound()
    throw err
  }
  if (p.userId !== userId) throw notFound()
  return p
}

export async function saveProject({ id, name, prdText, analysis, storyMap }, userId) {
  const now = new Date().toISOString()
  const displayName = name || 'Untitled project'

  if (usePg) {
    let pid = id
    if (pid) {
      const r = await query(
        `UPDATE projects SET name = $1, prd_text = $2, analysis = $3, story_map = $4, updated_at = $5
         WHERE id = $6 AND user_id = $7
         RETURNING id, created_at AS "createdAt"`,
        [displayName, prdText || '', analysis || null, storyMap || null, now, pid, userId]
      )
      if (r.rows[0]) {
        return { id: pid, userId, name: displayName, prdText, analysis, storyMap, createdAt: r.rows[0].createdAt, updatedAt: now }
      }
    }
    pid = pid || randomUUID()
    await query(
      `INSERT INTO projects (id, user_id, name, prd_text, analysis, story_map, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [pid, userId, displayName, prdText || '', analysis || null, storyMap || null, now]
    )
    return { id: pid, userId, name: displayName, prdText, analysis, storyMap, createdAt: now, updatedAt: now }
  }

  await ensureDir()
  let createdAt = now
  let pid = id
  if (pid) {
    try {
      createdAt = (await getProject(pid, userId)).createdAt || now
    } catch {
      // new id supplied by client; treat as create
    }
  } else {
    pid = randomUUID()
  }
  const project = { id: pid, userId, name: displayName, prdText, analysis, storyMap, createdAt, updatedAt: now }
  await writeFile(fileFor(pid), JSON.stringify(project, null, 2))
  return project
}

export async function deleteProject(id, userId) {
  if (usePg) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw Object.assign(new Error('Invalid project id'), { status: 400 })
    const r = await query('DELETE FROM projects WHERE id = $1 AND user_id = $2', [id, userId])
    if (r.rowCount === 0) throw notFound()
    return
  }
  await getProject(id, userId) // ownership check
  await unlink(fileFor(id))
}
