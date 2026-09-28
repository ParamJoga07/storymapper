import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteProject, getProject, listProjects } from '../api'
import type { Project, ProjectSummary } from '../types'

interface Props {
  onOpen: (p: Project) => void
}

export default function ProjectsView({ onOpen }: Props) {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    setLoading(true)
    listProjects()
      .then((r) => setProjects(r.projects))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  return (
    <div className="projects-view">
      <h1>Saved projects</h1>
      {error && <div className="banner error">{error}</div>}
      {loading ? (
        <p className="muted">Loading…</p>
      ) : projects.length === 0 ? (
        <p className="muted">No saved projects yet. Generate a story map and hit Save.</p>
      ) : (
        <ul className="project-list">
          {projects.map((p) => (
            <li key={p.id}>
              <button className="project-open" onClick={() => getProject(p.id).then(onOpen).catch((e) => setError(e.message))}>
                <strong>{p.name}</strong>
                <span className="muted small">Updated {new Date(p.updatedAt).toLocaleString()}</span>
              </button>
              <button
                className="icon-btn"
                title="Delete"
                onClick={() => {
                  if (confirm(`Delete "${p.name}"?`)) deleteProject(p.id).then(refresh).catch((e) => setError(e.message))
                }}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
