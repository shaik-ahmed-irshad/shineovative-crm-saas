# Shineovative WhatsApp CRM — Local Testing Guide

This guide is for running and testing the CRM from this repository on a Windows development machine. The app is a Next.js 16 + React 19 frontend/server application backed by Supabase Auth, Postgres, Storage, and Realtime.

## 1. What you need

- Node.js 20.9 or newer. This checkout currently runs with Node `v24.17.0` and npm `11.13.0`.
- A Supabase project. Use either:
  - a hosted Supabase project for the quickest UI and data test, or
  - Supabase Local, which also requires Docker Desktop.
- Meta WhatsApp Cloud API credentials only if you want to test live WhatsApp inbound/outbound messaging.
- An OpenAI or Anthropic key only if you want to exercise the AI Assistant against a real provider.

The repository contains 40 ordered migrations (`001` through `040`). It does not contain a seed SQL file or a Playwright test runner in the current checkout, so a fresh database will need a test user and test records created manually or through your own seed data.

## 2. Install dependencies

From the repository root:

```powershell
cd C:\Users\HP\Desktop\Shinovative\crm-wa.shineovative.com
npm ci
```

`npm ci` installs the exact versions in `package-lock.json`.

## 3. Configure environment variables

Copy the template:

```powershell
Copy-Item .env.local.example .env.local
```

Open `.env.local` and set these required values:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ENCRYPTION_KEY=...
META_APP_SECRET=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_APP_LOCALE=en
```

Generate a safe local encryption key with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

For local UI testing without real Meta credentials, add:

```env
WHATSAPP_TEMPLATES_DRY_RUN=true
```

Never commit `.env.local` or expose `SUPABASE_SERVICE_ROLE_KEY` in browser code. `NEXT_PUBLIC_*` values are public and are embedded into the client build; server-only values are not.

## 4. Choose a database setup

### Option A — Hosted Supabase (quickest)

Create or use a development Supabase project, copy its API URL, anon key, and service-role key into `.env.local`, then apply the migrations using the Supabase CLI:

```powershell
npx supabase db push --db-url "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres"
```

Alternatively, run the SQL files in `supabase/migrations/` in order using the Supabase SQL editor. Do not use production credentials for local testing.

Create a development Auth user in Supabase Dashboard → Authentication → Users. Public self-signup is intentionally disabled in this build (`src/config/product.ts`), so the normal `/signup` page shows “Invitation Required”. New Auth users are bootstrapped into an account/profile by the migration trigger.

### Option B — Supabase Local (fully local backend)

Install Docker Desktop and the Supabase CLI, then run from the repository root:

```powershell
supabase start
supabase status
supabase db reset
```

Use the local API URL, anon key, and service-role key printed by `supabase status` in `.env.local`. This repository config uses these local ports:

- Supabase API: `http://127.0.0.1:54331`
- Postgres: `127.0.0.1:54332`
- Studio: `http://127.0.0.1:54333`

Create a local Auth user in Studio → Authentication → Users, or through the local Supabase Auth admin UI. Then restart the Next.js process after changing `.env.local`.

The included `Dockerfile` and `docker-compose.yml` run only the Next.js app; they do not run Postgres or Supabase. Docker Compose is therefore an optional production-like app test, not a complete database stack.

## 5. Start the app

Development mode uses Next.js Turbopack and compiles routes as you visit them:

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Expected unauthenticated behavior:

- `/` → redirects to `/dashboard`
- `/dashboard` → redirects to `/login`
- `/login` → login form
- `/forgot-password` → password recovery form
- `/signup` → invitation-only notice

Keep the terminal running while testing. Press `Ctrl+C` to stop it.

## 6. Automated validation commands

Run these from a second terminal:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

What each command checks:

- `npm run lint` — ESLint. Current baseline: 0 errors and some existing warnings.
- `npm run typecheck` — TypeScript without emitting files.
- `npm test` — Vitest unit/integration-style tests; the current checkout passed 80 test files and 834 tests.
- `npm run build` — production Next.js build. It requires valid placeholder Supabase/server environment variables and network access to fetch the Google Fonts used by `next/font`.

For a production-mode local run:

```powershell
npm run build
npm run start
```

## 7. User acceptance test (UAT) checklist

Use a development account and development database. For every data-changing step, refresh the page and confirm the result persists.

1. **Authentication** — Sign in, confirm redirect to `/dashboard`, open `/forgot-password`, and verify `/signup` is invitation-only.
2. **Dashboard** — Confirm analytics cards and activity data load without Supabase permission errors.
3. **Inbox** — Open a conversation, send or draft a reply, change assignment/status, add a note, use filters, and schedule/reschedule/complete/clear a follow-up.
4. **Contacts** — Create/edit a contact, add tags and custom fields, import a small CSV, search/filter, and confirm duplicate phone handling.
5. **Deals** — Create a deal from a conversation, confirm contact/conversation context is prefilled, move the deal between Kanban stages, and refresh.
6. **Campaigns** — Create a broadcast, choose an approved template or local dry-run template, select an audience, preview variables, and verify campaign history. Do not send to real customers from a dev account.
7. **Automations** — Create a rule, select a trigger and action, enable/disable it, run the relevant event, and inspect execution logs.
8. **Flows** — Create or load a flow, add/connect nodes in the visual builder, validate and activate it, then inspect flow runs. The sidebar marks Flows as Beta.
9. **AI Assistant** — Open `/agents`, configure a per-account provider key only if authorized, test the playground, add a knowledge item, reindex it, and try a draft reply. Without a provider key, verify the configuration UI and safe error state only.
10. **Settings and team** — Test profile, password/security, appearance, WhatsApp configuration, templates, quick replies, fields/tags, deals/currency, team roles/invitations, and API key creation/revocation.
11. **Tenant isolation** — With two development accounts, confirm Account B cannot see Account A’s contacts, conversations, deals, or follow-ups.
12. **Responsive layout** — Repeat the inbox, deals, and settings checks at approximately 1440px, 1024px, 768px, and 390px wide.

## 8. Features visible in the application

The current product configuration enables AI Assistant, Campaigns, Automations, Flows, API keys, and MCP support. Public self-signup is disabled.

- **Dashboard** — response/volume metrics, open deal value, and cross-module activity.
- **Inbox** — shared WhatsApp conversation workspace, assignment, statuses, unread state, notes, media, reactions, quick replies, follow-ups, and conversation-to-deal creation.
- **Notifications** — unread notifications and notification state.
- **Contacts** — contacts, tags, custom fields, CSV import, searching/filtering, and deduplication.
- **Deals** — sales pipelines and Kanban deals linked to contacts/conversations.
- **Campaigns** — WhatsApp broadcasts, approved templates, audience selection, personalization, scheduling, delivery/read/reply tracking, retry/resume behavior, and dry-run protection.
- **Automations** — no-code triggers, conditions, waits, tags, webhooks, replies, and execution logs.
- **Flows** — visual conversational flow builder, validation, activation, and run history.
- **AI Assistant** — BYO-key configuration, playground, knowledge base, embeddings/reindexing, draft replies, auto-reply, usage, and human handoff.
- **Settings** — profile, security, appearance, WhatsApp connection, templates, quick replies, fields/tags, deals/currency, team members/roles, and API keys.
- **Public REST API** — scoped API keys for `/api/v1`; see `docs/public-api.md`.
- **MCP server** — optional separate package under `mcp-server/`; see `docs/mcp.md`.

## 9. What needs real external services

- Auth, database reads/writes, RLS, Storage, and Realtime require a working Supabase project or Supabase Local.
- Live WhatsApp inbound/outbound messages require Meta App/WABA credentials, a configured webhook URL, and a test phone number. Localhost is not directly reachable by Meta without a secure tunnel or public URL.
- Broadcast template submission can be exercised with `WHATSAPP_TEMPLATES_DRY_RUN=true`; live Meta template sync/submission cannot be fully verified without Meta credentials.
- AI drafting/auto-reply requires an authorized account-level OpenAI or Anthropic key configured in Settings → AI Assistant.
- Scheduled automation/flow Wait steps require a scheduler to call the cron endpoints; see `.env.local.example` and the automation documentation.
- Team invitation email delivery depends on the Supabase Auth email configuration. For local testing, inspect the local email catcher if enabled by your Supabase setup.

## 10. Troubleshooting

- **Supabase connection or “not linked to an account”** — verify all three Supabase variables, confirm migrations were applied, and confirm the Auth user has a generated profile/account.
- **Every write fails** — check that the signed-in user has an account role and that the latest account-sharing migrations were applied.
- **Templates fail without Meta** — set `WHATSAPP_TEMPLATES_DRY_RUN=true` for local-only template testing.
- **Production build cannot fetch fonts** — rerun with network access, or use a network where `fonts.googleapis.com` is reachable; this is a build-environment dependency from `next/font`.
- **Changes to public Supabase variables are ignored after `npm run build`** — rebuild because `NEXT_PUBLIC_*` values are embedded at build time.
- **Docker commands fail** — install/start Docker Desktop. The current checkout does not include Docker or the Supabase CLI by default.

## 11. Existing QA evidence

The repository includes prior browser/regression evidence under:

- `docs/qa/browser-qa/BROWSER_QA_STAGE3_STAGE4.md`
- `docs/qa/stage-5/STAGE5_QA_REPORT.md`
- `docs/deployment/PRODUCTION_SMOKE_TEST.md`

Those reports document successful local checks for inbox messaging, filters, follow-ups, deals, campaigns, automations, flows, AI configuration, account isolation, and responsive layouts. They also record that live Meta credentials were not available for the local dry-run environment.
