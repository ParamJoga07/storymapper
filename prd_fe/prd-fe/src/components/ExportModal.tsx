import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, CircleHelp, X } from 'lucide-react'
import { AzureDevOpsLogo, JiraLogo, MondayLogo } from './BrandLogos'
import { exportToTool, loadIntegrationConfig, saveIntegrationConfig, testIntegration } from '../api'
import type { ExportResult, IntegrationTool, StoryMap } from '../types'

interface Props {
  storyMap: StoryMap
  onClose: () => void
}

interface FieldDef {
  key: string
  label: string
  placeholder: string
  secret?: boolean
  hint?: string
}

const TOOLS: Record<
  IntegrationTool,
  { name: string; logo: React.ReactNode; fields: FieldDef[]; docs: string; steps: { title: string; how: string }[] }
> = {
  jira: {
    name: 'Jira',
    logo: <JiraLogo size={17} />,
    docs: 'https://id.atlassian.com/manage-profile/security/api-tokens',
    fields: [
      { key: 'domain', label: 'Site domain', placeholder: 'yourcompany.atlassian.net' },
      { key: 'email', label: 'Account email', placeholder: 'you@company.com' },
      { key: 'apiToken', label: 'API token', placeholder: 'ATATT…', secret: true, hint: 'Create one at id.atlassian.com → Security → API tokens' },
      { key: 'projectKey', label: 'Project key', placeholder: 'PROJ' },
      { key: 'issueType', label: 'Story issue type (optional)', placeholder: 'Story' },
    ],
    steps: [
      {
        title: 'Site domain',
        how: 'The address you open Jira at in your browser — e.g. if your Jira lives at https://mycompany.atlassian.net/jira/…, enter "mycompany.atlassian.net" (no https://, nothing after the domain).',
      },
      {
        title: 'Account email',
        how: 'The email address you sign in to Jira / Atlassian with (check your profile avatar → top right in Jira).',
      },
      {
        title: 'API token',
        how: 'Open id.atlassian.com/manage-profile/security/api-tokens (link below) → sign in → "Create API token" → give it any name (e.g. StoryMapper) → Create → Copy. It starts with "ATATT". Paste it here — Atlassian only shows it once.',
      },
      {
        title: 'Project key',
        how: 'In Jira, open the project you want the stories in. The key is the short prefix in its issue numbers — for issue "SHOP-42" the key is "SHOP". You can also see it under Projects → your project → the code in brackets.',
      },
      {
        title: 'Story issue type',
        how: 'Leave as "Story" for most projects. If your project uses a different type (e.g. "Task"), enter that name exactly as Jira shows it.',
      },
    ],
  },
  azure: {
    name: 'Azure DevOps',
    logo: <AzureDevOpsLogo size={17} />,
    docs: 'https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate',
    fields: [
      { key: 'organization', label: 'Organization', placeholder: 'my-org' },
      { key: 'project', label: 'Project name', placeholder: 'My Project' },
      { key: 'pat', label: 'Personal access token', placeholder: 'PAT with Work Items read & write', secret: true, hint: 'User settings → Personal access tokens → scope: Work Items (Read & Write)' },
      { key: 'workItemType', label: 'Story work item type (optional)', placeholder: 'User Story' },
    ],
    steps: [
      {
        title: 'Organization',
        how: 'Go to dev.azure.com and sign in. Your organization is the name right after dev.azure.com/ in the URL — for dev.azure.com/acme-team enter "acme-team".',
      },
      {
        title: 'Project name',
        how: 'The project shown on your organization\'s home page (the next part of the URL: dev.azure.com/acme-team/MyProject → "MyProject"). Type it exactly, spaces are fine.',
      },
      {
        title: 'Personal access token (PAT)',
        how: 'In Azure DevOps click the user-settings icon (top right, next to your avatar) → "Personal access tokens" → "+ New Token". Name it (e.g. StoryMapper), pick your organization, set Expiration, and under Scopes choose "Custom defined" → Work Items → check Read & Write. Create, then copy the token — it\'s shown only once.',
      },
      {
        title: 'Work item type',
        how: 'Leave as "User Story" (Agile-process projects). Scrum projects use "Product Backlog Item" — StoryMapper tries that automatically if "User Story" is rejected. Basic-process projects use "Issue".',
      },
    ],
  },
  monday: {
    name: 'monday.com',
    logo: <MondayLogo size={19} />,
    docs: 'https://developer.monday.com/api-reference/docs/authentication',
    fields: [
      { key: 'apiToken', label: 'API token', placeholder: 'eyJhbG…', secret: true, hint: 'Avatar → Developers → My access tokens' },
      { key: 'boardId', label: 'Board ID', placeholder: '1234567890', hint: 'The number in your board URL' },
    ],
    steps: [
      {
        title: 'API token',
        how: 'In monday.com click your avatar (bottom-left corner) → "Developers". In the Developer Center open "My access tokens" → "Show" → Copy. (Admins can also find it under Administration → Connections → API.)',
      },
      {
        title: 'Board ID',
        how: 'Open the board you want the stories on. Look at the URL: monday.com/boards/1234567890 — the long number at the end is the board ID. Copy just the number.',
      },
    ],
  },
}

export default function ExportModal({ storyMap, onClose }: Props) {
  const [tool, setTool] = useState<IntegrationTool>('jira')
  const [configs, setConfigs] = useState<Record<IntegrationTool, Record<string, string>>>({
    jira: loadIntegrationConfig('jira'),
    azure: loadIntegrationConfig('azure'),
    monday: loadIntegrationConfig('monday'),
  })
  const [remember, setRemember] = useState(true)
  const [releaseFilter, setReleaseFilter] = useState<'all' | 'mvp' | 'later'>('all')
  const [showHelp, setShowHelp] = useState(false)
  const [busy, setBusy] = useState<'test' | 'export' | null>(null)
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [result, setResult] = useState<ExportResult | null>(null)

  const def = TOOLS[tool]
  const config = configs[tool]

  const storyCount = useMemo(
    () =>
      storyMap.activities.reduce(
        (n, a) =>
          n +
          a.steps.reduce(
            (m, s) => m + s.stories.filter((st) => releaseFilter === 'all' || st.release === releaseFilter).length,
            0
          ),
        0
      ),
    [storyMap, releaseFilter]
  )

  const setField = (key: string, value: string) => {
    setConfigs((c) => ({ ...c, [tool]: { ...c[tool], [key]: value } }))
  }

  const persist = () => {
    if (remember) saveIntegrationConfig(tool, config)
  }

  const runTest = async () => {
    setBusy('test')
    setStatus(null)
    setResult(null)
    try {
      const r = await testIntegration(tool, config)
      persist()
      setStatus({ kind: 'ok', text: r.message })
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Connection failed' })
    } finally {
      setBusy(null)
    }
  }

  const runExport = async () => {
    setBusy('export')
    setStatus(null)
    setResult(null)
    try {
      const r = await exportToTool(tool, config, storyMap, releaseFilter)
      persist()
      setResult(r)
      setStatus(
        r.errors.length
          ? { kind: 'error', text: `Created ${r.created.length} items with ${r.errors.length} errors` }
          : { kind: 'ok', text: `Created ${r.created.length} items in ${def.name} 🎉` }
      )
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Export failed' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2 style={{ margin: 0 }}>Push to delivery tools</h2>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <p className="muted small">
          Creates one Epic{tool === 'monday' ? ' (group)' : ''} per activity and one story per card —
          with description, acceptance criteria and requirements. Credentials are sent straight to the
          tool and never stored on the server.
        </p>

        <div className="tool-tabs">
          {(Object.keys(TOOLS) as IntegrationTool[]).map((t) => (
            <button
              key={t}
              className={`tool-tab ${tool === t ? 'active' : ''}`}
              onClick={() => {
                setTool(t)
                setStatus(null)
                setResult(null)
              }}
            >
              {TOOLS[t].logo} {TOOLS[t].name}
            </button>
          ))}
        </div>

        <button className="help-toggle" onClick={() => setShowHelp(!showHelp)}>
          <CircleHelp size={15} />
          Where do I find these values?
          {showHelp ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {showHelp && (
          <ol className="help-steps">
            {def.steps.map((s, i) => (
              <li key={i}>
                <strong>{s.title}</strong>
                <span>{s.how}</span>
              </li>
            ))}
            <li className="help-doc-link">
              <a href={def.docs} target="_blank" rel="noreferrer">
                Open {def.name}'s official token page ↗
              </a>
            </li>
          </ol>
        )}

        <div className="export-fields">
          {def.fields.map((f) => (
            <label key={f.key}>
              {f.label}
              <input
                type={f.secret ? 'password' : 'text'}
                value={config[f.key] || ''}
                placeholder={f.placeholder}
                onChange={(e) => setField(f.key, e.target.value)}
                autoComplete="off"
              />
              {f.hint && <span className="muted small">{f.hint}</span>}
            </label>
          ))}
        </div>

        <div className="export-options">
          <label className="inline-label">
            Scope
            <select value={releaseFilter} onChange={(e) => setReleaseFilter(e.target.value as typeof releaseFilter)}>
              <option value="all">All stories</option>
              <option value="mvp">MVP only</option>
              <option value="later">Later release only</option>
            </select>
          </label>
          <label className="check-label">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember credentials in this browser
          </label>
        </div>

        {status && <div className={`banner ${status.kind === 'ok' ? 'success' : 'error'}`}>{status.text}</div>}

        {result && result.created.length > 0 && (
          <div className="export-results">
            {result.created.map((c, i) => (
              <div key={i} className="export-result-row">
                <span className="chip">{c.type}</span>
                {c.url ? (
                  <a href={c.url} target="_blank" rel="noreferrer">{c.key} — {c.title}</a>
                ) : (
                  <span>{c.key} — {c.title}</span>
                )}
              </div>
            ))}
            {result.errors.map((e, i) => (
              <div key={`e${i}`} className="export-result-row error-row"><AlertTriangle size={13} /> {e}</div>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <a className="link small" href={def.docs} target="_blank" rel="noreferrer">
            How to get a {def.name} token ↗
          </a>
          <span style={{ flex: 1 }} />
          <button className="btn ghost" disabled={!!busy} onClick={runTest}>
            {busy === 'test' ? 'Testing…' : 'Test connection'}
          </button>
          <button className="btn primary" disabled={!!busy || storyCount === 0} onClick={runExport}>
            {busy === 'export' ? 'Exporting…' : `Export ${storyCount} stories`}
          </button>
        </div>
      </div>
    </div>
  )
}
