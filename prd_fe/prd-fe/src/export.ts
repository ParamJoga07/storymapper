import type { Analysis, StoryMap } from './types'

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportJson(name: string, analysis: Analysis | null, storyMap: StoryMap) {
  download(
    `${name || 'story-map'}.json`,
    JSON.stringify({ name, analysis, storyMap }, null, 2),
    'application/json'
  )
}

export function exportMarkdown(name: string, analysis: Analysis | null, storyMap: StoryMap) {
  const lines: string[] = [`# ${name || 'Story Map'}`, '']
  if (analysis) {
    if (analysis.summary) lines.push('## Summary', '', analysis.summary, '')
    if (analysis.personas.length) {
      lines.push('## Personas', '')
      for (const p of analysis.personas) lines.push(`- **${p.name}** — ${p.description}`)
      lines.push('')
    }
    if (analysis.goals.length) {
      lines.push('## Goals', '')
      for (const g of analysis.goals) lines.push(`- ${g}`)
      lines.push('')
    }
  }
  lines.push('## Story Map', '')
  for (const act of storyMap.activities) {
    lines.push(`### ${act.name}`, '')
    if (act.description) lines.push(act.description, '')
    for (const step of act.steps) {
      lines.push(`#### ${step.name}`, '')
      for (const st of step.stories) {
        lines.push(`- **${st.title}** \`${st.release.toUpperCase()}\` \`${st.priority}\``)
        if (st.story) lines.push(`  - ${st.story}`)
        if (st.acceptanceCriteria.length) {
          lines.push('  - Acceptance criteria:')
          for (const ac of st.acceptanceCriteria) lines.push(`    - ${ac}`)
        }
        if (st.requirements.length) {
          lines.push('  - Requirements:')
          for (const r of st.requirements) lines.push(`    - (${r.type}) ${r.text}`)
        }
      }
      lines.push('')
    }
  }
  if (analysis?.openQuestions.length) {
    lines.push('## Open Questions', '')
    for (const q of analysis.openQuestions) lines.push(`- ${q}`)
    lines.push('')
  }
  download(`${name || 'story-map'}.md`, lines.join('\n'), 'text/markdown')
}
