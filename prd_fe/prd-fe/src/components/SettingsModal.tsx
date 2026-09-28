import { useState } from 'react'
import { X } from 'lucide-react'
import { loadSettings, saveSettings } from '../api'
import type { Settings } from '../types'

interface Props {
  onClose: () => void
  onSaved: (s: Settings) => void
}

const KEY_FIELDS: {
  key: 'groqKey' | 'geminiKey' | 'openaiKey' | 'anthropicKey'
  label: string
  tier: string
  placeholder: string
  url: string
}[] = [
  { key: 'groqKey', label: 'Groq', tier: 'Free', placeholder: 'gsk_…', url: 'https://console.groq.com/keys' },
  { key: 'geminiKey', label: 'Google Gemini', tier: 'Free', placeholder: 'AIza…', url: 'https://aistudio.google.com/apikey' },
  { key: 'openaiKey', label: 'OpenAI', tier: 'Paid', placeholder: 'sk-…', url: 'https://platform.openai.com/api-keys' },
  { key: 'anthropicKey', label: 'Anthropic (Claude)', tier: 'Paid', placeholder: 'sk-ant-…', url: 'https://console.anthropic.com/settings/keys' },
]

export default function SettingsModal({ onClose, onSaved }: Props) {
  const [s, setS] = useState<Settings>(loadSettings())

  const save = () => {
    saveSettings(s)
    onSaved(s)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2 style={{ margin: 0 }}>AI Settings</h2>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <p className="muted small">
          Keys are stored in your browser and sent only to your StoryMapper backend. In Auto mode the
          free providers are tried first, with paid ones as fallback when rate limits hit.
        </p>
        <label>
          Provider
          <select
            value={s.provider}
            onChange={(e) => setS({ ...s, provider: e.target.value as Settings['provider'] })}
          >
            <option value="auto">Auto (Groq → Gemini → OpenAI → Anthropic)</option>
            <option value="groq">Groq only</option>
            <option value="gemini">Gemini only</option>
            <option value="openai">OpenAI only</option>
            <option value="anthropic">Anthropic (Claude) only</option>
          </select>
        </label>
        {KEY_FIELDS.map((f) => (
          <label key={f.key}>
            <span className="key-label">
              {f.label} <span className="chip">{f.tier}</span>
              <a className="small" href={f.url} target="_blank" rel="noreferrer">Get key ↗</a>
            </span>
            <input
              type="password"
              value={s[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => setS({ ...s, [f.key]: e.target.value.trim() })}
              autoComplete="off"
            />
          </label>
        ))}
        <p className="muted small">
          Keys can also be set server-side in <code>prd_be/.env</code> — then leave these blank.
        </p>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
