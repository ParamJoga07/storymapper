// Email/password auth with scrypt hashing and stateless HMAC-signed tokens.
// Users live in Postgres when DATABASE_URL is set (production/Render),
// otherwise in data/users.json. The signing secret comes from AUTH_SECRET
// or persists in data/auth-secret for local development.
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { usePg, query } from './db.js'

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')
const SECRET_FILE = path.join(DATA_DIR, 'auth-secret')
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

mkdirSync(DATA_DIR, { recursive: true })

function getSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET
  if (!existsSync(SECRET_FILE)) writeFileSync(SECRET_FILE, randomBytes(32).toString('hex'))
  return readFileSync(SECRET_FILE, 'utf8').trim()
}
const SECRET = getSecret()

/* --------------------------- user storage --------------------------- */

function loadFileUsers() {
  try {
    return JSON.parse(readFileSync(USERS_FILE, 'utf8'))
  } catch {
    return []
  }
}

async function findUserByEmail(email) {
  if (usePg) {
    const r = await query('SELECT id, email, name, salt, pass_hash AS "passHash" FROM users WHERE email = $1', [email])
    return r.rows[0] || null
  }
  return loadFileUsers().find((u) => u.email === email) || null
}

async function findUserById(id) {
  if (usePg) {
    const r = await query('SELECT id, email, name FROM users WHERE id = $1', [id])
    return r.rows[0] || null
  }
  const u = loadFileUsers().find((u) => u.id === id)
  return u ? { id: u.id, email: u.email, name: u.name } : null
}

async function insertUser(user) {
  if (usePg) {
    await query(
      'INSERT INTO users (id, email, name, salt, pass_hash, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [user.id, user.email, user.name, user.salt, user.passHash, user.createdAt]
    )
    return
  }
  const users = loadFileUsers()
  users.push(user)
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
}

/* ------------------------------ tokens ------------------------------ */

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString('hex')
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64url')
}

export function signToken(userId) {
  const payload = b64url(JSON.stringify({ uid: userId, exp: Date.now() + TOKEN_TTL_MS }))
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyToken(token) {
  const [payload, sig] = (token || '').split('.')
  if (!payload || !sig) return null
  const expected = createHmac('sha256', SECRET).update(payload).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (data.exp < Date.now()) return null
    return data.uid
  } catch {
    return null
  }
}

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name }
}

/* ------------------------------- API -------------------------------- */

export async function register({ email, password, name }) {
  email = String(email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw Object.assign(new Error('Enter a valid email address'), { status: 400 })
  if (!password || password.length < 6)
    throw Object.assign(new Error('Password must be at least 6 characters'), { status: 400 })
  if (await findUserByEmail(email))
    throw Object.assign(new Error('An account with this email already exists'), { status: 409 })
  const salt = randomBytes(16).toString('hex')
  const user = {
    id: randomUUID(),
    email,
    name: (name || '').trim() || email.split('@')[0],
    salt,
    passHash: hashPassword(password, salt),
    createdAt: new Date().toISOString(),
  }
  await insertUser(user)
  return { token: signToken(user.id), user: publicUser(user) }
}

export async function login({ email, password }) {
  email = String(email || '').trim().toLowerCase()
  const user = await findUserByEmail(email)
  const bad = Object.assign(new Error('Invalid email or password'), { status: 401 })
  if (!user) throw bad
  const hash = hashPassword(password || '', user.salt)
  const a = Buffer.from(hash)
  const b = Buffer.from(user.passHash)
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw bad
  return { token: signToken(user.id), user: publicUser(user) }
}

export async function getUser(userId) {
  return findUserById(userId)
}

// Express middleware: reads Bearer token, sets req.userId or 401s.
export function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const uid = verifyToken(token)
  if (!uid) return res.status(401).json({ error: 'Please sign in to continue' })
  req.userId = uid
  next()
}
