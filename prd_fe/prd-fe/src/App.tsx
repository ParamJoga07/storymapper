import { useCallback, useEffect, useState } from 'react'
import {
  Check,
  Download,
  FileJson,
  Link2,
  Moon,
  Save as SaveIcon,
  ScanSearch,
  Settings as SettingsIcon,
  Sun,
} from 'lucide-react'
import { StoryMapperLogo } from './components/BrandLogos'
import { analyzePrd, authMe, buildStoryMap, getProviders, logout, saveProject } from './api'
import type { Analysis, Project, StoryMap, User } from './types'
import { applyTheme, getInitialTheme, type Theme } from './theme'
import Landing from './components/Landing'
import AuthView from './components/AuthView'
import InputView, { type PipelineStage } from './components/InputView'
import AnalysisPanel from './components/AnalysisPanel'
import StoryMapBoard from './components/StoryMapBoard'
import StoryDrawer from './components/StoryDrawer'
import SettingsModal from './components/SettingsModal'
import ProjectsView from './components/ProjectsView'
import ExportModal from './components/ExportModal'
import { exportJson, exportMarkdown } from './export'
import './App.css'

type View = 'landing' | 'auth' | 'input' | 'map' | 'projects'
type StoryLoc = { activityId: string; stepId: string; storyId: string }

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register')
  const [view, setView] = useState<View>('landing')
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  const [prdText, setPrdText] = useState('')
  const [projectName, setProjectName] = useState('')
  const [projectId, setProjectId] = useState<string | undefined>()
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [storyMap, setStoryMap] = useState<StoryMap | null>(null)
  const [stage, setStage] = useState<PipelineStage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<StoryLoc | null>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [providersReady, setProvidersReady] = useState(true)
  const [usedProvider, setUsedProvider] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [dirty, setDirty] = useState(false)

  useEffect(() => applyTheme(theme), [theme])

  useEffect(() => {
    authMe().then((u) => {
      if (u) {
        setUser(u)
        setView('input')
      }
      setAuthChecked(true)
    })
    const onExpired = () => {
      setUser(null)
      setView('landing')
    }
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [])

  const checkProviders = useCallback(() => {
    getProviders()
      .then((r) => setProvidersReady(r.providers.length > 0))
      .catch(() => setProvidersReady(false))
  }, [])

  useEffect(checkProviders, [checkProviders])

  const generate = async () => {
    setError(null)
    setStage('analyzing')
    try {
      const a = await analyzePrd(prdText)
      setAnalysis(a.analysis)
      setStage('mapping')
      const m = await buildStoryMap(prdText, a.analysis)
      setStoryMap(m.storyMap)
      setUsedProvider(m.provider)
      setStage('done')
      setDirty(true)
      setSelected(null)
      setView('map')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setStage('idle')
    }
  }

  const updateMap = (m: StoryMap) => {
    setStoryMap(m)
    setDirty(true)
    setSaveState('idle')
  }

  const save = async () => {
    if (!storyMap) return
    setSaveState('saving')
    try {
      const p = await saveProject({
        id: projectId,
        name: projectName || 'Untitled project',
        prdText,
        analysis,
        storyMap,
      })
      setProjectId(p.id)
      setDirty(false)
      setSaveState('saved')
    } catch (err) {
      setSaveState('idle')
      alert(err instanceof Error ? err.message : 'Save failed')
    }
  }

  const openProject = (p: Project) => {
    setProjectId(p.id)
    setProjectName(p.name)
    setPrdText(p.prdText || '')
    setAnalysis(p.analysis)
    setStoryMap(p.storyMap)
    setSelected(null)
    setDirty(false)
    setSaveState('idle')
    setView(p.storyMap ? 'map' : 'input')
  }

  const newProject = () => {
    setProjectId(undefined)
    setProjectName('')
    setPrdText('')
    setAnalysis(null)
    setStoryMap(null)
    setSelected(null)
    setStage('idle')
    setError(null)
    setDirty(false)
    setView(user ? 'input' : 'landing')
  }

  const signOut = () => {
    logout()
    setUser(null)
    newProject()
    setView('landing')
  }

  const themeToggle = (
    <button
      className="icon-btn theme-toggle"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )

  if (!authChecked) return <div className="boot-screen"><span className="spinner" /></div>

  /* ---------- logged out: landing + auth ---------- */
  if (!user) {
    return (
      <div className="app">
        <header className="topbar">
          <button className="brand" onClick={() => setView('landing')}>
            <StoryMapperLogo size={26} />
            <span>StoryMapper</span>
          </button>
          <div className="topbar-right">
            {themeToggle}
            {view !== 'auth' && (
              <>
                <button className="btn ghost" onClick={() => { setAuthMode('login'); setView('auth') }}>
                  Sign in
                </button>
                <button className="btn primary" onClick={() => { setAuthMode('register'); setView('auth') }}>
                  Get started
                </button>
              </>
            )}
          </div>
        </header>
        {view === 'auth' ? (
          <AuthView
            mode={authMode}
            onSwitchMode={setAuthMode}
            onBack={() => setView('landing')}
            onAuthed={(u) => {
              setUser(u)
              setView('input')
            }}
          />
        ) : (
          <Landing
            onGetStarted={() => { setAuthMode('register'); setView('auth') }}
            onSignIn={() => { setAuthMode('login'); setView('auth') }}
          />
        )}
      </div>
    )
  }

  /* ---------- logged in: the app ---------- */
  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={newProject}>
          <StoryMapperLogo size={26} />
          <span>StoryMapper</span>
        </button>
        <nav>
          <button className={`nav-btn ${view === 'input' ? 'active' : ''}`} onClick={() => setView('input')}>
            PRD Input
          </button>
          <button
            className={`nav-btn ${view === 'map' ? 'active' : ''}`}
            disabled={!storyMap}
            onClick={() => setView('map')}
          >
            Story Map
          </button>
          <button className={`nav-btn ${view === 'projects' ? 'active' : ''}`} onClick={() => setView('projects')}>
            Projects
          </button>
        </nav>
        <div className="topbar-right">
          {usedProvider && view === 'map' && <span className="chip">via {usedProvider}</span>}
          {themeToggle}
          <button className="btn ghost" onClick={() => setShowSettings(true)}>
            <SettingsIcon size={15} /> Settings
          </button>
          <div className="user-chip" title={user.email}>
            <span className="avatar">{(user.name || user.email)[0].toUpperCase()}</span>
            <span className="user-name">{user.name}</span>
            <button className="link small" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </header>

      {view === 'input' && (
        <InputView
          prdText={prdText}
          setPrdText={setPrdText}
          projectName={projectName}
          setProjectName={setProjectName}
          stage={stage}
          error={error}
          onGenerate={generate}
          providersReady={providersReady}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}

      {view === 'map' && storyMap && (
        <div className="map-view">
          <div className="map-toolbar">
            <input
              className="name-input inline"
              value={projectName}
              placeholder="Project name"
              onChange={(e) => {
                setProjectName(e.target.value)
                setDirty(true)
                setSaveState('idle')
              }}
            />
            <div className="toolbar-actions">
              {analysis && (
                <button className="btn ghost" onClick={() => setShowAnalysis(!showAnalysis)}>
                  <ScanSearch size={15} /> {showAnalysis ? 'Hide analysis' : 'PRD analysis'}
                </button>
              )}
              <button className="btn ghost" onClick={() => exportMarkdown(projectName, analysis, storyMap)}>
                <Download size={15} /> Markdown
              </button>
              <button className="btn ghost" onClick={() => exportJson(projectName, analysis, storyMap)}>
                <FileJson size={15} /> JSON
              </button>
              <button className="btn ghost accent" onClick={() => setShowExport(true)}>
                <Link2 size={15} /> Jira / Azure / monday
              </button>
              <button className="btn primary" onClick={save} disabled={saveState === 'saving'}>
                {saveState === 'saving' ? (
                  'Saving…'
                ) : saveState === 'saved' && !dirty ? (
                  <><Check size={15} /> Saved</>
                ) : (
                  <><SaveIcon size={15} /> Save</>
                )}
              </button>
            </div>
          </div>
          <div className="map-body">
            {showAnalysis && analysis && <AnalysisPanel analysis={analysis} />}
            <StoryMapBoard
              storyMap={storyMap}
              onUpdate={updateMap}
              onSelectStory={setSelected}
              selectedStoryId={selected?.storyId || null}
            />
            {selected && (
              <StoryDrawer
                storyMap={storyMap}
                loc={selected}
                onUpdate={updateMap}
                onClose={() => setSelected(null)}
              />
            )}
          </div>
        </div>
      )}

      {view === 'projects' && <ProjectsView onOpen={openProject} />}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onSaved={checkProviders} />}
      {showExport && storyMap && <ExportModal storyMap={storyMap} onClose={() => setShowExport(false)} />}
    </div>
  )
}

export default App
