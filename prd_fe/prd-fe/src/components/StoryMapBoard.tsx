import { ListChecks, Package, Rocket, ScrollText } from 'lucide-react'
import type { Release, Story, StoryMap } from '../types'
import EditableText from './EditableText'

interface Props {
  storyMap: StoryMap
  onUpdate: (m: StoryMap) => void
  onSelectStory: (loc: { activityId: string; stepId: string; storyId: string }) => void
  selectedStoryId: string | null
}

function uid() {
  return crypto.randomUUID()
}

export default function StoryMapBoard({ storyMap, onUpdate, onSelectStory, selectedStoryId }: Props) {
  // Flatten steps across activities so we can lay everything on one grid:
  // row 1 activities (spanning their steps), row 2 steps, rows 3-4 release swimlanes.
  const flat = storyMap.activities.flatMap((act) =>
    act.steps.map((step) => ({ act, step }))
  )
  const nCols = Math.max(flat.length, 1)

  const patch = (fn: (m: StoryMap) => void) => {
    const copy: StoryMap = JSON.parse(JSON.stringify(storyMap))
    fn(copy)
    onUpdate(copy)
  }

  const renameActivity = (actId: string, name: string) =>
    patch((m) => { const a = m.activities.find((x) => x.id === actId); if (a) a.name = name })
  const renameStep = (actId: string, stepId: string, name: string) =>
    patch((m) => {
      const s = m.activities.find((x) => x.id === actId)?.steps.find((x) => x.id === stepId)
      if (s) s.name = name
    })
  const addStory = (actId: string, stepId: string, release: Release) =>
    patch((m) => {
      const s = m.activities.find((x) => x.id === actId)?.steps.find((x) => x.id === stepId)
      if (s)
        s.stories.push({
          id: uid(), title: 'New story', story: '', release,
          priority: 'should', acceptanceCriteria: [], requirements: [],
        })
    })
  const addStep = (actId: string) =>
    patch((m) => {
      const a = m.activities.find((x) => x.id === actId)
      if (a) a.steps.push({ id: uid(), name: 'New step', description: '', stories: [] })
    })
  const addActivity = () =>
    patch((m) => {
      m.activities.push({
        id: uid(), name: 'New activity', description: '',
        steps: [{ id: uid(), name: 'New step', description: '', stories: [] }],
      })
    })

  const storyCard = (actId: string, stepId: string, st: Story) => (
    <button
      key={st.id}
      className={`story-card ${st.release} ${selectedStoryId === st.id ? 'selected' : ''}`}
      onClick={() => onSelectStory({ activityId: actId, stepId, storyId: st.id })}
    >
      <span className="story-title">{st.title}</span>
      <span className="story-meta">
        <span className={`chip prio-${st.priority}`}>{st.priority}</span>
        {st.acceptanceCriteria.length > 0 && (
          <span className="chip icon-chip"><ListChecks size={11} /> {st.acceptanceCriteria.length}</span>
        )}
        {st.requirements.length > 0 && (
          <span className="chip icon-chip"><ScrollText size={11} /> {st.requirements.length}</span>
        )}
      </span>
    </button>
  )

  const swimlane = (release: Release, label: React.ReactNode) => (
    <>
      <div className={`lane-label ${release}`} style={{ gridColumn: `1 / span ${nCols}` }}>
        {label}
      </div>
      {flat.map(({ act, step }) => (
        <div key={`${release}-${step.id}`} className={`lane-cell ${release}`}>
          {step.stories.filter((s) => s.release === release).map((s) => storyCard(act.id, step.id, s))}
          <button className="add-story" onClick={() => addStory(act.id, step.id, release)}>
            + story
          </button>
        </div>
      ))}
    </>
  )

  return (
    <div className="board-scroll">
      <div className="board" style={{ gridTemplateColumns: `repeat(${nCols}, 250px)` }}>
        {/* Activities row */}
        {storyMap.activities.map((act) => (
          <div
            key={act.id}
            className="activity-cell"
            style={{ gridColumn: `span ${Math.max(act.steps.length, 1)}` }}
          >
            <EditableText value={act.name} onChange={(v) => renameActivity(act.id, v)} className="activity-name" />
            <button className="mini-btn" title="Add step" onClick={() => addStep(act.id)}>+ step</button>
          </div>
        ))}
        {/* Steps row */}
        {flat.map(({ act, step }) => (
          <div key={step.id} className="step-cell">
            <EditableText value={step.name} onChange={(v) => renameStep(act.id, step.id, v)} className="step-name" />
          </div>
        ))}
        {swimlane('mvp', <><Rocket size={13} /> MVP Release</>)}
        {swimlane('later', <><Package size={13} /> Later Release</>)}
      </div>
      <button className="btn ghost add-activity" onClick={addActivity}>+ Add activity</button>
    </div>
  )
}
