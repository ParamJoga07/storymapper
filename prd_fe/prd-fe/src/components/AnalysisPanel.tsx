import { AlertTriangle, ArrowRight, CircleHelp, GitBranch, LifeBuoy, Repeat, UserRound } from 'lucide-react'
import type { Analysis } from '../types'

const FLOW_ICONS: Record<string, React.ReactNode> = {
  sequential: <ArrowRight size={13} />,
  decision: <GitBranch size={13} />,
  recovery: <LifeBuoy size={13} />,
  conditional: <CircleHelp size={13} />,
  repeatable: <Repeat size={13} />,
}

export default function AnalysisPanel({ analysis }: { analysis: Analysis }) {
  return (
    <div className="analysis-panel">
      {analysis.summary && (
        <section>
          <h3>Summary</h3>
          <p>{analysis.summary}</p>
          {analysis.problemStatement && (
            <p className="muted"><strong>Problem:</strong> {analysis.problemStatement}</p>
          )}
        </section>
      )}
      {analysis.personas.length > 0 && (
        <section>
          <h3>Personas</h3>
          {analysis.personas.map((p, i) => (
            <div key={i} className="persona-card">
              <strong className="icon-line"><UserRound size={13} /> {p.name}</strong>
              <p className="small">{p.description}</p>
              {p.goals.length > 0 && (
                <p className="small muted">Goals: {p.goals.join(' · ')}</p>
              )}
              {p.painPoints.length > 0 && (
                <p className="small muted">Pains: {p.painPoints.join(' · ')}</p>
              )}
            </div>
          ))}
        </section>
      )}
      {analysis.goals.length > 0 && (
        <section>
          <h3>Product goals</h3>
          <ul>{analysis.goals.map((g, i) => <li key={i}>{g}</li>)}</ul>
        </section>
      )}
      {analysis.flows.length > 0 && (
        <section>
          <h3>User flows</h3>
          {analysis.flows.map((f, i) => (
            <div key={i} className="flow-card">
              <strong className="icon-line">{FLOW_ICONS[f.type] || <ArrowRight size={13} />} {f.name}</strong>
              <span className={`chip flow-${f.type}`}>{f.type}</span>
              <p className="small">{f.steps.join(' → ')}</p>
              {f.edgeCases.length > 0 && (
                <p className="small muted icon-line"><AlertTriangle size={12} /> Edge cases: {f.edgeCases.join(' · ')}</p>
              )}
            </div>
          ))}
        </section>
      )}
      {analysis.requirements.length > 0 && (
        <section>
          <h3>Key requirements</h3>
          <ul>{analysis.requirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </section>
      )}
      {analysis.openQuestions.length > 0 && (
        <section>
          <h3>Open questions</h3>
          <ul>{analysis.openQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
        </section>
      )}
    </div>
  )
}
