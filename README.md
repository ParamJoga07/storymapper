# PRD → Story Map

Turn a Product Requirements Document into an editable user story map with AI agents — then push it straight into Jira, Azure DevOps or monday.com.

**Pipeline:** paste/upload a PRD → AI extracts personas, goals, user flows and edge cases → AI builds the story map (Activities → Journey Steps → User Stories) with acceptance criteria, attached requirements and MVP vs Later release slicing → review, refine and export.

## Features

- **Landing page + user accounts**: email/password auth (scrypt-hashed, HMAC-signed tokens); every user has a private workspace of projects
- **Light & dark theme** with a one-click toggle (follows system preference by default)
- **PRD input**: paste text or upload `.pdf` / `.md` / `.txt` (server-side PDF extraction)
- **Two-stage AI pipeline**: analysis (personas, goals, flows, requirements, open questions) then story-map synthesis
- **Four AI providers**: Groq (`openai/gpt-oss-120b`, free) and Gemini (`gemini-3.8-flash`, free) first, with OpenAI (`gpt-4o-mini`) and Anthropic (`claude-sonnet-5`) as paid fallbacks when free tiers hit rate limits. Auto mode walks the chain Groq → Gemini → OpenAI → Anthropic; keys go in the UI **Settings** (stored in the browser) or in `prd_be/.env`
- **Visual story map board**: activities spanning steps, MVP/Later swimlanes, priority + AC + requirement badges, full inline editing, AI refine (rewrite / acceptance criteria / split)
- **Delivery-tool integrations** — one Epic per activity, one story per card, with descriptions and acceptance criteria:
  - **Jira** (site domain + email + API token + project key)
  - **Azure DevOps** (organization + project + PAT; falls back from User Story to Product Backlog Item for Scrum-process projects)
  - **monday.com** (API token + board ID; groups per activity, updates carry story details)
  - Credentials are sent per-request and never stored server-side; optionally remembered in the browser
- **Export**: Markdown and JSON downloads
- **Projects**: save/load/delete per user

## Setup

### 1. Get a free AI key (either works, both is best)

- Groq: https://console.groq.com/keys
- Gemini: https://aistudio.google.com/apikey

Put it in `prd_be/.env` (copy `.env.example`), **or** paste it in the app under ⚙ Settings.

### 2. Run

```bash
# backend
cd prd_be && npm install && npm start        # http://localhost:3001

# frontend (new terminal)
cd prd_fe/prd-fe && npm install && npm run dev   # http://localhost:5173
```

Or both at once from the repo root: `./start.sh`

### 3. Use

1. Open http://localhost:5173 → **Get started** → create your account
2. Paste or upload a PRD → **✨ Generate Story Map**
3. Refine the map (click cards, AI assist, MVP slicing)
4. **💾 Save**, export Markdown/JSON, or **🔗 Jira / Azure / monday** to create the epics and stories in your delivery tool

## Architecture

```
prd_fe/prd-fe   React 19 + Vite + TypeScript (proxy /api → :3001)
  src/components   Landing, AuthView, InputView, StoryMapBoard, StoryDrawer,
                   AnalysisPanel, ExportModal, SettingsModal, ProjectsView
  src/theme.ts     light/dark theme tokens + toggle
prd_be          Node + Express
  src/providers.js     Groq/Gemini clients, auto-fallback, JSON extraction
  src/pipeline.js      analyze + storymap + refine prompts and normalizers
  src/auth.js          register/login, scrypt hashing, signed tokens
  src/integrations.js  Jira / Azure DevOps / monday.com exporters
  src/store.js         per-user file-based project persistence
  data/                users.json, auth-secret, projects/ (gitignored)
```

## Deploying to Render

See **[RENDER_DEPLOY.md](RENDER_DEPLOY.md)** — a `render.yaml` blueprint deploys one web
service (API + built frontend) plus a managed Postgres database. The backend switches
from file storage to Postgres automatically when `DATABASE_URL` is set.
