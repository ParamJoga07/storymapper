export interface Persona {
  name: string
  description: string
  goals: string[]
  painPoints: string[]
}

export interface Flow {
  name: string
  type: 'sequential' | 'decision' | 'recovery' | 'conditional' | 'repeatable' | string
  persona: string
  steps: string[]
  edgeCases: string[]
}

export interface Analysis {
  summary: string
  problemStatement: string
  personas: Persona[]
  goals: string[]
  flows: Flow[]
  requirements: string[]
  openQuestions: string[]
}

export type Release = 'mvp' | 'later'
export type Priority = 'must' | 'should' | 'could'

export interface Requirement {
  type: string
  text: string
}

export interface Story {
  id: string
  title: string
  story: string
  release: Release
  priority: Priority
  acceptanceCriteria: string[]
  requirements: Requirement[]
}

export interface Step {
  id: string
  name: string
  description: string
  stories: Story[]
}

export interface Activity {
  id: string
  name: string
  description: string
  steps: Step[]
}

export interface StoryMap {
  activities: Activity[]
}

export interface ProjectSummary {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface Project extends ProjectSummary {
  prdText: string
  analysis: Analysis | null
  storyMap: StoryMap | null
}

export interface Settings {
  provider: 'auto' | 'groq' | 'gemini' | 'openai' | 'anthropic'
  groqKey: string
  geminiKey: string
  openaiKey: string
  anthropicKey: string
}

export interface User {
  id: string
  email: string
  name: string
}

export type IntegrationTool = 'jira' | 'azure' | 'monday'

export interface ExportResult {
  created: { type: string; title: string; key: string; url?: string }[]
  errors: string[]
}
