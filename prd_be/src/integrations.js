// Export story maps into delivery tools: Jira, Azure DevOps, monday.com.
// Each exporter creates an Epic (or group) per activity and a story item per
// user story, carrying the description, acceptance criteria and requirements.
// Credentials are supplied per request from the UI and never stored server-side.

function err(message, status = 400) {
  return Object.assign(new Error(message), { status })
}

function requireFields(config, fields) {
  for (const f of fields) {
    if (!config?.[f] || !String(config[f]).trim()) throw err(`Missing field: ${f}`)
  }
}

function filteredStories(step, releaseFilter) {
  return step.stories.filter((s) => releaseFilter === 'all' || s.release === releaseFilter)
}

function storyBodyText(story, activity, step) {
  const lines = []
  if (story.story) lines.push(story.story, '')
  lines.push(`Story map: ${activity.name} › ${step.name}`)
  lines.push(`Release: ${story.release.toUpperCase()} · Priority: ${story.priority}`)
  if (story.requirements.length) {
    lines.push('', 'Requirements:')
    for (const r of story.requirements) lines.push(`• (${r.type}) ${r.text}`)
  }
  return lines.join('\n')
}

function acText(story) {
  return story.acceptanceCriteria.map((ac) => `• ${ac}`).join('\n')
}

/* ------------------------------ Jira ------------------------------ */

function jiraBase(config) {
  const domain = config.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  return `https://${domain}`
}

function jiraHeaders(config) {
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64')
  return { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', Accept: 'application/json' }
}

// Minimal Atlassian Document Format builder
function adf(story, activity, step) {
  const content = []
  const para = (text) => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] })
  if (story.story) content.push(para(story.story))
  content.push(para(`Story map: ${activity.name} › ${step.name} — Release: ${story.release.toUpperCase()}, Priority: ${story.priority}`))
  const bullets = (title, items) => {
    if (!items.length) return
    content.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: title }] })
    content.push({
      type: 'bulletList',
      content: items.map((t) => ({ type: 'listItem', content: [para(t)] })),
    })
  }
  bullets('Acceptance criteria', story.acceptanceCriteria)
  bullets('Requirements', story.requirements.map((r) => `(${r.type}) ${r.text}`))
  return { type: 'doc', version: 1, content }
}

async function jiraRequest(config, method, apiPath, body) {
  const res = await fetch(`${jiraBase(config)}${apiPath}`, {
    method,
    headers: jiraHeaders(config),
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text.slice(0, 300) }
  }
  if (!res.ok) {
    const msg =
      data?.errorMessages?.join('; ') ||
      (data?.errors && Object.values(data.errors).join('; ')) ||
      data?.raw ||
      `HTTP ${res.status}`
    throw err(`Jira: ${msg}`, res.status === 401 || res.status === 403 ? 401 : 502)
  }
  return data
}

// Ask Jira which issue types this project actually has, and pick real names
// for "epic" and "story" — projects differ (Story vs Task vs translated names),
// and Jira rejects names that don't exist with "Specify a valid issue type".
async function jiraIssueTypes(config) {
  const project = await jiraRequest(
    config,
    'GET',
    `/rest/api/3/project/${encodeURIComponent(config.projectKey)}?expand=issueTypes`
  )
  const types = (project.issueTypes || []).filter((t) => !t.subtask)
  const byName = (name) =>
    types.find((t) => t.name.toLowerCase() === String(name || '').toLowerCase())
  const epicType =
    byName('Epic') || types.find((t) => t.hierarchyLevel === 1) || null
  const baseTypes = types.filter((t) => (t.hierarchyLevel ?? 0) === 0)
  const storyType =
    byName(config.issueType) ||
    byName('Story') ||
    byName('Task') ||
    baseTypes[0] ||
    null
  return { project, epicType, storyType, names: types.map((t) => t.name) }
}

export async function jiraTest(config) {
  requireFields(config, ['domain', 'email', 'apiToken', 'projectKey'])
  const me = await jiraRequest(config, 'GET', '/rest/api/3/myself')
  const { project, epicType, storyType } = await jiraIssueTypes(config)
  const typeInfo = ` Will create ${epicType ? `"${epicType.name}"` : 'no epics (type missing)'} + "${storyType?.name || '?'}" issues.`
  return {
    ok: true,
    message: `Connected as ${me.displayName} — project "${project.name}" (${project.key}).${typeInfo}`,
  }
}

async function jiraCreateIssue(config, fields) {
  return jiraRequest(config, 'POST', '/rest/api/3/issue', { fields })
}

export async function jiraExport(config, storyMap, releaseFilter) {
  requireFields(config, ['domain', 'email', 'apiToken', 'projectKey'])
  const created = []
  const errors = []
  const base = jiraBase(config)

  // Resolve the project's real issue-type names first.
  const { epicType, storyType, names } = await jiraIssueTypes(config)
  if (!storyType) {
    throw err(`Jira: no usable issue type found in project ${config.projectKey} (available: ${names.join(', ') || 'none'})`)
  }
  if (config.issueType && storyType.name.toLowerCase() !== config.issueType.toLowerCase()) {
    errors.push(
      `Note: issue type "${config.issueType}" does not exist in this project — using "${storyType.name}" instead (available: ${names.join(', ')})`
    )
  }

  for (const activity of storyMap.activities) {
    let epicKey = null
    if (epicType) {
      try {
        const epic = await jiraCreateIssue(config, {
          project: { key: config.projectKey },
          summary: activity.name,
          issuetype: { id: epicType.id },
        })
        epicKey = epic.key
        created.push({ type: epicType.name, title: activity.name, key: epic.key, url: `${base}/browse/${epic.key}` })
      } catch (e) {
        errors.push(`Epic "${activity.name}": ${e.message}`)
      }
    }
    for (const step of activity.steps) {
      for (const story of filteredStories(step, releaseFilter)) {
        const fields = {
          project: { key: config.projectKey },
          summary: story.title,
          description: adf(story, activity, step),
          issuetype: { id: storyType.id },
        }
        try {
          let issue
          try {
            issue = await jiraCreateIssue(config, epicKey ? { ...fields, parent: { key: epicKey } } : fields)
          } catch {
            // company-managed projects may reject parent on stories — retry without
            issue = await jiraCreateIssue(config, fields)
          }
          created.push({ type: storyType.name, title: story.title, key: issue.key, url: `${base}/browse/${issue.key}` })
        } catch (e) {
          errors.push(`Story "${story.title}": ${e.message}`)
        }
      }
    }
  }
  return { created, errors }
}

/* --------------------------- Azure DevOps --------------------------- */

function azureHeaders(config, contentType = 'application/json-patch+json') {
  const auth = Buffer.from(`:${config.pat}`).toString('base64')
  return { Authorization: `Basic ${auth}`, 'Content-Type': contentType }
}

function azureUrl(config, typeName) {
  const org = config.organization.replace(/^https?:\/\/(dev\.azure\.com\/)?/, '').replace(/\/.*$/, '')
  return `https://dev.azure.com/${org}/${encodeURIComponent(config.project)}/_apis/wit/workitems/$${encodeURIComponent(typeName)}?api-version=7.0`
}

async function azureCreate(config, typeName, patches) {
  const res = await fetch(azureUrl(config, typeName), {
    method: 'POST',
    headers: azureHeaders(config),
    body: JSON.stringify(patches),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw err(`Azure DevOps: ${data.message || `HTTP ${res.status}`}`, res.status === 401 ? 401 : 502)
  }
  return data
}

function esc(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function azureTest(config) {
  requireFields(config, ['organization', 'project', 'pat'])
  const org = config.organization.replace(/^https?:\/\/(dev\.azure\.com\/)?/, '').replace(/\/.*$/, '')
  const res = await fetch(
    `https://dev.azure.com/${org}/_apis/projects/${encodeURIComponent(config.project)}?api-version=7.0`,
    { headers: azureHeaders(config, 'application/json') }
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw err(`Azure DevOps: ${data.message || `HTTP ${res.status} — check organization, project and PAT`}`, 401)
  return { ok: true, message: `Connected — project "${data.name}"` }
}

export async function azureExport(config, storyMap, releaseFilter) {
  requireFields(config, ['organization', 'project', 'pat'])
  const storyType = config.workItemType || 'User Story'
  const created = []
  const errors = []
  for (const activity of storyMap.activities) {
    let epicUrl = null
    try {
      const epic = await azureCreate(config, 'Epic', [
        { op: 'add', path: '/fields/System.Title', value: activity.name },
        { op: 'add', path: '/fields/System.Description', value: esc(activity.description || '') },
      ])
      epicUrl = epic.url
      created.push({ type: 'Epic', title: activity.name, key: `#${epic.id}`, url: epic._links?.html?.href })
    } catch (e) {
      errors.push(`Epic "${activity.name}": ${e.message}`)
    }
    for (const step of activity.steps) {
      for (const story of filteredStories(step, releaseFilter)) {
        const patches = [
          { op: 'add', path: '/fields/System.Title', value: story.title },
          {
            op: 'add',
            path: '/fields/System.Description',
            value: `<div>${esc(storyBodyText(story, activity, step)).replace(/\n/g, '<br/>')}</div>`,
          },
        ]
        if (story.acceptanceCriteria.length) {
          patches.push({
            op: 'add',
            path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',
            value: `<div>${story.acceptanceCriteria.map((ac) => `• ${esc(ac)}`).join('<br/>')}</div>`,
          })
        }
        if (epicUrl) {
          patches.push({
            op: 'add',
            path: '/relations/-',
            value: { rel: 'System.LinkTypes.Hierarchy-Reverse', url: epicUrl },
          })
        }
        try {
          let item
          try {
            item = await azureCreate(config, storyType, patches)
          } catch (e) {
            // Scrum-process projects use "Product Backlog Item"
            if (storyType === 'User Story') {
              item = await azureCreate(config, 'Product Backlog Item', patches)
            } else throw e
          }
          created.push({ type: storyType, title: story.title, key: `#${item.id}`, url: item._links?.html?.href })
        } catch (e) {
          errors.push(`Story "${story.title}": ${e.message}`)
        }
      }
    }
  }
  return { created, errors }
}

/* ----------------------------- monday.com ----------------------------- */

async function mondayQuery(config, query, variables) {
  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: { Authorization: config.apiToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.errors || data.error_message) {
    const msg = data.errors?.map((e) => e.message).join('; ') || data.error_message || `HTTP ${res.status}`
    throw err(`monday.com: ${msg}`, res.status === 401 ? 401 : 502)
  }
  return data.data
}

export async function mondayTest(config) {
  requireFields(config, ['apiToken', 'boardId'])
  const data = await mondayQuery(
    config,
    'query ($board: [ID!]) { me { name } boards (ids: $board) { name } }',
    { board: [String(config.boardId)] }
  )
  if (!data.boards?.length) throw err('monday.com: board not found — check the board ID', 400)
  return { ok: true, message: `Connected as ${data.me.name} — board "${data.boards[0].name}"` }
}

export async function mondayExport(config, storyMap, releaseFilter) {
  requireFields(config, ['apiToken', 'boardId'])
  const boardId = String(config.boardId)
  const created = []
  const errors = []
  for (const activity of storyMap.activities) {
    let groupId = null
    try {
      const g = await mondayQuery(
        config,
        'mutation ($board: ID!, $name: String!) { create_group (board_id: $board, group_name: $name) { id } }',
        { board: boardId, name: activity.name }
      )
      groupId = g.create_group.id
      created.push({ type: 'Group', title: activity.name, key: groupId })
    } catch (e) {
      errors.push(`Group "${activity.name}": ${e.message}`)
    }
    for (const step of activity.steps) {
      for (const story of filteredStories(step, releaseFilter)) {
        try {
          const item = await mondayQuery(
            config,
            `mutation ($board: ID!, $group: String, $name: String!) {
              create_item (board_id: $board, group_id: $group, item_name: $name) { id url }
            }`,
            { board: boardId, group: groupId, name: `${story.title} [${step.name}]` }
          )
          const itemId = item.create_item.id
          const body = [storyBodyText(story, activity, step), story.acceptanceCriteria.length ? `\nAcceptance criteria:\n${acText(story)}` : '']
            .join('\n')
            .trim()
          if (body) {
            await mondayQuery(
              config,
              'mutation ($item: ID!, $body: String!) { create_update (item_id: $item, body: $body) { id } }',
              { item: itemId, body }
            )
          }
          created.push({ type: 'Item', title: story.title, key: itemId, url: item.create_item.url })
        } catch (e) {
          errors.push(`Item "${story.title}": ${e.message}`)
        }
      }
    }
  }
  return { created, errors }
}

/* ------------------------------ registry ------------------------------ */

export const INTEGRATIONS = {
  jira: { test: jiraTest, export: jiraExport },
  azure: { test: azureTest, export: azureExport },
  monday: { test: mondayTest, export: mondayExport },
}
