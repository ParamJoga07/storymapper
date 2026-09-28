import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { StoryMapperLogo } from './BrandLogos'
import { authLogin, authRegister } from '../api'
import type { User } from '../types'

interface Props {
  mode: 'login' | 'register'
  onAuthed: (user: User) => void
  onSwitchMode: (mode: 'login' | 'register') => void
  onBack: () => void
}

export default function AuthView({ mode, onAuthed, onSwitchMode, onBack }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const user =
        mode === 'register'
          ? await authRegister(email, password, name)
          : await authLogin(email, password)
      onAuthed(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-view">
      <form className="auth-card" onSubmit={submit}>
        <button type="button" className="link auth-back" onClick={onBack}>
          <ArrowLeft size={13} /> Back
        </button>
        <div className="auth-logo"><StoryMapperLogo size={48} /></div>
        <h1>{mode === 'register' ? 'Create your workspace' : 'Welcome back'}</h1>
        <p className="muted">
          {mode === 'register'
            ? 'Free account — your projects stay private to you.'
            : 'Sign in to access your story maps.'}
        </p>
        {mode === 'register' && (
          <label>
            Full name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Rivera" autoComplete="name" />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          />
        </label>
        {error && <div className="banner error">{error}</div>}
        <button className="btn primary large auth-submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}
        </button>
        <p className="muted small auth-switch">
          {mode === 'register' ? (
            <>Already have an account?{' '}
              <button type="button" className="link" onClick={() => onSwitchMode('login')}>Sign in</button>
            </>
          ) : (
            <>New here?{' '}
              <button type="button" className="link" onClick={() => onSwitchMode('register')}>Create a free account</button>
            </>
          )}
        </p>
      </form>
    </div>
  )
}
