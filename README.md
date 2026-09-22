# PRD Drafter

Turn a rough product idea into a structured, professional Product Requirements
Document.

You answer a seven-step guided interview. An LLM turns your answers into a
complete PRD — overview, personas, user stories, requirements, metrics, risks.
You review it in a section-based editor, hand-edit anything, regenerate single
sections, and come back to it later.

**The defining principle: the AI does not fabricate.** Every claim in a
generated PRD traces back to something you said. Where the model has to infer,
it records that inference as an explicit assumption instead of presenting it as
fact. It will not invent market sizes, percentages, competitor names, user
counts, or statistics you did not provide. A PRD full of confident-sounding
fake numbers is worse than no PRD.

> **Status:** in development. See [Implementation phases](#implementation-phases)
> for what works today.

---

## Architecture

```
┌─────────────────┐     JWT      ┌──────────────────┐
│  React + Vite   │─────────────>│  FastAPI         │
│  localhost:5173 │<─────────────│  localhost:8000  │
└────────┬────────┘              └────────┬─────────┘
         │                                │
         │ Supabase Auth                  │ Supabase client
         │ (signup/login only)            │ constructed with
         │                                │ the user's JWT
         v                                v
    ┌─────────────────────────────────────────┐
    │  Supabase — Postgres + Auth + RLS       │
    └─────────────────────────────────────────┘
                                          │
                                          v
                              ┌───────────────────────┐
                              │  AIProvider interface │
                              │  Claude/OpenAI/Gemini │
                              └───────────────────────┘
```

Two things are worth calling out, because they are load-bearing:

**The backend queries Postgres as the calling user, not as an admin.** Each
request builds a Supabase client from the caller's own JWT plus the anon key —
never the service role key. So Row Level Security, not application code, is
what stops user A reading user B's PRD. A forgotten `where user_id = ...` in
Python is then a bug, not a data breach.

**No AI API key ever reaches the browser.** Every provider call originates in
FastAPI. The frontend gets exactly three environment variables, all public by
design.

### Stack

| Layer | Choice |
|---|---|
| Frontend | React, Vite, TypeScript, React Router, TanStack Query, Tailwind CSS, shadcn/ui, Zod |
| Backend | Python 3.11+, FastAPI, Pydantic v2, `supabase-py`, `httpx`, `python-jose` |
| Database | Supabase Postgres with Row Level Security |
| AI | `anthropic`, `openai`, `google-generativeai` behind one interface |

---

## Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | 18+ | `node --version` |
| Python | 3.11+ | `python --version` |
| Git | any recent | `git --version` |
| A Supabase account | free tier is fine | [supabase.com](https://supabase.com) |
| One AI provider key | Anthropic, OpenAI, or Google | see [Switching AI providers](#switching-ai-providers) |

You do **not** need the Supabase CLI or Docker. Migrations can be pasted into
the web SQL editor.

---

## Local setup

Target: `git clone` to a running app in under 15 minutes.

### 1. Clone and create the Supabase project

```bash
git clone <this-repo>
cd PRD_Drafter
```

Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
Any region works; remember the database password (you will not need it here,
but losing it is annoying later).

### 2. Run the migrations

You need a Postgres with the schema applied. Pick one of three paths.

**Option A — fully local Supabase (no cloud account).** Needs Docker Desktop
running. This gives you real Postgres, real Auth and real RLS on your own
machine — the closest thing to production without signing up for anything:

```bash
npm install -g supabase
supabase init      # first time only
supabase start     # pulls images on first run, then prints your local keys
supabase db reset  # applies everything in supabase/migrations
```

`supabase start` prints an **API URL**, an **anon key** and a **JWT secret** —
those are the values for your `.env` files. Supabase Studio runs at
<http://localhost:54323>. Email confirmation is off by default locally, so
signup works immediately. Stop it with `supabase stop`.

**Option B — cloud SQL editor (no extra tooling).** In the dashboard, open
**SQL Editor → New query**. Paste and run these three files **in order**:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. `supabase/verify_setup.sql`  ← not a migration; a check

**Option C — cloud project via the CLI.**

```bash
npm install -g supabase
supabase link --project-ref <your-project-ref>
supabase db push
```

Then run `supabase/verify_setup.sql` in the SQL editor anyway.

#### Verify RLS — do not skip this

`verify_setup.sql` returns three result sets. Read all three:

1. **RLS enabled** — all three tables must say `true` / `OK`. The anon key is
   public, so a table without RLS is a table anyone on the internet can read.
2. **Policies** — expect 8 rows (2 `profiles`, 4 `prds`, 2 `prd_versions`).
3. **Triggers** — `on_auth_user_created` must exist, or new signups get no
   profile row.

### 3. Collect your credentials

All of these come from the Supabase dashboard:

| Value | Where to find it |
|---|---|
| Project URL | Project Settings → Data API → Project URL |
| Anon key | Project Settings → API Keys → `anon` / `public` |
| Service role key | Project Settings → API Keys → `service_role` |
| JWT secret | Project Settings → JWT Keys (only for legacy HS256 projects) |

The service role key is **not used by this MVP**. The variable exists so it is
documented; leaving it blank is fine.

### 4. Backend

```bash
cd backend
python -m venv .venv
```

Install dependencies:

```bash
# Windows
.venv\Scripts\pip install -r requirements.txt

# macOS / Linux
.venv/bin/pip install -r requirements.txt
```

Copy `backend/.env.example` to `backend/.env` and fill it in, then run:

```bash
# Windows
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000

# macOS / Linux
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

Check that <http://localhost:8000/api/health> returns `{"status":"ok",...}` and
<http://localhost:8000/api/health/db> returns `{"status":"ok","latency_ms":...}`.
Interactive API docs are at <http://localhost:8000/docs> in development.

If a required variable is missing, the process exits immediately with a message
naming it. That is deliberate — better than failing on the first request.

### 5. Frontend

```bash
cd frontend
npm install
npm run dev
```

Copy `frontend/.env.example` to `frontend/.env` and fill it in before starting
the dev server. Then open <http://localhost:5173>. The landing page shows a
**Local setup check** panel; both rows should be green.

### 6. Both at once

```bash
make dev        # macOS / Linux
.\dev.ps1       # Windows PowerShell
```

---

## Environment variables

### `backend/.env`

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_URL` | yes | Project Settings → Data API |
| `SUPABASE_ANON_KEY` | yes | Project Settings → API Keys |
| `SUPABASE_JWT_SECRET` | no | Legacy HS256 projects only. Modern projects sign with ES256 and the backend fetches the public key automatically |
| `SUPABASE_SERVICE_ROLE_KEY` | no | Unused in this MVP. Never log it, never send it to the browser |
| `AI_PROVIDER` | yes | `claude`, `openai`, or `gemini` |
| `ANTHROPIC_API_KEY` | if `claude` | [console.anthropic.com](https://console.anthropic.com) |
| `OPENAI_API_KEY` | if `openai` | [platform.openai.com](https://platform.openai.com) |
| `GEMINI_API_KEY` | if `gemini` | [aistudio.google.com](https://aistudio.google.com) |
| `AI_MODEL_OVERRIDE` | no | Pin a model id instead of the provider default |
| `AI_TIMEOUT_SECONDS` | no | Default `120` |
| `AI_MAX_RETRIES` | no | Default `1` |
| `CORS_ORIGINS` | no | Comma-separated. Default `http://localhost:5173` |
| `RATE_LIMIT_GENERATE_PER_HOUR` | no | Default `10` |
| `RATE_LIMIT_REGENERATE_PER_HOUR` | no | Default `40` |
| `LOG_LEVEL` | no | Default `INFO` |
| `ENVIRONMENT` | no | Default `development` |

Only the key matching `AI_PROVIDER` is required. Startup fails loudly if it is
absent.

### `frontend/.env`

| Variable | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | Same as backend |
| `VITE_SUPABASE_ANON_KEY` | yes | Same as backend |
| `VITE_API_BASE_URL` | yes | `http://localhost:8000` |

**Everything `VITE_`-prefixed is compiled into the JS bundle and is public.**
The anon key is safe to expose *only because RLS is enabled*. Never add an AI
key or the service role key here.

---

## Switching AI providers

Change one line in `backend/.env` and restart:

```
AI_PROVIDER=openai
```

No code changes anywhere. Each provider implements the same `AIProvider`
interface in `backend/app/ai/`, and **no code outside that directory imports a
provider SDK or names a provider**. That constraint is what makes the swap a
config change instead of a refactor.

---

## Running tests

```bash
# Backend  (Windows: .venv\Scripts\python)
cd backend && .venv/bin/python -m pytest

# Frontend
cd frontend && npm run test          # vitest
cd frontend && npm run type-check    # tsc --noEmit
cd frontend && npm run lint          # eslint

# Everything
make check
```

Generation tests use a `StubProvider`. No test ever calls a real AI API.

### The RLS test

`tests/test_rls.py` proves user A cannot read, update or delete user B's data.
It is the one test that cannot be faked — RLS is enforced by Postgres, so it
needs a real database. It is marked `integration` and **skips** when
`backend/.env` has no real credentials:

```bash
cd backend && .venv/bin/python -m pytest -m integration
```

Get a database first (see [Run the migrations](#2-run-the-migrations)); the
local `supabase start` option works fine for this. If these tests are skipping,
the ownership boundary is unverified — treat that as a gap, not a pass.

---

## Repository layout

```
frontend/   React + Vite app          (localhost:5173)
backend/    FastAPI app               (localhost:8000)
supabase/   Migrations + RLS check
```

### File ownership

Nobody edits a directory they do not own. Open an issue and tag the owner
instead.

| Area | Owner |
|---|---|
| `lib/types.ts`, `models/prd.py`, `sections.ts`, app shell, CI | Lead |
| `pages/Dashboard.tsx`, `components/dashboard/` | Dev A |
| `pages/Wizard.tsx`, `components/wizard/` | Dev B |
| `pages/Editor.tsx`, `components/editor/` | Dev C |
| `backend/ai/`, `services/generation_service.py` | Dev D |
| `backend/routers/`, `services/prd_service.py`, migrations | Lead + Dev D |

`frontend/src/lib/types.ts` and `backend/app/models/prd.py` are the contract
the whole team codes against. They must stay in sync, and they are **frozen
after Phase 2** — changes need lead approval.

`frontend/src/components/ui/` is generated by the shadcn CLI. Do not hand-edit
it; it is excluded from linting for that reason.

---

## Deployment

**Not configured, deliberately.** There is no `vercel.json`, no `Procfile`, no
Dockerfile, and no CI deploy step. Both halves run locally; Supabase is the
only hosted dependency.

Two constraints keep a future deploy straightforward, and the codebase already
respects both:

- **The two halves stay separately runnable**, each with its own dependency
  manifest and env file. No shared build step, no serving React from FastAPI.
- **The backend assumes a long-running process, not serverless.** PRD
  generation takes 30-90 seconds, past the execution ceiling of most serverless
  platforms. It is a normal `uvicorn` app and should stay one. Do not
  restructure generation into short-lived functions for a platform nobody has
  chosen yet.

---

## Troubleshooting

**Backend exits with a configuration error on startup**
A required variable is missing from `backend/.env`. The message names it. Check
you copied `.env.example` to `.env` and not the other way round.

**Frontend throws a configuration error on load**
`frontend/.env` is missing or incomplete. Vite only reads `.env` at startup, so
restart the dev server after editing it.

**CORS errors in the browser console**
The backend only allows origins listed in `CORS_ORIGINS`. Check that:

- The frontend is actually on `http://localhost:5173`. Vite is set to
  `strictPort`, so it fails rather than silently moving to 5174 — a shifted
  port looks exactly like a CORS bug.
- `CORS_ORIGINS` has no trailing slash. `http://localhost:5173/` will not match.
- You restarted the backend after editing `.env`.

**401 on every API call, or "Your session is invalid or has expired"**
Almost always the backend and frontend pointing at *different* Supabase
projects — check that `SUPABASE_URL` and `VITE_SUPABASE_URL` match exactly.

The backend verifies tokens two ways and picks based on the token's own `alg`
header:

- **ES256/RS256** (current Supabase) — fetches the public key from
  `/auth/v1/.well-known/jwks.json`. No secret needed. If `SUPABASE_URL` is
  wrong or unreachable, every token fails here.
- **HS256** (older projects) — verified against `SUPABASE_JWT_SECRET`. If your
  project is this vintage and the variable is blank, every token fails.

Setting `LOG_LEVEL=DEBUG` logs the reason a token was rejected; the client is
told only that the session is invalid, deliberately.

**Queries return nothing even though rows exist**
That is RLS doing its job. Either the request carried no JWT, or the rows
belong to a different user. Both are correct behaviour. Confirm with
`verify_setup.sql` that the policies exist, then check the request's
`Authorization` header.

**`/api/health/db` returns 503**
FastAPI cannot reach Supabase. Check `SUPABASE_URL` (full `https://` URL, no
trailing slash), that the project is not paused — free-tier projects pause
after inactivity — and that the migrations ran.

**`pg_trgm` extension error when running migration 001**
Your Postgres does not have the extension available. Delete the
`prds_title_trgm_idx` index from the migration; dashboard search falls back to
`ILIKE` without it.

**`npm run dev` fails because port 5173 is in use**
Something else holds the port. Stop it rather than switching ports — the
backend's CORS allowlist names 5173 specifically.

---

## Implementation phases

| Phase | Scope | Status |
|---|---|---|
| 0 | Environment check, `.gitignore` | Done |
| 1 | Scaffolding, health endpoints, migrations, RLS | Done |
| 2 | Shared type contract (`types.ts` and `prd.py`) | Done - **frozen** |
| 3 | Auth, `AuthGuard`, JWT verification, settings | Done - RLS verified against live Postgres |
| 4 | PRD CRUD and dashboard | Not started |
| 5 | Seven-step wizard with autosave | Not started |
| 6 | AI layer, four-group parallel generation | Not started |
| 7 | Section editor, regeneration, version history | Not started |
| 8 | Markdown export, rate limiting, tests, CI | Not started |
