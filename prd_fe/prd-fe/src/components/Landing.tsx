import { BrainCircuit, Check, Link2, Lock, Map as MapIcon, Rocket, Sparkles, Wand2 } from 'lucide-react'
import { AzureDevOpsLogo, JiraLogo, MarkdownLogo, MondayLogo } from './BrandLogos'

interface Props {
  onGetStarted: () => void
  onSignIn: () => void
}

const FEATURES = [
  {
    icon: <BrainCircuit size={24} />,
    title: 'AI PRD Analysis',
    text: 'The agent reads your PRD and extracts personas, goals, user flows, edge cases and open questions — synthesis, not summary.',
  },
  {
    icon: <MapIcon size={24} />,
    title: 'Visual Story Map',
    text: 'Activities, journey steps and user stories laid out the way teams actually build software — the full narrative, end to end.',
  },
  {
    icon: <Rocket size={24} />,
    title: 'MVP Slicing',
    text: 'Stories arrive pre-sliced into MVP and Later swimlanes with must / should / could priorities, ready for scope decisions.',
  },
  {
    icon: <Wand2 size={24} />,
    title: 'AI Story Assist',
    text: 'Rewrite stories, draft Given/When/Then acceptance criteria, and split oversized stories with one click.',
  },
  {
    icon: <Link2 size={24} />,
    title: 'Push to Delivery Tools',
    text: 'Create epics and stories directly in Jira, Azure DevOps or monday.com — descriptions, acceptance criteria and all.',
  },
  {
    icon: <Lock size={24} />,
    title: 'Private Workspace',
    text: 'Your own account, your own projects. AI keys stay in your browser; delivery-tool credentials are never stored server-side.',
  },
]

const STEPS = [
  { title: 'Paste your PRD', text: 'Drop in raw text or upload a PDF or Markdown file. Messy is fine — the agent handles real-world docs.' },
  { title: 'AI builds the map', text: 'Two-stage pipeline: deep analysis first, then a full story map with requirements attached where they matter.' },
  { title: 'Refine & ship', text: 'Edit everything, slice the MVP, then export to Markdown/JSON or push straight into your delivery tool.' },
]

export default function Landing({ onGetStarted, onSignIn }: Props) {
  return (
    <div className="landing">
      <section className="landing-hero">
        <span className="hero-badge"><Sparkles size={13} /> AI-powered product discovery</span>
        <h1>
          From PRD to <span className="grad">Story Map</span>
          <br />in minutes, not meetings
        </h1>
        <p className="landing-sub">
          Stop transcribing requirements by hand. Let an AI agent turn your Product Requirements
          Document into a structured, editable user story map — then push it straight to Jira,
          Azure DevOps or monday.com.
        </p>
        <div className="landing-cta">
          <button className="btn primary large" onClick={onGetStarted}>Get started — it's free</button>
          <button className="btn ghost large" onClick={onSignIn}>Sign in</button>
        </div>
        <div className="trust-row">
          <span><Check size={14} /> Free-tier AI models</span>
          <span><Check size={14} /> No credit card</span>
          <span><Check size={14} /> Private workspace</span>
        </div>

        {/* stylized board preview */}
        <div className="preview-wrap">
        <div className="board-preview" aria-hidden="true">
          <div className="bp-row bp-activities">
            <div className="bp-activity">Discover</div>
            <div className="bp-activity wide">Purchase</div>
            <div className="bp-activity">Track</div>
          </div>
          <div className="bp-row bp-steps">
            <div className="bp-step">Browse</div>
            <div className="bp-step">Sign in</div>
            <div className="bp-step">Pay</div>
            <div className="bp-step">Orders</div>
          </div>
          <div className="bp-lane-label mvp">MVP</div>
          <div className="bp-row">
            <div className="bp-card mvp"><i>must</i>Search catalog</div>
            <div className="bp-card mvp"><i>must</i>Email sign-in</div>
            <div className="bp-card mvp"><i>must</i>Card payment</div>
            <div className="bp-card mvp"><i>should</i>Order status</div>
          </div>
          <div className="bp-lane-label later">Later</div>
          <div className="bp-row">
            <div className="bp-card later"><i>could</i>AI recommendations</div>
            <div className="bp-card later"><i>should</i>SSO / Google</div>
            <div className="bp-card later"><i>should</i>Wallets &amp; UPI</div>
            <div className="bp-card later"><i>could</i>Push alerts</div>
          </div>
        </div>
        </div>
      </section>

      <section className="landing-section">
        <h2>Everything a product team needs to go from document to delivery</h2>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature-card">
              <span className="feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <h2>How it works</h2>
        <div className="steps-row">
          {STEPS.map((s, i) => (
            <div key={s.title} className="step-block">
              <span className="num">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section integrations-section">
        <h2>Plays well with your delivery stack</h2>
        <p className="landing-sub">
          One click creates epics per activity and stories per card — with descriptions and
          acceptance criteria — inside the tools your team already lives in.
        </p>
        <div className="integration-logos">
          <div className="logo-pill"><JiraLogo size={20} /> Jira</div>
          <div className="logo-pill"><AzureDevOpsLogo size={20} /> Azure DevOps</div>
          <div className="logo-pill"><MondayLogo size={22} /> monday.com</div>
          <div className="logo-pill"><span className="md-logo"><MarkdownLogo size={26} /></span> Markdown / JSON</div>
        </div>
      </section>

      <section className="landing-final">
        <h2>Ready to map your next release?</h2>
        <p className="landing-sub">Free to use with free-tier AI models (Groq &amp; Gemini). Bring your own key.</p>
        <button className="btn primary large" onClick={onGetStarted}>Create your workspace</button>
      </section>

      <footer className="landing-footer muted small">
        PRD → Story Map · AI-assisted product discovery for PMs, POs and Scrum teams
      </footer>
    </div>
  )
}
