# Deploying StoryMapper to Render

One Render **web service** hosts both the API and the built frontend, and a Render
**Postgres** database stores users and projects (the local file storage is only
used in development — Render's disk is ephemeral).

Everything is already wired: `render.yaml` (blueprint), `render-build.sh` (build),
Postgres support in the backend (auto-detected via `DATABASE_URL`).

## Prerequisites

- A GitHub account and a [Render](https://render.com) account (free tier is fine)
- Your AI keys (Groq / Gemini free; OpenAI / Anthropic optional paid fallbacks)

## Step 1 — Push the project to GitHub

```bash
cd "/Users/param/PRD tool"
git init
git add .
git commit -m "StoryMapper: PRD to story map tool"
# create an empty repo on github.com, then:
git remote add origin https://github.com/<your-username>/storymapper.git
git branch -M main
git push -u origin main
```

(`.gitignore` already excludes `node_modules`, `.env`, and local `data/`.)

## Step 2 — Create the Blueprint on Render

1. Go to **https://dashboard.render.com** → **New +** → **Blueprint**
2. Connect your GitHub account and pick the `storymapper` repo
3. Render reads `render.yaml` and shows two resources:
   - `storymapper` (web service, free plan)
   - `storymapper-db` (Postgres, free plan)
4. Click **Apply**

## Step 3 — Set the AI keys

During Blueprint creation (or later under *storymapper → Environment*), fill in:

| Variable | Required? | Where to get it |
|---|---|---|
| `GROQ_API_KEY` | recommended | https://console.groq.com/keys |
| `GEMINI_API_KEY` | recommended | https://aistudio.google.com/apikey |
| `OPENAI_API_KEY` | optional | https://platform.openai.com/api-keys |
| `ANTHROPIC_API_KEY` | optional | https://console.anthropic.com/settings/keys |

You can leave them all blank — users can paste their own keys in the app's
**Settings** dialog instead (keys then live in their browser).

`DATABASE_URL` and `AUTH_SECRET` are set automatically by the blueprint.

## Step 4 — Deploy & verify

Render builds (`render-build.sh`: backend deps + `vite build`) and starts the
service (`node server.js`). When it's live:

1. Open `https://storymapper.onrender.com` (or whatever URL Render assigned)
2. You should see the landing page → **Get started** → create an account
3. Paste a PRD → **Generate Story Map** → **Save**
4. The logs should show `Storage: Postgres (DATABASE_URL)` and `Postgres ready`

## Notes & gotchas

- **Free-tier spin-down**: Render free web services sleep after 15 min idle;
  the first request after that takes ~50s. Upgrade to Starter to avoid it.
- **Free Postgres expires after 30 days** on Render's free tier — upgrade the
  database (Starter) for permanent storage, or export your data before expiry.
- **Custom domain**: *storymapper → Settings → Custom Domains*.
- **Redeploys**: every `git push` to `main` auto-deploys.
- **Local dev is unchanged**: without `DATABASE_URL` the backend uses
  `prd_be/data/` files; `./start.sh` still runs everything locally.

## Manual alternative (no blueprint)

If you prefer clicking it together yourself:

1. **New + → PostgreSQL** → name `storymapper-db`, free plan → create; copy its
   **Internal Database URL**
2. **New + → Web Service** → pick the repo →
   - Runtime: Node
   - Build command: `./render-build.sh`
   - Start command: `cd prd_be && node server.js`
   - Health check path: `/api/providers`
3. Add environment variables: `DATABASE_URL` (the internal URL from step 1),
   `AUTH_SECRET` (any long random string), and your AI keys
