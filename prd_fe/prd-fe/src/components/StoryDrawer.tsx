import { useState } from 'react'
import { ListChecks, Scissors, Wand2, X } from 'lucide-react'
import { refineStory } from '../api'
import type { Priority, Release, Story, StoryMap } from '../types'
import EditableText from './EditableText'

interface Loc {
  activityId: string
  stepId: string
  storyId: string
}

interface Props {
  storyMap: StoryMap
  loc: Loc
  onUpdate: (m: StoryMap) => void
  onClose: () => void
}

const REQ_TYPES = ['functional', 'business-rule', 'data', 'permission', 'validation', 'non-functional']

export default function StoryDrawer({ storyMap, loc, onUpdate, onClose }: Props) {
  const [aiBusy, setAiBusy] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  const activity = storyMap.activities.find((a) => a.id === loc.activityId)
  const step = activity?.steps.find((s) => s.id === loc.stepId)
  const story = step?.stories.find((s) => s.id === loc.storyId)
  if (!activity || !step || !story) return null

  const patchStory = (fn: (s: Story) => void) => {
    const copy: StoryMap = JSON.parse(JSON.stringify(storyMap))
    const st = copy.activities
      .find((a) => a.id === loc.activityId)!
      .steps.find((s) => s.id === loc.stepId)!
      .stories.find((s) => s.id === loc.storyId)!
    fn(st)
    onUpdate(copy)
  }

  const deleteStory = () => {
    const copy: StoryMap = JSON.parse(JSON.stringify(storyMap))
    const s = copy.activities.find((a) => a.id === loc.activityId)!.steps.find((s) => s.id === loc.stepId)!
    s.stories = s.stories.filter((x) => x.id !== loc.storyId)
    onUpdate(copy)
    onClose()
  }

  const moveToStep = (targetStepId: string) => {
    if (targetStepId === loc.stepId) return
    const copy: StoryMap = JSON.parse(JSON.stringify(storyMap))
    let moved: Story | undefined
    for (const a of copy.activities) {
      for (const s of a.steps) {
        const idx = s.stories.findIndex((x) => x.id === loc.storyId)
        if (idx >= 0) moved = s.stories.splice(idx, 1)[0]
      }
    }
    if (!moved) return
    for (const a of copy.activities) {
      const target = a.steps.find((s) => s.id === targetStepId)
      if (target) target.stories.push(moved)
    }
    onUpdate(copy)
    onClose()
  }

  const runAi = async (action: 'rewrite' | 'acceptance' | 'split') => {
    setAiBusy(action)
    setAiError(null)
    try {
      const { result } = await refineStory(story, action, `${activity.name} > ${step.name}`)
      if (action === 'split' && result.stories?.length) {
        const copy: StoryMap = JSON.parse(JSON.stringify(storyMap))
        const s = copy.activities.find((a) => a.id === loc.activityId)!.steps.find((s) => s.id === loc.stepId)!
        const idx = s.stories.findIndex((x) => x.id === loc.storyId)
        s.stories.splice(idx, 1, ...result.stories)
        onUpdate(copy)
        onClose()
      } else {
        patchStory((st) => {
          if (result.title) st.title = result.title
          if (result.story) st.story = result.story
          if (result.acceptanceCriteria) st.acceptanceCriteria = result.acceptanceCriteria
        })
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI request failed')
    } finally {
      setAiBusy(null)
    }
  }

  return (
    <aside className="drawer">
      <div className="drawer-head">
        <span className="muted small">{activity.name} › {step.name}</span>
        <button className="icon-btn" onClick={onClose}><X size={16} /></button>
      </div>

      <h2><EditableText value={story.title} onChange={(v) => patchStory((s) => { s.title = v })} /></h2>

      <label className="field-label">User story</label>
      <EditableText
        multiline
        value={story.story}
        placeholder="As a <persona>, I want <capability> so that <value>"
        onChange={(v) => patchStory((s) => { s.story = v })}
        className="story-text"
      />

      <div className="drawer-row">
        <label>
          Release
          <select value={story.release} onChange={(e) => patchStory((s) => { s.release = e.target.value as Release })}>
            <option value="mvp">MVP</option>
            <option value="later">Later</option>
          </select>
        </label>
        <label>
          Priority
          <select value={story.priority} onChange={(e) => patchStory((s) => { s.priority = e.target.value as Priority })}>
            <option value="must">Must</option>
            <option value="should">Should</option>
            <option value="could">Could</option>
          </select>
        </label>
        <label>
          Move to step
          <select value={loc.stepId} onChange={(e) => moveToStep(e.target.value)}>
            {storyMap.activities.flatMap((a) =>
              a.steps.map((s) => (
                <option key={s.id} value={s.id}>{a.name} › {s.name}</option>
              ))
            )}
          </select>
        </label>
      </div>

      <div className="ai-actions">
        <button className="btn small" disabled={!!aiBusy} onClick={() => runAi('rewrite')}>
          <Wand2 size={13} /> {aiBusy === 'rewrite' ? '…' : 'Rewrite'}
        </button>
        <button className="btn small" disabled={!!aiBusy} onClick={() => runAi('acceptance')}>
          <ListChecks size={13} /> {aiBusy === 'acceptance' ? '…' : 'Draft acceptance criteria'}
        </button>
        <button className="btn small" disabled={!!aiBusy} onClick={() => runAi('split')}>
          <Scissors size={13} /> {aiBusy === 'split' ? '…' : 'Split story'}
        </button>
      </div>
      {aiError && <div className="banner error">{aiError}</div>}

      <label className="field-label">Acceptance criteria</label>
      <ul className="editable-list">
        {story.acceptanceCriteria.map((ac, i) => (
          <li key={i}>
            <EditableText
              value={ac}
              onChange={(v) => patchStory((s) => { s.acceptanceCriteria[i] = v })}
            />
            <button className="icon-btn" onClick={() => patchStory((s) => { s.acceptanceCriteria.splice(i, 1) })}><X size={13} /></button>
          </li>
        ))}
      </ul>
      <button className="mini-btn" onClick={() => patchStory((s) => { s.acceptanceCriteria.push('New criterion') })}>
        + criterion
      </button>

      <label className="field-label">Requirements</label>
      <ul className="editable-list">
        {story.requirements.map((r, i) => (
          <li key={i}>
            <select
              className="req-type"
              value={r.type}
              onChange={(e) => patchStory((s) => { s.requirements[i].type = e.target.value })}
            >
              {REQ_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <EditableText value={r.text} onChange={(v) => patchStory((s) => { s.requirements[i].text = v })} />
            <button className="icon-btn" onClick={() => patchStory((s) => { s.requirements.splice(i, 1) })}><X size={13} /></button>
          </li>
        ))}
      </ul>
      <button
        className="mini-btn"
        onClick={() => patchStory((s) => { s.requirements.push({ type: 'functional', text: 'New requirement' }) })}
      >
        + requirement
      </button>

      <div className="drawer-footer">
        <button className="btn danger" onClick={deleteStory}>Delete story</button>
      </div>
    </aside>
  )
}
