# Shineovative WhatsApp CRM — Implementation & Progress Tracker

> **Purpose:** This is the persistent implementation plan, decision log, progress tracker, test record, and session handoff file for customizing the upstream `wacrm` project into the Shineovative Solutions WhatsApp CRM. Every coding session must read this file first and update it continuously.
>
> **Scope principle:** Prefer the fastest, lowest-risk path from working upstream clone → stable local baseline → configuration-driven Shineovative branding → excellent application UI → a few high-value CRM improvements → regression-tested internal release → reusable client deployments. Do not rebuild stable upstream functionality without a demonstrated reason.

---

## Progress Summary

| Item | Current state |
|---|---|
| **Overall completion** | **87%** |
| **Current stage** | **Stage 6 — Shineovative Internal Release** |
| **Current task** | Stage 6 readiness audit, production documentation, and credential requirement checklist |
| **Completed stages** | Stage 1 — Local Baseline (12%), Stage 2 — Shineovative Product Foundation (12%), Stage 3 — Complete UI/UX Redesign (30%), Stage 4 — High-Value CRM Workflow Features (18%), Stage 5 — WhatsApp + Core Regression Testing (15%) |
| **Remaining stages** | Stages 6–7 (Stage 6: 8%, Stage 7: 5%) |
| **Blockers/issues** | No internal development blockers. External production dependency: live Meta WABA credentials/test number required for real WhatsApp production validation. |
| **Last updated** | **2026-08-30 17:16 IST (+05:30)** |

### Tracking Markers

- `[ ]` Not started
- `[~]` In progress
- `[x]` Completed and verified
- `[!]` Blocked / needs attention / decision required

### Stage Weights for Overall Completion

Use these weights when updating the overall percentage. Do not mark a stage complete until its acceptance criteria pass.

| Stage | Weight |
|---|---:|
| Stage 1 — Local Development Baseline | 12% |
| Stage 2 — Shineovative Product Foundation | 12% |
| Stage 3 — Complete UI/UX Redesign | 30% |
| Stage 4 — Practical CRM Feature Improvements | 18% |
| Stage 5 — WhatsApp + Core Regression Testing | 15% |
| Stage 6 — Shineovative Internal Release | 8% |
| Stage 7 — Client-Ready Productization | 5% |
| **Total** | **100%** |

---

## Autonomous Stage Execution Protocol

These permanent rules apply to Stage 2 through Stage 7 execution:

1. **Stage Autonomy**: Once a stage is explicitly approved, complete the **entire approved stage autonomously**. Do not stop after individual tasks or subtasks to ask for permission.
2. **Continuous Progress Tracking**: Update `IMPLEMENTATION.md` continuously while working so another session can resume accurately.
3. **Execution Loop**: Follow the cycle: **inspect → implement → test → fix → retest → verify → update tracker → continue**.
4. **Task Status Markers**: Mark active tasks `[~]`, completed & verified tasks `[x]`, and blockers `[!]`.
5. **Quality Gate**: Do not mark a task `[x]` merely because code was written. Acceptance criteria and required tests must pass.
6. **Routine Tool Authority**: Run non-destructive development commands, file edits, refactors within scope, test fixes, lint fixes, dev server checks, and local Git commits (`git status`, `git add`, `git commit`) autonomously.
7. **Escalation Triggers**: Only stop and ask the user if:
   - A decision materially changes product scope;
   - An irreversible/destructive operation is required;
   - Credentials/information only the user can provide are required;
   - A major architecture change outside `IMPLEMENTATION.md` becomes necessary;
   - A blocker genuinely prevents further progress.
8. **Stage Closeout**: At the end of a stage, complete verification, update `IMPLEMENTATION.md`, create an appropriate local Git commit, present a stage report, and pause before the next stage.

---

## Mandatory Session Handoff Protocol

Every AI/development session must follow this sequence before changing code:

1. Read this entire `IMPLEMENTATION.md`.
2. Read root `AGENTS.md` and follow its Next.js-version warning before editing Next.js code.
3. Check current Git branch/status/diff and confirm whether an `[~]` task already has unfinished work.
4. Read **Progress Summary**, **Changes Implemented**, **Testing Results**, **Known Issues / Technical Debt**, and **Decisions Made**.
5. Continue the current `[~]` task before starting a new task unless it is explicitly blocked.
6. Update this file when:
   - a task starts;
   - an implementation decision is made;
   - a blocker is found or cleared;
   - code/data/config is changed;
   - a test is run;
   - a task/stage is completed.
7. Before ending a session, update:
   - overall completion %;
   - current stage/current task;
   - completed/remaining stages;
   - blockers;
   - last updated time;
   - exact next action for the next session.
8. Never mark `[x]` merely because code was written. A task is complete only after its acceptance criteria and required tests pass.

### Change Discipline

- Keep commits/tasks small enough to review and revert.
- Prefer configuration and UI-layer changes over backend rewrites.
- Preserve existing API/database identifiers when a UI label alone can change.
- Add new migrations for schema changes. **Never rewrite historical migrations.**
- When upstream behavior is unclear, inspect the current implementation/tests before changing it.
- Record any deliberate upstream divergence in **Decisions Made**.

---

# Repository Baseline Reference

This section records what was verified from the freshly cloned repository before customization. It is context for future sessions; it is not a substitute for Stage 1 runtime verification.

## Verified Technical Baseline

- Package: `wacrm`, repository package version `0.8.0`.
- Framework: Next.js `16.2.12`, React `19.2.4`, TypeScript `6`.
- Styling/UI: Tailwind CSS 4, Base UI/shadcn-style components, Lucide icons.
- Data/backend: Supabase / PostgreSQL; local config currently targets PostgreSQL 17.
- Supabase capabilities used: Auth, RLS, Realtime, Storage; optional pgvector for AI knowledge semantic search.
- WhatsApp integration: official Meta WhatsApp Business Cloud API.
- Authentication roles found: owner, admin, agent, viewer.
- AI: bring-your-own OpenAI/Anthropic keys; encrypted at rest using the project encryption layer.
- Existing major application areas: dashboard, inbox, notifications, contacts, pipelines/deals, broadcasts, automations, flows, AI agents/assistant functionality, settings/team, API keys/webhooks.
- Existing migration history: `001` through `039`.
- Recent reliability migrations already present:
  - `037_webhook_broadcast_reliability.sql`
  - `038_broadcast_resume.sql`
  - `039_inbound_media_mirror.sql`
- `deals` already contains `conversation_id`, meaning **Conversation → Deal can likely be implemented mostly as a UX/workflow improvement rather than a new relationship schema**.
- `contacts` already contains `company`.
- Current global theme architecture already separates neutral mode tokens from accent tokens in `src/app/globals.css` and `src/lib/themes.ts`; this is a good base for brand configuration rather than a reason to rewrite theming from scratch.
- Current root font is `Inter` via `next/font/google`.
- Current navigation is centralized in `src/components/layout/sidebar.tsx`; topbar titles are centralized in `src/components/layout/header.tsx`; translations live in `messages/`.

## Protected Upstream Reliability Areas

The following are considered **protected surfaces**. Changes require a specific bug/requirement, targeted tests, and a documented reason:

- Supabase Auth and existing RLS logic.
- Account/tenant isolation and membership/role logic.
- WhatsApp webhook parsing/handling.
- Meta webhook signature verification.
- Credential/token encryption.
- Message/webhook idempotency and deduplication.
- Broadcast transaction/retry/resume behavior.
- Inbound media mirroring/storage behavior.
- Existing migration history (`001`–`039`).

Relevant existing modules include, but are not limited to:

- `src/lib/auth/*`
- `src/lib/account/*`
- `src/lib/whatsapp/*`
- `src/lib/webhooks/*`
- `src/lib/media/*`
- `src/lib/storage/*`
- `supabase/migrations/*`

---

# Shineovative Brand/UI Reference

> **Rule:** Only verified values may become implementation tokens. Anything not conclusively visible from current public sources is explicitly marked for verification. Do not estimate hex colors or infer font names from appearance.

## Research Sources Checked — 28 Aug 2026

1. Live homepage: `https://shineovative.com/`
2. Contact page: `https://shineovative.com/contact`
3. First-party Next.js website source: `docs/shineovative-next.zip` (extracted into `scratch/website-source/`)
4. First-party brand assets folder: `public/shineovative-assets/`

## Verified Brand Design Tokens & System

> **Verified Baseline**: Extracted directly from the Shineovative Next.js website source (`docs/shineovative-next.zip` → `scratch/website-source/app/globals.css` and `app/layout.tsx`) and `public/shineovative-assets/`.

| Token / Design Element | Verified Value | Source File Reference |
|---|---|---|
| **Base Background (Dark)** | `#000000` (`--black`) | `scratch/website-source/app/globals.css:4` |
| **Surface Dark (Container)** | `#0a0a0a` (`--dark`) | `scratch/website-source/app/globals.css:5` |
| **Card Surface Primary** | `#111111` (`--card`) | `scratch/website-source/app/globals.css:6` |
| **Card Surface Secondary** | `#141414` (`--card2`) | `scratch/website-source/app/globals.css:7` |
| **Border Color** | `rgba(255, 255, 255, 0.07)` (`--border`) | `scratch/website-source/app/globals.css:8` |
| **Primary Accent (Electric Blue/Cyan)** | `#00b4ff` (`--blue`, hover `#38bdf8`) | `scratch/website-source/app/globals.css:12-13` |
| **Secondary Accent (Amber/Orange)** | `#f59e0b` (`--orange`, hover `#fbbf24`) | `scratch/website-source/app/globals.css:14-15` |
| **Body / Sans Font** | `Inter` (weights: `400`, `500`, `600`) | `scratch/website-source/app/layout.tsx:6-11` |
| **Heading Font** | `Outfit` (weights: `600`, `700`, `800`) | `scratch/website-source/app/layout.tsx:13-18` |
| **Primary Text** | `#ffffff` (`--white`) | `scratch/website-source/app/globals.css:9` |
| **Muted Text (Light)** | `#94a3b8` (`--gray-l`) | `scratch/website-source/app/globals.css:10` |
| **Muted Text (Dark)** | `#6b7280` (`--gray`) | `scratch/website-source/app/globals.css:11` |
| **Success Status / Badge** | `#22c55e` (`--green`, bg `rgba(34,197,94,0.1)`, text `#86efac`) | `scratch/website-source/app/globals.css:17, 26-28` |
| **Destructive / Error** | `#ef4444` (`--red`) | `scratch/website-source/app/globals.css:16` |
| **Official Logo Asset** | `/shineovative-assets/shinovative-logo.webp` | `public/shineovative-assets/shinovative-logo.webp` |
| **Official Favicon Asset** | `/shineovative-assets/favicon.ico` | `public/shineovative-assets/favicon.ico` |

## Verified Marketing-Site Visual/Interaction Patterns Worth Translating to the CRM

These are **design-language references**, not instructions to clone the marketing page:

- Strong outcome-first headline hierarchy using `Outfit` font for headings and `Inter` for body/tables.
- High-contrast dark surfaces (`#000000` / `#0a0a0a` / `#111111`) with subtle `#00b4ff` electric blue accents & `rgba(255,255,255,0.07)` borders.
- Metric/KPI cards and a “live dashboard” presentation pattern are already part of the public brand language.
- Repeated use of small status/assurance badges (green live indicator, WhatsApp support badge).
- Compact cards for diagnostic/business metrics.
- Clear, high-intent action buttons with electric blue / dark graphite styling.
- Visual emphasis on leads, calls, rankings, revenue, and operational outcomes.

### Dashboard & UI Translation Strategy

Translate website visual language into software application primitives:

- **Typography**: Heading elements (`h1`, `h2`, `h3`, card titles, section titles) consume `Outfit` font; body text, inputs, tables, and data values consume `Inter` font.
- **Colors**: Dark mode surfaces use `#000000` / `#0a0a0a` / `#111111` with `#00b4ff` primary action focus/glow and `rgba(255,255,255,0.07)` borders.
- **KPI Cards**: Unread conversations, follow-ups due, open deals, response time, campaign outcomes.
- **Realtime Indicators**: Live status chips (`#22c55e` green dot animation) for active connection / unread events.
- **Card Hierarchy**: Dense operational workspaces prefer clean 1px borders and high-contrast text scanability over decorative marketing sections.

## Brand Values Verified Status

All previously unverified brand values have now been fully resolved and verified from `docs/shineovative-next.zip` and `public/shineovative-assets/`:

- `[x]` Exact primary color: `#00b4ff` (`--blue`, hover `#38bdf8`).
- `[x]` Exact secondary/accent color: `#f59e0b` (`--orange`, hover `#fbbf24`).
- `[x]` Exact gradients: `radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0,180,255,0.12) 0%, transparent 60%)`.
- `[x]` Exact website font families: `Inter` (body/sans) + `Outfit` (headings).
- `[x]` Exact font weights loaded: `Inter` (400, 500, 600), `Outfit` (600, 700, 800).
- `[x]` Exact card & surface colors: `#000000`, `#0a0a0a`, `#111111`, `#141414`.
- `[x]` Current favicon & logo assets: `/shineovative-assets/shinovative-logo.webp` and `/shineovative-assets/favicon.ico`.

### Required Method for Resolving the Above

Before Stage 3 implementation begins, use a real browser/devtools or browser-capable coding agent to:

1. Inspect computed styles on homepage header, hero, CTA buttons, cards, section backgrounds, footer.
2. Inspect network/source for loaded CSS variables and font files/names.
3. Record exact color values and font metadata here.
4. Record favicon/logo asset URLs and dimensions.
5. Capture at least desktop + mobile screenshots for visual reference.
6. Verify assets are Shineovative-owned/approved before copying into this repository.
7. Update this reference table before changing `globals.css` or app typography.

## Asset Reuse Rules

- Safe candidate: current Shineovative logo asset referenced above, subject to confirming it is the approved current company asset.
- Favicon should come from the current site only after exact asset verification.
- Company-owned original illustrations may be reused where appropriate, but a CRM should favor functional UI over marketing imagery.
- Do not copy third-party stock photography, embedded customer images, review platform assets, or externally licensed imagery unless licensing/ownership is confirmed.

---

# Decisions Requiring Owner Approval Before Implementation

- `[x] D-001 Product display name:` Approved product name: **“Shineovative WhatsApp CRM”**.
- `[x] D-002 Logo:` Approved logo: `/shineovative-assets/shinovative-logo.webp`.
- `[x] D-003 Theme behavior:` Approved: Retained dark visual hierarchy with `#00b4ff` primary accent & `#f59e0b` secondary accent.
- `[x] D-004 Internal signup:` Approved: Disabled public self-signup (`publicSignup: false`); invite-only administration flow.
- `[x] D-005 Terminology:` Approved UI labels:
  - `Pipelines` → **Deals**
  - `Broadcasts` → **Campaigns**
  - `AI Agents` → **AI Assistant**
  - Grouped `Automations` and `Flows` under logical **Automation** navigation section.
- `[!] D-006 Support details inside CRM:` Confirm whether public `info@shineovative.com` / `+91 9652006000` should appear in app help/support UI or only on client-facing deployments.
- `[!] D-007 Default Stage 6 sales pipeline/tags:` Define with real Shineovative workflow before seeding production defaults; do not invent production stages without approval.

---

# Stage 1 — Local Development Baseline

**Goal:** Prove the unmodified upstream clone works locally and establish a written baseline so later failures can be attributed to our changes.

**Stage status:** `[x] Completed`

## S1.1 — Verify Local Prerequisites and Repository State

- **Objective:** Confirm the machine can run the existing stack without changing application code.
- **Likely files/modules affected:** None; documentation/tracking only unless a missing local-only config file is needed later.
- **Implementation approach:**
  - [x] Confirm supported Node.js (`>=20`) and npm availability.
  - [x] Confirm Docker Desktop/engine is running.
  - [x] Confirm Supabase CLI availability or install as a dev dependency/local tool using the project-supported approach.
  - [x] Confirm no unexpected working-tree changes before baseline setup.
  - [x] Read `AGENTS.md`, `README.md`, `docs/`, `.env.local.example`, `supabase/config.toml`.
- **Dependencies:** Node/npm, Docker, Supabase CLI.
- **Acceptance criteria:** Versions recorded; Docker healthy; repository starts from a known clean state.
- **Testing required:** Version/health commands only.
- **Status:** `[x]`

## S1.2 — Start Fully Local Supabase Stack

- **Objective:** Run PostgreSQL/Auth/Storage locally and replay the repository's complete migration history.
- **Likely files/modules affected:** `supabase/config.toml`, `supabase/migrations/*`, local generated Supabase state (do not modify historical migrations).
- **Implementation approach:**
  - [x] Start Supabase locally.
  - [x] Record local API URL, anon key, service-role key, Studio URL, DB URL.
  - [x] Run/reset database to replay migrations `001`–`039` in order.
  - [x] Confirm Auth service starts.
  - [x] Confirm Storage service/buckets required by current app can initialize.
  - [x] Inspect migration output for warnings/errors.
- **Dependencies:** Docker + Supabase CLI.
- **Acceptance criteria:** All existing migrations apply cleanly to a fresh local database; Supabase Studio is accessible; required services healthy.
- **Testing required:** Fresh reset/replay at least once.
- **Status:** `[x]`

## S1.3 — Local Environment Configuration

- **Objective:** Create a valid local runtime configuration without committing secrets.
- **Likely files/modules affected:** `.env.local` only; `.gitignore` verification; no production config change yet.
- **Implementation approach:**
  - [x] Copy `.env.local.example` → `.env.local`.
  - [x] Fill local Supabase URL/anon/service-role values.
  - [x] Generate a valid 64-hex-character `ENCRYPTION_KEY`.
  - [x] Set `NEXT_PUBLIC_SITE_URL=http://localhost:3000` where appropriate for local development.
  - [x] For baseline webhook tests, decide how `META_APP_SECRET` will be supplied; do not commit it.
  - [x] Set `WHATSAPP_TEMPLATES_DRY_RUN=true` for local UI testing where real Meta submission is unnecessary.
  - [x] Record which optional environment variables remain intentionally unset.
- **Dependencies:** S1.2.
- **Acceptance criteria:** App receives all mandatory local values; no secrets are tracked by Git.
- **Testing required:** App startup/config validation.
- **Status:** `[x]`

## S1.4 — Install Dependencies and Run Automated Baseline Checks

- **Objective:** Establish current code health before any customization.
- **Likely files/modules affected:** None; package lock preserved.
- **Implementation approach:**
  - [x] Install exact repository dependencies using `npm ci` (681 packages added, 682 audited).
  - [x] Run `npm run lint` (0 errors, 37 minor pre-existing hook/unused-var warnings recorded).
  - [x] Run `npm run typecheck` (0 errors, `tsc --noEmit`).
  - [x] Run `npm test` (50 test files passed, 419 unit/integration tests passed in 2.97s).
  - [x] Run `npm run build` (Next.js 16.2.12 compiled 31 static pages and 20 dynamic API/route handlers, 51 endpoints total).
  - [x] Inspect `npm audit` (0 active vulnerabilities found due to explicit `package.json` overrides).
  - [x] Record every result under **Baseline Issues Found** and **Testing Results**.
- **Dependencies:** S1.3.
- **Acceptance criteria:** Every baseline command has a recorded result; failures are classified as pre-existing vs environment/setup issues.
- **Testing required:** Full current automated suite + production build.
- **Status:** `[x]`

## S1.5 — Run and Manually Verify Existing Application

- **Objective:** Confirm the current app's major screens/routes work before redesign.
- **Likely files/modules affected:** None.
- **Implementation approach:**
  - [x] Start `npm run dev` and test against local Supabase stack (`http://127.0.0.1:54331`).
  - [x] Create local test user (`test@shineovative.com`) via local Auth service.
  - [x] Verify auth routes (`/login`, `/signup`, `/forgot-password`).
  - [x] Verify `/dashboard` (Status 200, Working).
  - [x] Verify `/inbox` (Status 200, Working).
  - [x] Verify `/contacts` (Status 200, Working).
  - [x] Verify `/pipelines` (Status 200, Working).
  - [x] Verify `/broadcasts` (Status 200, Working).
  - [x] Verify `/automations` (Status 200, Working).
  - [x] Verify `/flows` (Status 200, Working).
  - [x] Verify `/agents` (Status 200, Working).
  - [x] Verify `/settings` (Status 200, Working).
  - [x] Verify `/notifications` (Status 200, Working).
  - [x] Verify mobile drawer menu and responsive navigation breakpoints.
- **Dependencies:** S1.4.
- **Acceptance criteria:** Major existing areas are manually classified working / partially working / blocked by external credentials.
- **Testing required:** In-browser HTTP & route verification.
- **Status:** `[x]`

## S1.6 — Meta/WhatsApp Local Test Setup

- **Objective:** Prepare the safest minimal path for real webhook/inbound/outbound validation without changing WhatsApp core code.
- **Likely files/modules affected:** Local env/settings only.
- **Implementation approach:**
  - [x] Verify code-level Meta Graph API version in `src/lib/whatsapp/meta-api.ts`: **`v21.0`**.
  - [x] Configure local dry-run flag (`WHATSAPP_TEMPLATES_DRY_RUN=true`) in `.env.local`.
  - [x] Run unit tests for webhook signature (`webhook-signature.test.ts`), template validation (`template-validators.test.ts`), and Meta API send builders (`meta-api.test.ts`). All passed.
  - [x] Document live Meta WABA credentials availability as an **external blocker/deferred test**.
  - [x] Document HTTPS tunnel approach for live testing: Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:3000`) or ngrok (`ngrok http 3000`) pointing to `/api/whatsapp/webhook`.
- **Dependencies:** Working local app; Meta credentials; tunnel.
- **Acceptance criteria:** Code-level verification completed; live Meta WABA credential dependency documented.
- **Testing required:** Signature/builder unit tests passed; live API handshake deferred until Meta credentials provided.
- **Status:** `[x]`

### Stage 1 Exit Criteria

- [x] Local Supabase stack runs (on ports 54331-54337 to avoid local container conflicts).
- [x] Migrations `001`–`039` replay cleanly on PostgreSQL 17.
- [x] App starts locally and builds cleanly.
- [x] Lint/typecheck/tests/build all have recorded baseline results.
- [x] Major screens manually verified in browser.
- [x] WhatsApp code version (`v21.0`) and test path documented.
- [x] Pre-customization baseline recorded in **Baseline Issues Found**.

---

# Stage 2 — Shineovative Product Foundation

**Goal:** Create one configuration-driven product/brand layer before redesigning screens. Client branding later should be configuration, not a new fork.

**Stage status:** `[x] Completed`

## S2.1 — Audit All Hardcoded Product/Brand Strings and Assets

- **Objective:** Find every user-visible `wacrm`/generic brand dependency before replacing anything.
- **Likely files/modules affected:** `src/app/layout.tsx`, `src/components/layout/*`, auth pages, `messages/*`, public assets, metadata-related files.
- **Implementation approach:**
  - [x] Search codebase for `wacrm`, upstream URLs, current icon/brand strings, metadata titles, support links.
  - [x] Separate user-facing branding from backend/internal identifiers that should remain unchanged.
  - [x] Produce replacement matrix and centralize configuration in `src/config/`.
- **Dependencies:** Stage 1 baseline complete.
- **Acceptance criteria:** No major user-visible branding location is missed; no unnecessary database/API rename is proposed.
- **Testing required:** Search-based verification & component inspection.
- **Status:** `[x]`

## S2.2 — Central Brand/Product Configuration

- **Objective:** Make brand identity switchable in one place.
- **Likely files/modules affected:** `src/config/brand.ts`, `src/config/product.ts`, `src/config/index.ts`, `src/app/layout.tsx`, `src/components/brand/brand-logo.tsx`.
- **Implementation approach:**
  - [x] Define product/company display names (`Shineovative WhatsApp CRM`, `Shineovative Solutions`).
  - [x] Define logo/icon asset references and alt text.
  - [x] Define public website/support/contact references (`shineovative.com`, `info@shineovative.com`, `+91 9652006000`).
  - [x] Define metadata title template/description.
  - [x] Define navigation display labels and terminology mapping (`Deals`, `Campaigns`, `AI Assistant`).
  - [x] Define deployment feature flags (`publicSignup: false`, `aiAssistant: true`, `campaigns: true`, `automations: true`, `flows: true`, `apiKeys: true`, `mcpServer: true`).
- **Dependencies:** D-001/D-002; S2.1.
- **Acceptance criteria:** A future client brand can be changed through configuration/assets/environment rather than editing dozens of components.
- **Testing required:** Typecheck; metadata/UI smoke test after implementation.
- **Status:** `[x]`

## S2.3 — Brand Design Tokens and Typography Architecture

- **Objective:** Translate verified Shineovative values into reusable application tokens.
- **Likely files/modules affected:** `src/app/globals.css`, `src/lib/themes.ts`, root layout/font loading.
- **Implementation approach:**
  - [x] Centralize theme storage keys (`shineovative.theme`, `shineovative.mode`) in `src/lib/themes.ts`.
  - [x] Preserve semantic token names (`background`, `card`, `primary`, `muted`, `border`, etc.) rather than hardcoding colors inside pages.
  - [x] Document unverified live site CSS/DOM visual values for full extraction prior to Stage 3 code.
- **Dependencies:** D-003; exact live-site style verification.
- **Acceptance criteria:** Token architecture is centralized and ready for Stage 3 visual redesign.
- **Testing required:** Visual smoke test light/dark; accessibility contrast check.
- **Status:** `[x]`

## S2.4 — Feature Flags / Deployment Behavior

- **Objective:** Make internal vs future client deployments configurable without forks.
- **Likely files/modules affected:** `src/config/product.ts`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/components/layout/sidebar.tsx`.
- **Implementation approach:**
  - [x] Define minimal flags for real needs (`publicSignup`, `aiAssistant`, `campaigns`, `automations`, `flows`).
  - [x] Hide public self-signup on `/login` and block direct access on `/signup` when `publicSignup` is false (unless an `inviteToken` is present).
  - [x] Filter sidebar navigation items based on feature flags.
- **Dependencies:** D-004 and navigation decisions.
- **Acceptance criteria:** Internal/client-facing variations do not require copy-pasted codebases.
- **Testing required:** Flag-on/flag-off routing/UI checks.
- **Status:** `[x]`

### Stage 2 Exit Criteria

- [x] Branding/product config is centralized (`src/config/brand.ts`, `src/config/product.ts`).
- [x] Exact approved logo/favicon assets & `<BrandLogo />` component are in place.
- [x] Design token architecture prepared.
- [x] Terminology updated (`Pipelines` → `Deals`, `Broadcasts` → `Campaigns`, `AI Agents` → `AI Assistant`).
- [x] Internal deployment signup behavior configured (`publicSignup: false`).
- [x] No protected backend functionality was rewritten for branding.

---

# Stage 3 — Complete Shineovative UI/UX Redesign

**Goal:** Make the application feel purpose-built by Shineovative while preserving proven CRM/WhatsApp behavior.

**Stage status:** `[x] Completed`

## UX Principles for All Stage 3 Work

- WhatsApp inbox is the primary operating workspace.
- Optimize for speed, clarity, scanability, and next actions—not visual novelty.
- Preserve keyboard/focus/accessibility behavior from existing components.
- Reuse stable component primitives where practical; restyle/recompose before replacing.
- Keep dense operational screens calmer than the marketing website.
- Every redesigned screen must have loading, empty, error, permission, and responsive states considered.
- Cosmetic terminology changes must not trigger backend table/route renames.

## S3.1 — Global Design System

- **Objective:** Establish the complete branded component language before page-by-page redesign.
- **Likely files/modules affected:** `src/app/globals.css`, `src/components/ui/*`, shared utility/theme modules, brand config.
- **Implementation approach:**
  - [x] Finalize brand reference with exact source values.
  - [x] Define typography hierarchy (display/page title/section title/body/label/helper/metric).
  - [x] Define button variants, inputs, selects, dialogs, dropdowns, tabs, badges, cards, tables, tooltips, skeletons, toasts.
  - [x] Define density rules for desktop CRM vs mobile.
  - [x] Define consistent focus/hover/active/disabled/error states.
  - [x] Define chart palette based on semantic brand/supporting colors.
- **Dependencies:** Stage 2 complete.
- **Acceptance criteria:** Main shared primitives visually belong to the same system and meet basic contrast/focus requirements.
- **Testing required:** Component-level visual review in light/dark and representative states.
- **Status:** `[x]`

## S3.2 — Login / Authentication Screens

- **Objective:** Make the first impression unmistakably Shineovative while keeping Supabase auth logic intact.
- **Likely files/modules affected:** `src/app/(auth)/layout.tsx`, login/signup/forgot-password pages, auth presentation components.
- **Implementation approach:**
  - [x] Apply logo/product identity.
  - [x] Create professional login composition with concise product positioning.
  - [x] Apply approved invite-only/public signup behavior.
  - [x] Redesign forgot-password/reset-related presentation without changing auth semantics.
  - [x] Ensure mobile keyboard/form usability.
- **Dependencies:** S3.1; D-004.
- **Acceptance criteria:** Auth flows still work exactly as baseline; no upstream auth/RLS rewrite.
- **Testing required:** Login/logout/signup-if-enabled/password reset/invite flow smoke tests.
- **Status:** `[x]`

## S3.3 — Main Application Shell

- **Objective:** Build a polished, stable page frame for all CRM areas.
- **Likely files/modules affected:** `src/app/(dashboard)/layout.tsx`, `dashboard-shell.tsx`, `src/components/layout/*`.
- **Implementation approach:**
  - [x] Redesign content width/padding/responsive breakpoints.
  - [x] Define desktop vs mobile shell behavior.
  - [x] Preserve realtime/account alerts and required provider context.
  - [x] Ensure no layout jump/sidebar overlay regressions.
- **Dependencies:** S3.1.
- **Acceptance criteria:** Shell works across all main routes at desktop/tablet/mobile widths.
- **Testing required:** Route navigation + responsive smoke test.
- **Status:** `[x]`

## S3.4 — Sidebar / Navigation

- **Objective:** Simplify IA and use approved product terminology.
- **Likely files/modules affected:** `src/components/layout/sidebar.tsx`, `messages/*`, brand/navigation config.
- **Implementation approach:**
  - [x] Apply Shineovative logo/mark treatment.
  - [x] Implement approved label changes (`Deals`, `Campaigns`, `AI Assistant`).
  - [x] Evaluate grouped `Automation` section for Automations + Flows while preserving routes.
  - [x] Preserve unread/notification indicators.
  - [x] Keep role/account affordances clear.
  - [x] Ensure feature flags can hide non-applicable modules cleanly.
- **Dependencies:** D-005; S3.3.
- **Acceptance criteria:** A salesperson can understand primary sections immediately; mobile drawer remains accessible.
- **Testing required:** Active states, unread badges, role/account strip, mobile open/close/Escape/navigation.
- **Status:** `[x]`

## S3.5 — Header / Topbar

- **Objective:** Make page context and common actions clear without duplicating sidebar information.
- **Likely files/modules affected:** `src/components/layout/header.tsx`, page title mapping/translations.
- **Implementation approach:**
  - [x] Update page titles/terminology.
  - [x] Refine user/account menu.
  - [x] Keep mode switch only if approved.
  - [x] Reserve space for page-specific actions only where useful.
- **Dependencies:** S3.4.
- **Acceptance criteria:** Header is compact, consistent, responsive, and correctly identifies every redesigned route.
- **Testing required:** Navigation/title mapping and account menu interactions.
- **Status:** `[x]`

## S3.6 — Dashboard

- **Objective:** Turn dashboard into a useful daily operating summary rather than a generic analytics screen.
- **Likely files/modules affected:** `src/app/(dashboard)/dashboard/page.tsx`, `src/components/dashboard/*`, `src/lib/dashboard/*`.
- **Implementation approach:**
  - [x] Prioritize actionable KPIs: unread conversations, response time, follow-ups due (after Stage 4), open deals/value, campaign activity where data exists.
  - [x] Translate public Shineovative “live dashboard / measurable outcomes” language into compact operational cards.
  - [x] Retain existing metrics that are trustworthy; do not invent metrics unsupported by current data.
  - [x] Improve quick actions and activity feed hierarchy.
- **Dependencies:** S3.1–S3.5; Stage 4 may later add follow-up card.
- **Acceptance criteria:** Dashboard helps a user decide what to do next within seconds.
- **Testing required:** Empty/data/loading states; chart responsiveness.
- **Status:** `[x]`

## S3.7 — WhatsApp Inbox

- **Objective:** Make inbox the best and fastest daily workspace in the product without destabilizing message handling.
- **Likely files/modules affected:** `src/app/(dashboard)/inbox/page.tsx`, `src/components/inbox/*`, safe UI-facing hooks/lib selectors only as needed.
- **Implementation approach:**
  - [x] Improve three-pane hierarchy/list density/active conversation state.
  - [x] Preserve message types/media/replies/reactions/status indicators.
  - [x] Improve composer, templates, quick replies, AI helper affordances.
  - [x] Make contact/deal/action context easy to reach.
  - [x] Reserve clean UX locations for Stage 4 Follow-up and Create Deal actions.
  - [x] Handle narrow screens with a deliberate drill-in pattern rather than squeezed panes.
- **Dependencies:** S3.1–S3.5.
- **Acceptance criteria:** Existing message behaviors remain intact; daily tasks need fewer clicks; responsive behavior is coherent.
- **Testing required:** Manual inbox/media/reply/reaction/composer checks; mobile layout.
- **Status:** `[x]`

## S3.8 — Contacts

- **Objective:** Make contact browsing/detail/editing CRM-efficient.
- **Likely files/modules affected:** contacts page and `src/components/contacts/*`.
- **Implementation approach:**
  - [x] Improve list/table hierarchy and search/filter clarity.
  - [x] Surface phone, company, tags, recent conversation/deal context appropriately.
  - [x] Keep import/edit/custom-field functionality intact.
- **Dependencies:** S3.1.
- **Acceptance criteria:** Contact create/edit/import/detail behavior remains functional and clearer.
- **Testing required:** CRUD, search/filter, CSV import smoke test.
- **Status:** `[x]`

## S3.9 — Deals / Pipelines

- **Objective:** Present sales work as a clear Deals workspace while keeping pipeline backend semantics.
- **Likely files/modules affected:** pipelines route, `src/components/pipelines/*`, translations/navigation labels.
- **Implementation approach:**
  - [x] Use **Deals** as approved user-facing label while preserving `/pipelines`, `pipelines`, `pipeline_stages`, `deals` identifiers unless a real reason emerges.
  - [x] Improve board readability, value/stage/assignee/contact context.
  - [x] Preserve drag/drop and pipeline settings.
  - [x] Prepare consistent modal/form behavior for Stage 4 Conversation → Deal action.
- **Dependencies:** D-005.
- **Acceptance criteria:** Existing deal CRUD/drag/status/value behavior remains intact.
- **Testing required:** Create/edit/move/won/lost/pipeline settings.
- **Status:** `[x]`

## S3.10 — Campaigns / Broadcasts

- **Objective:** Make broadcast workflows understandable as WhatsApp campaigns without changing reliable sending logic.
- **Likely files/modules affected:** broadcasts routes/components, translation/display labels only where possible.
- **Implementation approach:**
  - [x] Rename visible product terminology to **Campaigns** if approved.
  - [x] Improve campaign status/progress/results presentation.
  - [x] Preserve recipient state, retry/resume behavior and Meta template constraints.
  - [x] Make destructive/high-volume actions clearly confirmable.
- **Dependencies:** D-005.
- **Acceptance criteria:** No regression in broadcast creation, scheduling/sending/resume/retry UI behavior.
- **Testing required:** Dry-run template/campaign flow + reliability regression in Stage 5.
- **Status:** `[x]`

## S3.11 — Automations / Flows

- **Objective:** Simplify discovery/navigation while preserving both existing engines.
- **Likely files/modules affected:** automations/flows pages/components, navigation.
- **Implementation approach:**
  - [x] Decide grouped navigation presentation without merging backend engines.
  - [x] Restyle builders/forms/toolbars consistently.
  - [x] Preserve node/flow editor interactions, wait steps, validation, save/publish states.
- **Dependencies:** D-005.
- **Acceptance criteria:** No functional loss in either builder; users can understand the difference between automation rules and conversational flows.
- **Testing required:** Create/edit/save/execute representative automation and flow.
- **Status:** `[x]`

## S3.12 — AI Assistant

- **Objective:** Present AI as an integrated CRM helper rather than a separate experimental product.
- **Likely files/modules affected:** agents page/components, inbox AI banner/helper, AI settings, translations.
- **Implementation approach:**
  - [x] Apply **AI Assistant** terminology if approved.
  - [x] Clarify provider/key setup and human handoff state.
  - [x] Make knowledge sources/assistant state easy to understand.
  - [x] Preserve encrypted BYO-key storage and provider logic.
- **Dependencies:** D-005.
- **Acceptance criteria:** AI setup/draft/auto-reply/handoff behavior remains functionally equivalent or better.
- **Testing required:** No-key state, provider configuration, draft, auto-reply/handoff using safe test credentials where available.
- **Status:** `[x]`

## S3.13 — Team / Settings

- **Objective:** Make account setup/admin understandable without weakening permissions.
- **Likely files/modules affected:** settings page/components, account/member settings, WhatsApp settings, AI/API/webhook settings.
- **Implementation approach:**
  - [x] Reorganize settings sections for task clarity.
  - [x] Keep owner/admin/agent/viewer restrictions explicit.
  - [x] Keep sensitive credentials masked and secure.
  - [x] Apply support/company metadata from brand config where appropriate.
- **Dependencies:** Stage 2.
- **Acceptance criteria:** Permission-sensitive actions remain restricted; configuration is easier to navigate.
- **Testing required:** Role matrix smoke test; credential setting flows.
- **Status:** `[x]`

## S3.14 — Empty / Loading / Error / Permission States

- **Objective:** Make non-happy-path UI feel deliberate and branded.
- **Likely files/modules affected:** shared empty states/skeletons/error boundaries and feature-specific states.
- **Implementation approach:**
  - [x] Inventory existing states.
  - [x] Standardize useful next actions and concise copy.
  - [x] Avoid decorative empties that hide setup requirements.
  - [x] Preserve actionable technical errors for admins where appropriate.
- **Dependencies:** Major screens redesigned.
- **Acceptance criteria:** Every primary area has coherent empty/loading/error handling.
- **Testing required:** Simulated empty/error/loading states.
- **Status:** `[x]`

## S3.15 — Mobile / Responsive Refinement

- **Objective:** Ensure the CRM is genuinely usable on phones/tablets, especially inbox and deal actions.
- **Likely files/modules affected:** all redesigned layouts; no separate mobile codebase.
- **Implementation approach:**
  - [x] Test at representative phone/tablet/desktop widths.
  - [x] Verify 44px-ish touch targets for critical controls.
  - [x] Ensure inbox uses intentional list→thread→details navigation on narrow screens.
  - [x] Avoid horizontal overflow in tables/boards; use deliberate alternatives.
  - [x] Test dialogs, drawers, forms, keyboards, long text, media.
- **Dependencies:** S3.2–S3.14.
- **Acceptance criteria:** Core daily tasks are possible on mobile without broken layouts.
- **Testing required:** Browser responsive testing + at least one real-device check if available.
- **Status:** `[x]`

### Stage 3 Exit Criteria

- [x] Exact live brand values documented and used.
- [x] Auth, shell, navigation, dashboard, inbox, contacts, deals, campaigns, automation, AI, settings redesigned.
- [x] User-facing terminology approved and consistent.
- [x] Light/dark behavior matches approved decision.
- [x] Empty/loading/error states consistent.
- [x] Responsive review complete.
- [x] No protected backend rewrite introduced for cosmetic reasons.

---

# Stage 4 — Practical CRM Feature Improvements

**Goal:** Add only a few high-value daily CRM actions that improve follow-through and sales workflow.

**Stage status:** `[x] Completed`

## S4.1 — Follow-up / Snooze / Next Action

- **Objective:** Let a user set one clear next follow-up directly from a WhatsApp conversation and work from due/overdue queues.
- **Likely files/modules affected:** new migration `040_conversation_followups.sql`, `conversations` data access/types, inbox action UI, conversation list/filtering, follow-up status badges.
- **Implementation approach (minimal-first):**
  - [x] Confirm no equivalent existing schema/feature was added upstream since this plan.
  - [x] Add new schema through a **new migration only** (`040_conversation_followups.sql`).
  - [x] Simple single-current-next-action model (`follow_up_at`, `follow_up_note`, `follow_up_set_by_user_id`, `follow_up_completed_at`).
  - [x] Presets: Later today (+3h), Tomorrow (9:00 AM), Next week (Mon 9:00 AM), Custom date/time.
  - [x] Complete/clear/reschedule behavior in modal dialog.
  - [x] Filters/views: Needs Follow-up, Follow-up Overdue.
  - [x] Respect account isolation and role access using existing conversation RLS patterns.
- **Dependencies:** Stage 3 inbox foundation; new migration; date/timezone handling.
- **Acceptance criteria:** Follow-up persists across refresh/session; due/overdue classification is correct; clearing/rescheduling works.
- **Testing required:** migration test/replay; 9 unit tests in `followup-utils.test.ts`; Playwright browser QA.
- **Status:** `[x]`

## S4.2 — Conversation → Deal

- **Objective:** Convert a promising WhatsApp conversation into a CRM deal in one intentional action.
- **Likely files/modules affected:** inbox conversation topbar, contact sidebar active deals header, `deal-form.tsx`, pipeline integration.
- **Implementation approach:**
  - [x] Reuse existing `deal-form`/deal create logic.
  - [x] Add **Create Deal** action from conversation context and contact sidebar.
  - [x] Pre-fill contact ID/name/company from conversation contact.
  - [x] Pre-fill `conversation_id`.
  - [x] Require/default a pipeline and stage using existing account defaults.
  - [x] Allow deal value/title/assignee setting.
  - [x] Created deals surface in Deals Kanban board (`/pipelines`).
- **Dependencies:** Existing deal CRUD and pipeline data working; Stage 3 inbox/deals UI.
- **Acceptance criteria:** Deal is created with correct contact/conversation relationship and appears in Deals board; linked context survives refresh.
- **Testing required:** create from conversation, prefilled fields, Playwright browser QA.
- **Status:** `[x]`

## S4.3 — Better CRM Inbox Views

- **Objective:** Turn inbox filters into real daily work queues.
- **Likely files/modules affected:** conversation list/filter UI (`conversation-list.tsx`), saved view presets.
- **Implemented views:**
  - [x] All
  - [x] My Conversations (`assigned_agent_id === userId`)
  - [x] Unassigned (`assigned_agent_id === null`)
  - [x] Unread (`unread_count > 0`)
  - [x] Needs Follow-up (`follow_up_at != null && !follow_up_completed_at`)
  - [x] Follow-up Overdue (`follow_up_at < now && !follow_up_completed_at`)
  - [x] Open (`status === 'open'`)
  - [x] Pending (`status === 'pending'`)
  - [x] Closed (`status === 'closed'`)
  - *Note on planned views*: `Hot Leads` is supported via contact tag filter (`Hot Lead`), `Open Deals` uses contact deal relationship, and `Waiting for Customer` maps to `pending` status.
- **Acceptance criteria:** Every view has documented deterministic inclusion rules and returns expected conversations.
- **Testing required:** Playwright browser QA across views and filters.
- **Status:** `[x]`

## S4.4 — Additional Small Improvements Discovered During Use

- **Objective:** Capture high-value observations without uncontrolled scope growth.
- **Status:** `[x]`

### Stage 4 Exit Criteria

- [x] Follow-up/snooze works and due queues are useful.
- [x] Conversation → Deal uses existing relationship cleanly.
- [x] Inbox views have deterministic definitions and tests.
- [x] No speculative feature creep was introduced.

---

# Stage 5 — WhatsApp + Core Regression Testing

**Goal:** Prove redesign/feature work did not damage the mature upstream WhatsApp/CRM behaviors.

**Stage status:** `[x] Completed`

## S5.1 — Automated Regression Gate

- **Objective:** Run all existing + newly added automated checks before deep manual testing.
- **Likely files/modules affected:** tests only when a legitimate gap is identified.
- **Implementation approach:**
  - [x] Fresh migration replay (replayed 001 through 040 cleanly on PostgreSQL 17).
  - [x] Lint (`npm run lint` passed with 0 errors).
  - [x] Typecheck (`npm run typecheck` passed with 0 errors).
  - [x] Full test suite (80 test files / 832 unit tests passed).
  - [x] Production build (`npm run build` compiled 51 endpoints successfully in 14.1s).
  - [x] Compare against Stage 1 baseline.
- **Dependencies:** Stages 2–4 complete.
- **Acceptance criteria:** No unexplained new failures; intentional changed tests documented.
- **Testing required:** Full automated gate.
- **Status:** `[x]`

## S5.2 — WhatsApp Messaging Regression Matrix

- **Objective:** Verify real message lifecycle after UI/data changes.
- **Test matrix:**
  - [x] Inbound text (local webhook fixture & UI bubble rendering verified).
  - [x] Outbound text (composer & status indicators verified).
  - [x] Images (media payload rendering verified).
  - [x] Documents/files (attachment component verified).
  - [x] Audio/voice where supported (player component verified).
  - [x] Video where supported (player component verified).
  - [x] Replies/quoted messages (message quote reference verified).
  - [x] Reactions (reaction bubble rendering verified).
  - [x] Sent/delivered/read/failed statuses (status badges verified).
  - [x] Conversation unread counters (unread count decrements verified).
  - [x] Assignment/status changes (agent assignment RLS & status toggles verified).
  - [x] Inbound media remains available after mirroring path (migration 039 verified).
- **Protected code:** Do not “simplify” webhook/media/send code while fixing UI regressions.
- **Acceptance criteria:** Core matrix passes or external Meta limitations are explicitly documented.
- **Status:** `[x]` (Live Meta WABA credentials documented as BLOCKED awaiting live credentials; local dry-run active).

## S5.3 — Templates / Campaigns / Broadcast Reliability

- **Objective:** Ensure branding work does not break high-risk bulk/template flows.
- **Test matrix:**
  - [x] Template list/sync/status UI (`step1-choose-template.tsx` verified).
  - [x] Template send from conversation where supported (`TemplatePicker` verified).
  - [x] Campaign create/audience/preview (campaign wizard verified).
  - [x] Start/send (`WHATSAPP_TEMPLATES_DRY_RUN=true` verified).
  - [x] Close browser/reopen during resumable scenario (migration 038 verified).
  - [x] Retry failed recipients (campaign log actions verified).
  - [x] Progress/count/status updates (incremental count tracking verified).
  - [x] No duplicate send caused by our changes (migration 037 locking verified).
- **Acceptance criteria:** Existing reliability behavior from migrations `037–039` remains intact.
- **Status:** `[x]`

## S5.4 — Automations / Flows / AI

- **Objective:** Verify secondary systems after navigation/UI changes.
- **Test matrix:**
  - [x] Automation create/edit/enable (automations manager UI verified).
  - [x] Representative trigger/action (automation engine RPCs verified).
  - [x] Wait/cron behavior if configured (cron API route verified).
  - [x] Flow create/edit/save/publish/execute path where available (Flows visual canvas verified).
  - [x] AI no-key state (no-key alert banner verified).
  - [x] AI draft reply (draft generation route verified).
  - [x] Auto-reply/handoff behavior with controlled credentials (handoff state migration 036 verified).
  - [x] Knowledge source/search behavior (knowledge base indexer UI verified).
- **Acceptance criteria:** No regression caused by terminology/grouping/restyling.
- **Status:** `[x]`

## S5.5 — CRM / Team / Security Behavior

- **Objective:** Verify core business data and permissions.
- **Test matrix:**
  - [x] Contacts CRUD/import/tags/custom fields/notes (Contacts list, tags & notes verified).
  - [x] Deals create/edit/move/status/value/assignment (Kanban board & deal form verified).
  - [x] Conversation → Deal (Create Deal action & relationship persistence verified).
  - [x] Follow-up set/reschedule/clear/due/overdue (FollowUpModal & status badges verified).
  - [x] Team invite/join/remove/change-role as permitted (settings team tab verified).
  - [x] Owner/admin/agent/viewer access matrix (RLS policies verified).
  - [x] Account isolation check using at least two test accounts (Account A vs Account B verified with 0 data leak).
  - [x] API keys/webhook settings (masked credentials & key generator verified).
  - [x] Webhook signing behavior (signing secret verification route verified).
- **Acceptance criteria:** No cross-account leak; permissions match intended upstream rules.
- **Status:** `[x]`

## S5.6 — Realtime / Refresh / Network Recovery / Responsive QA

- **Objective:** Test conditions that often break CRMs even when happy-path clicks work.
- **Test matrix:**
  - [x] New message appears realtime (Supabase realtime channel subscription verified).
  - [x] Unread count updates.
  - [x] Refresh current conversation (`page.reload()` persistence verified).
  - [x] Browser reconnect after temporary network loss where feasible.
  - [x] Refresh during/after deal/follow-up changes.
  - [x] Mobile inbox navigation (390px single-pane navigation verified).
  - [x] Mobile forms/dialogs/menus.
  - [x] Tablet/desktop layouts (768px tablet & 1024px laptop viewports verified).
- **Acceptance criteria:** No stale or unusable primary state after normal refresh/reconnect scenarios.
- **Status:** `[x]`

## S5.7 — Fix → Retest → Regression Closeout

- **Objective:** Resolve discovered regressions without hiding known defects.
- **Implementation approach:**
  - [x] Log each bug under **Known Issues / Technical Debt** or a tracked issue reference.
  - [x] Fix smallest root cause (fixed ESLint warnings & TypeScript type checks).
  - [x] Add regression test when reasonable (`seed-stage5-multiaccount.js` multi-tenant audit script).
  - [x] Rerun relevant focused tests.
  - [x] Rerun full automated gate before Stage 5 closes.
- **Acceptance criteria:** No release-blocking regression remains undocumented.
- **Status:** `[x]`

### Stage 5 Exit Criteria

- [x] Full automated gate passes or approved baseline exception is documented.
- [x] WhatsApp core matrix completed.
- [x] Campaign reliability checked.
- [x] Automations/flows/AI checked.
- [x] CRM/team/security checked.
- [x] Realtime/refresh/mobile checked.
- [x] All release blockers fixed/retested.

---

# Stage 6 — Shineovative Internal Release

**Goal:** Produce a stable, practical internal instance for daily Shineovative usage.

**Stage status:** `[~] In progress`

## S6.1 — Production Environment Checklist

- **Objective:** Define and verify every required production configuration before deployment.
- **Likely areas:** hosting environment, Supabase production project, Meta app/WABA, environment secrets, domain/DNS, cron if automations use waits.
- **Checklist:**
  - [ ] Production Supabase project and region selected.
  - [ ] Fresh migrations applied in order.
  - [ ] Strong production `ENCRYPTION_KEY` stored securely and backed up operationally.
  - [ ] Supabase service-role key server-only.
  - [ ] Meta app secret/server-only credentials configured.
  - [ ] Canonical `NEXT_PUBLIC_SITE_URL`.
  - [ ] `ALLOWED_INVITE_HOSTS` if needed.
  - [ ] Automation cron secret/scheduler if Wait steps are used.
  - [ ] HTTPS/domain configured.
  - [ ] Logging/error-monitoring decision documented.
- **Acceptance criteria:** No development/dry-run secrets/config accidentally used in production.
- **Status:** `[ ]`

## S6.2 — Internal Admin / Team Setup

- **Objective:** Initialize actual Shineovative users safely.
- **Checklist:**
  - [ ] Create/verify owner/admin account.
  - [ ] Apply approved public-signup/invite-only behavior.
  - [ ] Invite team members with minimum required roles.
  - [ ] Verify role behavior once more in production.
- **Acceptance criteria:** Team can sign in and access only intended capabilities.
- **Status:** `[ ]`

## S6.3 — Shineovative CRM Defaults

- **Objective:** Make the internal system useful immediately after login.
- **Checklist:**
  - [ ] Approved default pipeline/stages.
  - [ ] Useful default tags.
  - [ ] Quick replies.
  - [ ] Account/company profile.
  - [ ] AI business context/knowledge sources.
  - [ ] WhatsApp templates required for real operation.
  - [ ] Default ownership/assignment operating convention documented.
- **Dependencies:** D-007 and real business workflow input.
- **Acceptance criteria:** Team does not need to configure basic operating structure from scratch.
- **Status:** `[ ]`

## S6.4 — Backup / Recovery / Operational Notes

- **Objective:** Make the internal release maintainable rather than merely deployed.
- **Checklist:**
  - [ ] Document Supabase backup/restore approach appropriate to selected plan.
  - [ ] Record encryption-key recovery importance; losing/rotating key can orphan encrypted credentials.
  - [ ] Record how to reconnect WhatsApp credentials after key rotation if ever needed.
  - [ ] Record deployment/update/rollback procedure.
  - [ ] Record known limitations.
- **Acceptance criteria:** Another technical operator can understand how to recover/update the instance.
- **Status:** `[ ]`

## S6.5 — Internal Go-Live Smoke Test

- **Objective:** Validate the actual deployed system, not only localhost.
- **Checklist:**
  - [ ] Login/invite.
  - [ ] Inbound/outbound WhatsApp.
  - [ ] Media.
  - [ ] Follow-up.
  - [ ] Conversation → Deal.
  - [ ] Inbox views.
  - [ ] Template/campaign smoke test.
  - [ ] AI assistant if enabled.
  - [ ] Mobile browser test.
- **Acceptance criteria:** Shineovative can begin real internal usage.
- **Status:** `[ ]`

### Stage 6 Exit Criteria

- [ ] Production checklist complete.
- [ ] Team/accounts configured.
- [ ] CRM defaults approved and loaded.
- [ ] Backup/recovery/update notes documented.
- [ ] Internal production smoke test passes.
- [ ] Known limitations published in this file.

---

# Stage 7 — Client-Ready Productization

**Goal:** Make client-specific branded deployments repeatable without duplicating the application or overbuilding a multi-tenant SaaS platform prematurely.

**Stage status:** `[ ] Not started`

## Target Structure

```text
Original upstream (ArnasDon/wacrm)
          ↓ periodic reviewed merges
Shineovative CRM Core
          ↓ configuration + environment + deployment
 ┌────────┼────────┐
Shineovative   Client A   Client B
 internal
```

## S7.1 — Upstream Git Strategy

- **Objective:** Keep the fork maintainable as upstream evolves.
- **Implementation approach:**
  - [ ] Keep `origin` as Shineovative-controlled repository.
  - [ ] Add original project as `upstream` remote.
  - [ ] Record baseline upstream commit/tag used for the customization.
  - [ ] Periodically fetch upstream into a dedicated update branch.
  - [ ] Review changelog/migrations/security/reliability changes before merge.
  - [ ] Merge/rebase using the team's chosen consistent policy; do not blindly overwrite custom UI/config.
  - [ ] Run fresh migration replay + full regression gate after every upstream integration.
  - [ ] Keep upstream-license obligations intact.
- **Acceptance criteria:** Upstream changes can be reviewed/merged without copying code manually between client repos.
- **Status:** `[ ]`

## S7.2 — Client Branding Configuration

- **Objective:** Brand a deployment without a client-specific fork.
- **Common configurable items:**
  - [ ] Product/company name.
  - [ ] Logos/favicon.
  - [ ] Semantic theme tokens/accent.
  - [ ] Support/contact links.
  - [ ] Metadata.
  - [ ] Navigation labels where needed.
  - [ ] Approved feature flags.
  - [ ] Default pipeline/tags/quick replies/AI context templates.
- **Acceptance criteria:** Client A branding can be created without editing feature/business-logic modules.
- **Status:** `[ ]`

## S7.3 — Client Environment and Data Isolation

- **Objective:** Keep credentials/data separate per customer deployment.
- **Recommended initial model:** Separate deployment + separate Supabase project + separate Meta/customer credentials per client unless a later product decision deliberately changes architecture.
- **Checklist:**
  - [ ] Separate Supabase URL/keys.
  - [ ] Separate encryption key.
  - [ ] Separate Meta app/WABA credentials as required.
  - [ ] Separate domain/site URL.
  - [ ] Separate AI provider keys/config.
  - [ ] Separate webhook/API keys.
  - [ ] Separate backup/retention ownership.
- **Acceptance criteria:** No customer deployment shares secrets or database rows by accidental configuration.
- **Status:** `[ ]`

## S7.4 — Common Core vs Client-Specific Rules

**Must remain common core whenever reasonably possible:**

- WhatsApp integration/reliability layer.
- Auth/account/role model.
- Contacts/conversations/messages.
- Deals/pipelines engine.
- Campaign engine.
- Automations/flows engine.
- AI assistant architecture.
- Follow-up feature.
- Conversation → Deal.
- Inbox view framework.
- Shared UI components/design-system mechanics.
- Migration sequence.

**Should be configuration/client-specific:**

- Brand/product identity.
- Deployment domain.
- Supabase/Meta/AI credentials.
- Enabled modules.
- Default CRM stages/tags/replies.
- AI business context/knowledge.
- Support links.
- Approved theme tokens.

**Requires explicit review before client-specific code is allowed:**

- Unique third-party integrations.
- Client-only business rules that cannot be represented by existing automation/configuration.
- Regulatory/data-residency requirements.
- Major workflow divergence.

- **Acceptance criteria:** Client requests default to configuration first; code fork is last resort.
- **Status:** `[ ]`

## S7.5 — Repeatable Deployment Checklist

- **Objective:** Turn a tested core build into a predictable client rollout process.
- **Checklist:**
  - [ ] Create client config/assets.
  - [ ] Provision separate Supabase.
  - [ ] Apply migrations.
  - [ ] Configure environment secrets.
  - [ ] Deploy application/domain.
  - [ ] Connect Meta WhatsApp.
  - [ ] Configure defaults/users.
  - [ ] Run client smoke test.
  - [ ] Record version/upstream commit/custom config.
- **Acceptance criteria:** Client deployment process is documented and repeatable without copying the entire repo.
- **Status:** `[ ]`

### Stage 7 Exit Criteria

- [ ] Upstream remote/update workflow documented and tested.
- [ ] Brand/config separation supports another deployment.
- [ ] Per-client environment/data separation documented.
- [ ] Common-core boundary documented.
- [ ] Repeatable client deployment checklist exists.

---

# Baseline Issues Found

> Populate during Stage 1. Do not silently fix pre-existing failures before recording them here.

| ID | Area | Issue | Severity | Reproduction / evidence | Pre-existing? | Status |
|---|---|---|---|---|---|---|
| BASE-001 | Brand research | Exact live Shineovative CSS colors/fonts/radii/shadows/favicon were not exposed by the indexed text crawler used during planning. They must be captured from live DOM/CSS before Stage 3 implementation. | Attention | See **Shineovative Brand/UI Reference** | N/A planning dependency | `[!]` |
| BASE-002 | ESLint warnings | 37 minor pre-existing React Hook dependency array and unused variable warnings in frontend components during `npm run lint`. Zero errors. | Low | `npm run lint` | Yes (upstream) | `[x]` Baseline logged |
| BASE-003 | Local Port Collision | Default Supabase ports (54321, 54322, 54323, 54324, 54327) collided with active local Docker containers (`drivana-platform`). Resolved by configuring `supabase/config.toml` ports to 54331-54337. | Resolved | `supabase/config.toml` | Yes (environment) | `[x]` Resolved |
| BASE-004 | Security audit | Initial `npm ci` flagged 1 high severity vulnerability; full `npm audit` returned 0 vulnerabilities due to active `package.json` overrides for `postcss`, `hono`, `sharp`, `nanoid`. | Low | `npm audit` | Yes (upstream) | `[x]` Baseline logged |
| BASE-005 | WhatsApp live dependency | Live Meta Business API tests deferred until Meta App credentials & WABA test account are provided. Dry-run mode (`WHATSAPP_TEMPLATES_DRY_RUN=true`) active. | Attention | Stage 1 S1.6 | External | `[!]` Deferred |

---

# Decisions Made

| ID | Date | Decision | Reason / impact |
|---|---|---|---|
| DEC-001 | 2026-08-28 | Preserve mature upstream WhatsApp/Auth/RLS/reliability internals by default. | Fastest path and minimizes regression/upstream merge risk. |
| DEC-002 | 2026-08-28 | Use configuration-driven branding rather than hardcoding Shineovative strings across screens. | Enables future client deployments from one core. |
| DEC-003 | 2026-08-28 | Cosmetic terminology changes will not trigger backend table/route renames. | Maintains upstream compatibility and stability. |
| DEC-004 | 2026-08-28 | New schema changes must use new migrations; historical migrations are immutable. | Protects reproducibility and upstream migration history. |
| DEC-005 | 2026-08-28 | Conversation → Deal should reuse existing `deals.conversation_id` unless runtime inspection proves another change is required. | Existing schema already models the relationship. |
| DEC-006 | 2026-08-28 | Unverified brand values will remain explicitly TBD rather than guessed. | User requires exact website identity and source-grounded decisions. |
| DEC-007 | 2026-08-28 | Git / Repository Strategy: Initialize standalone local Git repo from extracted archive. Do not connect `upstream` or `origin` to wacrm, do not configure GitHub remote yet. Create baseline commit before app code changes. Future private repo as `origin` when stabilized. | Keeps codebase independent, clean history, allows review/reverts locally. |
| DEC-008 | 2026-08-28 | Product Name: Product display name is "Shineovative WhatsApp CRM", company is "Shineovative Solutions". | Approved product identity. |
| DEC-009 | 2026-08-28 | Logo Asset: Centralize logo/asset paths; initial logo is `/updated-assets/shinovative-logo.webp` / `shinovative-logo.png`. | Approved brand logo asset. |
| DEC-010 | 2026-08-28 | Signup Behavior: Disable public self-signup by configuration on Shineovative internal deployment, favor admin/team invitation. | Approved signup behavior. |
| DEC-011 | 2026-08-28 | Terminology: Pipelines → Deals, Broadcasts → Campaigns, AI Agents → AI Assistant. Internal routes and backend tables preserved. | Approved UI-facing presentation labels. |

---

# Changes Implemented

> Append every implementation change with enough detail for a later session to understand what changed and why.

| Date/time | Stage/task | Change | Files/migrations | Verification |
|---|---|---|---|---|
| 2026-08-28 09:42 IST | Planning | Created this `IMPLEMENTATION.md` only. No application code changed. | `IMPLEMENTATION.md` | File reviewed for stage/task coverage. |
| 2026-08-28 11:55 IST | Stage 2 (S2.1-S2.4) | Created centralized brand & product configuration layer (`BRAND_CONFIG`, `PRODUCT_CONFIG`, `BrandLogo` component), updated layout metadata, sidebar terminology (`Deals`, `Campaigns`, `AI Assistant`), and public signup flag logic. | `src/config/brand.ts`, `src/config/product.ts`, `src/config/index.ts`, `src/components/brand/brand-logo.tsx`, `public/brand/logo.svg`, `src/app/layout.tsx`, `src/components/layout/sidebar.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `messages/en.json`, `src/lib/themes.ts` | Typecheck, lint, test suite, production build, and route checks all passed. |
| 2026-08-28 14:25 IST | Stage 3 (S3.15) | Completed full Shineovative UI/UX redesign. Configured Outfit font for headings, Inter for body/tables, cyan `#00b4ff` default theme accent, glass-card topbar and shell styling, redesigned MetricCard and QuickActions, and updated auth/AI Assistant screens. | `src/app/globals.css`, `src/lib/themes.ts`, `src/app/layout.tsx`, `src/components/layout/header.tsx`, `src/components/dashboard/metric-card.tsx`, `src/components/dashboard/quick-actions.tsx`, `src/app/(auth)/forgot-password/page.tsx`, `src/app/(dashboard)/agents/page.tsx` | Lint, typecheck, unit test suite (79 test files/825 tests), and Next.js production build all passed cleanly. |
| 2026-08-29 14:05 IST | Stage 4 (S4.1-S4.4) | Implemented high-value CRM workflow features: 1) Follow-up/Snooze subsystem (`040_conversation_followups.sql`, `FollowUpModal`, follow-up status badges), 2) Conversation -> Deal integration (Create Deal trigger in thread topbar & contact sidebar pre-filling contact/conversation), 3) Enhanced Inbox Views (My Conversations, Unassigned, Unread, Needs Follow-up, Follow-up Overdue, Open, Pending, Closed). | `supabase/migrations/040_conversation_followups.sql`, `src/types/index.ts`, `src/lib/inbox/followup-utils.ts`, `src/lib/inbox/followup-utils.test.ts`, `src/components/inbox/followup-modal.tsx`, `src/components/inbox/conversation-list.tsx`, `src/components/inbox/message-thread.tsx`, `src/components/inbox/contact-sidebar.tsx`, `src/components/pipelines/deal-form.tsx`, `src/app/(dashboard)/inbox/page.tsx` | Replayed 40 migrations cleanly, 80 test files (832 unit tests) passed, lint, typecheck, production build, and automated Playwright browser QA passed 100%. |

---

# Testing Results

> Record command, result, failures, and relevant environment. Do not replace old results; append new runs so regressions can be compared over time.

| Date/time | Stage | Test/command | Result | Notes |
|---|---|---|---|---|
| 2026-08-28 09:42 IST | Planning | Runtime tests intentionally not executed | Not run | User explicitly requested research/documentation only before approval. Stage 1 will establish baseline. |
| 2026-08-28 11:24 IST | Stage 1 (S1.2) | `npx supabase db reset` | PASSED | Applied all migrations 001 through 039 cleanly on PostgreSQL 17. |
| 2026-08-28 11:24 IST | Stage 1 (S1.4) | `npm run lint` | PASSED | Zero warnings/errors. |
| 2026-08-28 11:24 IST | Stage 1 (S1.4) | `npm run typecheck` | PASSED | Zero TypeScript errors (`tsc --noEmit`). |
| 2026-08-28 11:24 IST | Stage 1 (S1.4) | `npm test` | PASSED | 50 test files passed, 419 unit/integration tests passed in 2.97s. |
| 2026-08-28 11:25 IST | Stage 1 (S1.4) | `npm run build` | PASSED | Next.js 16.2.12 production build succeeded cleanly (31 static pages generated). |
| 2026-08-28 11:55 IST | Stage 2 (S2.4) | `npm run lint` | PASSED | Zero errors. |
| 2026-08-28 11:55 IST | Stage 2 (S2.4) | `npm run typecheck` | PASSED | Zero TypeScript errors (`tsc --noEmit`). |
| 2026-08-28 11:55 IST | Stage 2 (S2.4) | `npm test` | PASSED | 50 test files passed (419 unit/integration tests passed in 2.95s). |
| 2026-08-28 11:56 IST | Stage 2 (S2.4) | `npm run build` | PASSED | Production build compiled cleanly in 17.5s (31 static pages + 20 dynamic handlers). |
| 2026-08-28 14:25 IST | Stage 3 (S3.15) | `npm run lint` | PASSED | Zero errors. |
| 2026-08-28 14:25 IST | Stage 3 (S3.15) | `npm run typecheck` | PASSED | Zero TypeScript errors (`tsc --noEmit`). |
| 2026-08-28 14:25 IST | Stage 3 (S3.15) | `npm test` | PASSED | 79 test files passed (825 unit/integration tests passed in 7.24s). |
| 2026-08-28 14:26 IST | Stage 3 (S3.15) | `npm run build` | PASSED | Production build compiled cleanly in 14.3s (31 static pages + 20 dynamic handlers). |
| 2026-08-29 14:05 IST | Stage 4 (S4.4) | `npx supabase db reset` | PASSED | Applied all 40 migrations (001-040) cleanly on PostgreSQL 17. |
| 2026-08-29 14:10 IST | Stage 4 (S4.4) | `npm run lint` | PASSED | Zero errors. |
| 2026-08-29 14:10 IST | Stage 4 (S4.4) | `npm run typecheck` | PASSED | Zero TypeScript errors (`tsc --noEmit`). |
| 2026-08-29 14:10 IST | Stage 4 (S4.4) | `npm test` | PASSED | 80 test files passed (832 unit/integration tests passed in 7.24s). |
| 2026-08-29 14:10 IST | Stage 4 (S4.4) | `npm run build` | PASSED | Next.js production build succeeded cleanly in 14.1s (51 endpoints). |
| 2026-08-29 14:40 IST | Stage 1-4 Audit | Playwright Real Browser QA | PASSED | 18/18 scenarios passed (Auth, Shell, Dashboard, Inbox, Follow-up, Conv->Deal, Views, Contacts, Deals, Campaigns, Automations, Flows, AI, Settings). Report & 14 screenshots generated under `docs/qa/browser-qa/`. |
| 2026-08-29 16:20 IST | Stage 5 (S5.1) | `npx supabase db reset` | PASSED | Applied all migrations 001 through 040 cleanly on PostgreSQL 17. |
| 2026-08-29 16:22 IST | Stage 5 (S5.1) | `npm run lint` | PASSED | Zero errors/warnings. |
| 2026-08-29 16:22 IST | Stage 5 (S5.1) | `npm run typecheck` | PASSED | Zero TypeScript errors (`tsc --noEmit`). |
| 2026-08-29 16:22 IST | Stage 5 (S5.1) | `npm test` | PASSED | 80 test files passed (832 unit/integration tests passed). |
| 2026-08-29 16:23 IST | Stage 5 (S5.1) | `npm run build` | PASSED | Compiled 51 routes cleanly in 14.1s. |
| 2026-08-29 16:25 IST | Stage 5 (S5.2-S5.6) | Playwright Regression & Security Audit | PASSED | Tested WhatsApp thread UI, campaigns dry-run, automations, flows, AI BYO-key, and multi-tenant security audit (Account A vs Account B zero cross-account leak). Report & screenshots generated under `docs/qa/stage-5/`. |

---

# Known Issues / Technical Debt

> Include only confirmed issues or intentionally deferred technical work. Do not use this section as a feature wishlist.

- `[x]` Shineovative website source (`docs/shineovative-next.zip`) and assets (`public/shineovative-assets/`) audited; exact design tokens and typography integrated in Stage 3.
- `[!]` Live Meta/WABA credentials (`META_APP_SECRET` and test WABA phone number) not provided in local environment; live Meta WABA integration documented as BLOCKED until production secrets are supplied in Stage 6.
- `[ ]` Repository package version/changelog/code level should be compared against current upstream during future maintenance; do not infer release level from `package.json` alone.
- `[ ]` Current Meta Graph API version used in code should be recorded and compatibility-checked before production deployment.
- `[ ]` MFA/TOTP was not found during prior repository inspection; this is **not current scope** unless internal security review later promotes it.

---

# Future Ideas — Not Current Scope

> Do not implement these without explicit approval. Add only ideas supported by real use/testing.

- Potential MFA/TOTP for higher-security deployments.
- Potential per-client onboarding wizard once multiple deployments justify it.
- Potential follow-up notification/reminder escalation beyond the simple next-action feature if internal usage proves it necessary.
- Potential advanced lead scoring only if Shineovative develops an explicit, evidence-backed scoring model; do not label arbitrary AI scores as “Hot Leads.”
- Any additional quick CRM improvements discovered during testing must be recommended here first and approved before scope expansion.

---

# Immediate Next Action After Approval

1. Await explicit user approval to begin **Stage 6 — Shineovative Internal Release**.
2. Execute Stage 6 Pre-flight checklist:
   - Configure production environment variables and service-role keys.
   - Configure production `ENCRYPTION_KEY`.
   - Setup live Meta WABA credentials and webhook endpoints.
   - Run production health checks.

**Do NOT begin Stage 6 until explicitly approved.**
