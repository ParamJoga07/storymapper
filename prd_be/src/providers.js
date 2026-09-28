// LLM provider layer: free-tier Groq and Gemini with automatic fallback.
// Keys come from .env or from per-request headers (x-groq-key / x-gemini-key)
// so users can paste keys in the UI without touching the server.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'

const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'

export const PROVIDER_ORDER = ['groq', 'gemini', 'openai', 'anthropic']

export function resolveKeys(req) {
  return {
    groq: req.headers['x-groq-key'] || process.env.GROQ_API_KEY || '',
    gemini: req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY || '',
    openai: req.headers['x-openai-key'] || process.env.OPENAI_API_KEY || '',
    anthropic: req.headers['x-anthropic-key'] || process.env.ANTHROPIC_API_KEY || '',
  }
}

export function availableProviders(keys) {
  return PROVIDER_ORDER.filter((p) => keys[p])
}

async function callGroq(key, system, user, { temperature = 0.3, maxTokens = 8000 } = {}) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Groq ${res.status}: ${body.slice(0, 400)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

async function callGemini(key, system, user, { temperature = 0.3, maxTokens = 8192 } = {}) {
  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
      },
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 400)}`)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || ''
}

async function callOpenAI(key, system, user, { temperature = 0.3, maxTokens = 8000 } = {}) {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 400)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

async function callAnthropic(key, system, user, { temperature = 0.3, maxTokens = 8000 } = {}) {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      temperature,
      system: `${system}\nRespond with a single valid JSON object and nothing else.`,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 400)}`)
  }
  const data = await res.json()
  return (data.content || []).map((b) => b.text || '').join('')
}

const CALLERS = {
  groq: (keys, s, u, o) => callGroq(keys.groq, s, u, o),
  gemini: (keys, s, u, o) => callGemini(keys.gemini, s, u, o),
  openai: (keys, s, u, o) => callOpenAI(keys.openai, s, u, o),
  anthropic: (keys, s, u, o) => callAnthropic(keys.anthropic, s, u, o),
}

export function extractJson(text) {
  if (!text) throw new Error('Empty model response')
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) t = fence[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object in model response')
  return JSON.parse(t.slice(start, end + 1))
}

// Run a prompt against the requested provider; 'auto' walks the free-first
// chain (groq -> gemini -> openai -> anthropic) and falls through on errors
// such as rate limits. Returns { json, provider }.
export async function runPrompt({ keys, provider = 'auto', system, user, temperature, maxTokens }) {
  const order = PROVIDER_ORDER.includes(provider) ? [provider] : PROVIDER_ORDER
  const usable = order.filter((p) => keys[p])
  if (usable.length === 0) {
    throw Object.assign(
      new Error(
        'No API key configured for the selected provider. Add a Groq, Gemini, OpenAI or Anthropic key in Settings (or the server .env).'
      ),
      { status: 400 }
    )
  }
  const errors = []
  for (const p of usable) {
    try {
      const raw = await CALLERS[p](keys, system, user, { temperature, maxTokens })
      return { json: extractJson(raw), provider: p }
    } catch (err) {
      errors.push(`${p}: ${err.message}`)
    }
  }
  throw Object.assign(new Error(`All providers failed — ${errors.join(' | ')}`), { status: 502 })
}
