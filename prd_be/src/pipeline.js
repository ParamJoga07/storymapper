// The PRD -> story map pipeline, following the practical prompt structure:
// Stage 1 (analyze): summarize goals + users, identify user journeys/flows.
// Stage 2 (storymap): group journeys into activities, break into ordered steps,
// write value-focused stories, attach requirements/edge cases, slice MVP vs later.

import { randomUUID } from 'node:crypto'
import { runPrompt } from './providers.js'

const MAX_PRD_CHARS = 60000

function clampPrd(text) {
  const t = (text || '').trim()
  if (!t) throw Object.assign(new Error('PRD text is empty'), { status: 400 })
  return t.length > MAX_PRD_CHARS ? t.slice(0, MAX_PRD_CHARS) + '\n\n[PRD truncated]' : t
}

const ANALYZE_SYSTEM = `You are a senior product discovery assistant. You read Product Requirement Documents (PRDs) and extract their hidden narrative structure. You always respond with a single valid JSON object and nothing else. Do not repeat the PRD; synthesize it.`

function analyzeUserPrompt(prd) {
  return `Analyze the PRD below. Extract:
1. A concise product summary and the core problem statement.
2. User types / personas (with goals and pain points). Infer them if not explicit.
3. Product goals and success criteria.
4. The main user journeys (flows). Look for verbs, triggers, outcomes and dependencies. Classify each flow as one of: "sequential", "decision", "recovery", "conditional", "repeatable". Include alternate paths, error/recovery states, and edge cases hidden in the margins of the document.
5. Explicit functional requirements and constraints.
6. Assumptions and open questions worth challenging.

Respond with EXACTLY this JSON shape:
{
  "summary": "string",
  "problemStatement": "string",
  "personas": [{ "name": "string", "description": "string", "goals": ["string"], "painPoints": ["string"] }],
  "goals": ["string"],
  "flows": [{ "name": "string", "type": "sequential|decision|recovery|conditional|repeatable", "persona": "string", "steps": ["string"], "edgeCases": ["string"] }],
  "requirements": ["string"],
  "openQuestions": ["string"]
}

PRD:
"""
${prd}
"""`
}

const STORYMAP_SYSTEM = `You are a senior product manager building a user story map from a PRD and its analysis. A story map is a hierarchy: Activities (broad user goals, the "why") -> Steps (stages of the journey in the order users perform them, the "how") -> User Stories (smallest slices of deliverable value). Do not mirror the PRD sentence by sentence — reorganize it into a product narrative that supports planning and prioritization. Always respond with a single valid JSON object and nothing else.`

function storymapUserPrompt(prd, analysis) {
  return `Using the PRD and the analysis below, build the story map.

Rules:
- 3 to 6 activities, each covering a meaningful user goal, ordered left-to-right as the user experiences the product.
- Each activity has 2 to 5 steps in the order users perform them.
- Each step has 1 to 4 user stories. Each story is small enough to build and test.
- Story format: "As a <persona>, I want <capability> so that <value>".
- Attach requirements to the story where they matter (types: "functional", "business-rule", "data", "permission", "validation", "non-functional").
- Include recovery/error and alternate-path stories where the PRD implies them; do not ignore exception handling.
- Slice releases: "mvp" for stories essential to the core journey, "later" for enhancements.
- Priority: "must", "should", "could".
- Each story gets 2 to 4 testable acceptance criteria.

Respond with EXACTLY this JSON shape:
{
  "activities": [{
    "name": "string",
    "description": "string",
    "steps": [{
      "name": "string",
      "description": "string",
      "stories": [{
        "title": "short label",
        "story": "As a ..., I want ... so that ...",
        "release": "mvp|later",
        "priority": "must|should|could",
        "acceptanceCriteria": ["string"],
        "requirements": [{ "type": "functional|business-rule|data|permission|validation|non-functional", "text": "string" }]
      }]
    }]
  }]
}

ANALYSIS:
${JSON.stringify(analysis, null, 2)}

PRD:
"""
${prd}
"""`
}

function normalizeAnalysis(j) {
  return {
    summary: j.summary || '',
    problemStatement: j.problemStatement || '',
    personas: (j.personas || []).map((p) => ({
      name: p.name || 'User',
      description: p.description || '',
      goals: p.goals || [],
      painPoints: p.painPoints || [],
    })),
    goals: j.goals || [],
    flows: (j.flows || []).map((f) => ({
      name: f.name || 'Flow',
      type: f.type || 'sequential',
      persona: f.persona || '',
      steps: f.steps || [],
      edgeCases: f.edgeCases || [],
    })),
    requirements: j.requirements || [],
    openQuestions: j.openQuestions || [],
  }
}

function normalizeStoryMap(j) {
  const activities = (j.activities || []).map((a) => ({
    id: randomUUID(),
    name: a.name || 'Activity',
    description: a.description || '',
    steps: (a.steps || []).map((s) => ({
      id: randomUUID(),
      name: s.name || 'Step',
      description: s.description || '',
      stories: (s.stories || []).map((st) => ({
        id: randomUUID(),
        title: st.title || 'Story',
        story: st.story || '',
        release: st.release === 'later' ? 'later' : 'mvp',
        priority: ['must', 'should', 'could'].includes(st.priority) ? st.priority : 'should',
        acceptanceCriteria: st.acceptanceCriteria || [],
        requirements: (st.requirements || []).map((r) => ({
          type: r.type || 'functional',
          text: r.text || String(r),
        })),
      })),
    })),
  }))
  if (activities.length === 0) {
    throw Object.assign(new Error('Model returned an empty story map — try again or switch provider'), { status: 502 })
  }
  return { activities }
}

export async function analyzePrd({ keys, provider, prdText }) {
  const prd = clampPrd(prdText)
  const { json, provider: used } = await runPrompt({
    keys,
    provider,
    system: ANALYZE_SYSTEM,
    user: analyzeUserPrompt(prd),
  })
  return { analysis: normalizeAnalysis(json), provider: used }
}

export async function buildStoryMap({ keys, provider, prdText, analysis }) {
  const prd = clampPrd(prdText)
  const { json, provider: used } = await runPrompt({
    keys,
    provider,
    system: STORYMAP_SYSTEM,
    user: storymapUserPrompt(prd, analysis),
    maxTokens: 8192,
  })
  return { storyMap: normalizeStoryMap(json), provider: used }
}

const REFINE_ACTIONS = {
  rewrite: `Rewrite this user story to be clearer and value-focused, keeping "As a ..., I want ... so that ..." format. Improve the title too. Respond with JSON: {"title": "string", "story": "string"}`,
  acceptance: `Write 3-5 concise, testable acceptance criteria for this user story (Given/When/Then style where natural). Respond with JSON: {"acceptanceCriteria": ["string"]}`,
  split: `This story may be too big. Split it into 2-3 smaller independently deliverable stories. Respond with JSON: {"stories": [{"title": "string", "story": "string", "release": "mvp|later", "priority": "must|should|could", "acceptanceCriteria": ["string"], "requirements": []}]}`,
}

export async function refineStory({ keys, provider, story, action, context }) {
  const instruction = REFINE_ACTIONS[action]
  if (!instruction) throw Object.assign(new Error(`Unknown refine action: ${action}`), { status: 400 })
  const { json, provider: used } = await runPrompt({
    keys,
    provider,
    system: 'You are a product management assistant refining user stories on a story map. Always respond with a single valid JSON object.',
    user: `${instruction}

Story map context (activity > step): ${context || 'n/a'}

Story:
${JSON.stringify(story, null, 2)}`,
    maxTokens: 2048,
  })
  if (action === 'split') {
    json.stories = (json.stories || []).map((st) => ({
      id: randomUUID(),
      title: st.title || 'Story',
      story: st.story || '',
      release: st.release === 'later' ? 'later' : 'mvp',
      priority: ['must', 'should', 'could'].includes(st.priority) ? st.priority : 'should',
      acceptanceCriteria: st.acceptanceCriteria || [],
      requirements: st.requirements || [],
    }))
  }
  return { result: json, provider: used }
}
