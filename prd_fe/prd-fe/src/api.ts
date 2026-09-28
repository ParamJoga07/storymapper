import type {
  Analysis,
  ExportResult,
  IntegrationTool,
  Project,
  ProjectSummary,
  Settings,
  Story,
  StoryMap,
  User,
} from './types'

const SETTINGS_KEY = 'prd-tool-settings'
const TOKEN_KEY = 'prd-tool-token'

/* ------------------------------ settings ------------------------------ */

const DEFAULT_SETTINGS: Settings = {
  provider: 'auto',
  groqKey: '',
  geminiKey: '',
  openaiKey: '',
  anthropicKey: '',
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    // ignore storage failures (private mode etc.)
  }
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    // ignore
  }
}

/* ------------------------------- token -------------------------------- */

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
}

/* ------------------------------ transport ------------------------------ */

function headers(json = true): Record<string, string> {
  const h: Record<string, string> = {}
  if (json) h['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) h.Authorization = `Bearer ${token}`
  const s = loadSettings()
  if (s.groqKey) h['x-groq-key'] = s.groqKey
  if (s.geminiKey) h['x-gemini-key'] = s.geminiKey
  if (s.openaiKey) h['x-openai-key'] = s.openaiKey
  if (s.anthropicKey) h['x-anthropic-key'] = s.anthropicKey
  return h
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init)
  const body = await res.json().catch(() => ({}))
  if (res.status === 401 && !path.startsWith('/auth/')) {
    setToken(null)
    window.dispatchEvent(new CustomEvent('auth:expired'))
  }
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`)
  return body as T
}

/* -------------------------------- auth -------------------------------- */

export async function authRegister(email: string, password: string, name: string) {
  const r = await request<{ token: string; user: User }>('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  })
  setToken(r.token)
  return r.user
}

export async function authLogin(email: string, password: string) {
  const r = await request<{ token: string; user: User }>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  setToken(r.token)
  return r.user
}

export async function authMe(): Promise<User | null> {
  if (!getToken()) return null
  try {
    const r = await request<{ user: User }>('/auth/me', { headers: headers(false) })
    return r.user
  } catch {
    return null
  }
}

export function logout() {
  setToken(null)
}

/* ----------------------------- AI pipeline ----------------------------- */

export function getProviders() {
  return request<{ providers: string[] }>('/providers', { headers: headers(false) })
}

export async function extractFile(file: File) {
  const form = new FormData()
  form.append('file', file)
  return request<{ text: string; filename: string }>('/extract', {
    method: 'POST',
    headers: headers(false),
    body: form,
  })
}

export function analyzePrd(prdText: string) {
  const s = loadSettings()
  return request<{ analysis: Analysis; provider: string }>('/analyze', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ prdText, provider: s.provider }),
  })
}

export function buildStoryMap(prdText: string, analysis: Analysis) {
  const s = loadSettings()
  return request<{ storyMap: StoryMap; provider: string }>('/storymap', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ prdText, analysis, provider: s.provider }),
  })
}

export function refineStory(story: Story, action: 'rewrite' | 'acceptance' | 'split', context: string) {
  const s = loadSettings()
  return request<{ result: Partial<Story> & { stories?: Story[] }; provider: string }>('/refine', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ story, action, context, provider: s.provider }),
  })
}

/* ------------------------------ projects ------------------------------- */

export function listProjects() {
  return request<{ projects: ProjectSummary[] }>('/projects', { headers: headers(false) })
}

export function getProject(id: string) {
  return request<Project>(`/projects/${id}`, { headers: headers(false) })
}

export function saveProject(p: {
  id?: string
  name: string
  prdText: string
  analysis: Analysis | null
  storyMap: StoryMap | null
}) {
  return request<Project>('/projects', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(p),
  })
}

export function deleteProject(id: string) {
  return request<{ ok: true }>(`/projects/${id}`, { method: 'DELETE', headers: headers(false) })
}

/* ---------------------------- integrations ----------------------------- */

export function testIntegration(tool: IntegrationTool, config: Record<string, string>) {
  return request<{ ok: boolean; message: string }>(`/integrations/${tool}/test`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ config }),
  })
}

export function exportToTool(
  tool: IntegrationTool,
  config: Record<string, string>,
  storyMap: StoryMap,
  releaseFilter: 'all' | 'mvp' | 'later'
) {
  return request<ExportResult>(`/integrations/${tool}/export`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ config, storyMap, releaseFilter }),
  })
}

const INTEG_KEY = 'prd-tool-integrations'

export function loadIntegrationConfig(tool: IntegrationTool): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(INTEG_KEY) || '{}')[tool] || {}
  } catch {
    return {}
  }
}

export function saveIntegrationConfig(tool: IntegrationTool, config: Record<string, string>) {
  try {
    const all = JSON.parse(localStorage.getItem(INTEG_KEY) || '{}')
    all[tool] = config
    localStorage.setItem(INTEG_KEY, JSON.stringify(all))
  } catch {
    // ignore
  }
}
