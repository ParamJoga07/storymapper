import { useRef, useState } from 'react'
import { Check, FileUp, Sparkles } from 'lucide-react'
import { extractFile } from '../api'

export type PipelineStage = 'idle' | 'analyzing' | 'mapping' | 'done'

interface Props {
  prdText: string
  setPrdText: (t: string) => void
  projectName: string
  setProjectName: (n: string) => void
  stage: PipelineStage
  error: string | null
  onGenerate: () => void
  providersReady: boolean
  onOpenSettings: () => void
}

const STAGES: { key: PipelineStage; label: string; detail: string }[] = [
  { key: 'analyzing', label: 'Analyzing the PRD', detail: 'Extracting personas, goals, user flows and edge cases' },
  { key: 'mapping', label: 'Building the story map', detail: 'Grouping journeys into activities, steps and user stories' },
]

export default function InputView(props: Props) {
  const { prdText, setPrdText, projectName, setProjectName, stage, error, onGenerate, providersReady, onOpenSettings } = props
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const busy = stage === 'analyzing' || stage === 'mapping'

  const handleFile = async (file: File) => {
    setUploading(true)
    setUploadError(null)
    try {
      const { text, filename } = await extractFile(file)
      setPrdText(text)
      if (!projectName) setProjectName(filename.replace(/\.[^.]+$/, ''))
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="input-view">
      <div className="hero-copy">
        <span className="hero-badge"><Sparkles size={13} /> AI-powered product discovery</span>
        <h1>
          Turn a PRD into a <span className="grad">Story Map</span>
        </h1>
        <p>
          Paste or upload your Product Requirements Document and let the AI agent do the first-pass
          synthesis — personas, user flows, stories, acceptance criteria and MVP slicing.
        </p>
      </div>

      <div className="how-strip">
        <div className="how-chip"><span className="num">1</span> Paste your PRD</div>
        <span className="how-arrow">→</span>
        <div className="how-chip"><span className="num">2</span> AI extracts flows &amp; stories</div>
        <span className="how-arrow">→</span>
        <div className="how-chip"><span className="num">3</span> Refine, slice MVP &amp; export</div>
      </div>

      {!providersReady && (
        <div className="banner warn">
          No AI provider configured yet.{' '}
          <button className="link" onClick={onOpenSettings}>Add a free Groq or Gemini key</button> to get started.
        </div>
      )}

      <div className="input-card">
        <div className="input-row">
          <input
            className="name-input"
            placeholder="Project name (e.g. Checkout Redesign)"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
          <button className="btn ghost" disabled={uploading || busy} onClick={() => fileRef.current?.click()}>
            <FileUp size={15} /> {uploading ? 'Extracting…' : 'Upload PRD (.pdf / .md / .txt)'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.md,.txt,.markdown,text/plain"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
              e.target.value = ''
            }}
          />
        </div>
        {uploadError && <div className="banner error">{uploadError}</div>}
        <textarea
          className="prd-textarea"
          placeholder={'Paste your PRD here…\n\nTips for better results:\n• Keep the problem statement near the top\n• Name the user types / personas\n• Separate goals from implementation notes\n• Call out assumptions and open questions'}
          value={prdText}
          onChange={(e) => setPrdText(e.target.value)}
          disabled={busy}
        />
        <div className="input-footer">
          <span className="muted small">{prdText.trim().length.toLocaleString()} characters</span>
          <button
            className="btn primary large"
            disabled={busy || !prdText.trim() || !providersReady}
            onClick={onGenerate}
          >
            <Sparkles size={16} /> {busy ? 'Working…' : 'Generate Story Map'}
          </button>
        </div>
      </div>

      {(busy || error) && (
        <div className="pipeline-card">
          {STAGES.map((s, i) => {
            const stageIdx = stage === 'analyzing' ? 0 : stage === 'mapping' ? 1 : 2
            const state = i < stageIdx ? 'done' : i === stageIdx ? 'active' : 'todo'
            return (
              <div key={s.key} className={`pipeline-step ${state}`}>
                <span className="dot">{state === 'done' ? <Check size={14} /> : i + 1}</span>
                <div>
                  <strong>{s.label}</strong>
                  <div className="muted small">{s.detail}</div>
                </div>
                {state === 'active' && <span className="spinner" />}
              </div>
            )
          })}
          {error && <div className="banner error">{error}</div>}
        </div>
      )}
    </div>
  )
}
