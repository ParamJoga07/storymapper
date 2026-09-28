// Postgres support for production (Render). When DATABASE_URL is set the app
// stores users and projects in Postgres; otherwise it falls back to the local
// file store so development needs no database.
import pg from 'pg'

export const usePg = !!process.env.DATABASE_URL

let pool = null

export function getPool() {
  if (!usePg) throw new Error('DATABASE_URL is not configured')
  if (!pool) {
    const needSsl =
      /render\.com|amazonaws\.com|neon\.tech|supabase\.co/.test(process.env.DATABASE_URL) ||
      process.env.PGSSL === '1'
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: needSsl ? { rejectUnauthorized: false } : undefined,
      max: 5,
    })
  }
  return pool
}

export async function query(text, params) {
  return getPool().query(text, params)
}

export async function initDb() {
  if (!usePg) return
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id         uuid PRIMARY KEY,
      email      text UNIQUE NOT NULL,
      name       text NOT NULL,
      salt       text NOT NULL,
      pass_hash  text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS projects (
      id         uuid PRIMARY KEY,
      user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name       text NOT NULL,
      prd_text   text,
      analysis   jsonb,
      story_map  jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `)
  await query(`CREATE INDEX IF NOT EXISTS projects_user_idx ON projects (user_id, updated_at DESC);`)
  console.log('Postgres ready (users, projects)')
}
