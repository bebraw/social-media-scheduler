# Feature: Scheduler Foundation

## Blueprint

### Context

This project is evolving from a generic Worker starter into a private social media scheduler for personal projects.

Before planning richer scheduling UI, the repo needs an operational foundation that is small, testable, and reusable:

- local auth so the app is private by default
- explicit Cloudflare persistence bindings instead of ad hoc storage
- scheduled backups that preserve recoverable state as the real scheduler model grows

### Architecture

- **Entry points:** `wrangler dev` via `src/worker.ts`, authenticated `GET /`, `POST /posting-schedule`, `GET /compose`, and `GET /history` page routes, development-only `GET /demo` and `POST /demo/queue`, `npm run account:create` for auth user management, and the Worker scheduled handler for automated backups
- **Source layout:** `src/worker.ts` routes requests, `src/auth/` holds auth primitives and D1-backed auth state helpers, `src/backup/` holds the backup export flow, `src/demo/` holds development-only demo gating plus seeded/local demo state, `src/history/` holds sent-post history loading for normal routes, `src/queue/` holds channel constraint logic, `src/schedule/` holds posting schedule persistence plus Cloudflare cron mapping helpers, `src/api/` holds API handlers, and `src/views/` holds the queue, compose, history, and demo HTML renderers plus the shared interaction script.
- **Styling pipeline:** `src/tailwind-input.css` compiles to `.generated/styles.css`, which the Worker serves at `/styles.css`.
- **Data models:** D1 stores `app_users`, `login_attempts`, generic `app_state`, and reserved `app_secrets`. R2 stores backup exports, summaries, and manifests when configured.
- **Dependencies:** Wrangler provides the Worker runtime, D1, R2, and scheduled triggers; Playwright and Vitest verify the behavior.

### Anti-Patterns

- Do not add unauthenticated product routes without an explicit decision that documents why privacy is being relaxed.
- Do not store session signing secrets inside D1 or inside R2 backups.
- Do not grow the scheduler data model speculatively before a real adapter or workflow needs it.
- Do not remove the scheduled backup content hash check and replace it with unconditional writes.

## Contract

### Definition of Done

- [ ] Anonymous requests to `/` redirect to `/login`.
- [ ] `POST /login` authenticates a D1-backed account and sets a signed session cookie.
- [ ] Authenticated requests to `/` return the default queue page after login without seeded demo data.
- [ ] Authenticated requests to `/` expose a per-channel posting schedule editor with Cloudflare-cron-compatible output for each channel.
- [ ] Authenticated requests to `/compose` return a dedicated composer page with separate LinkedIn, X, and Bluesky drafts exposed through a tabbed editor without seeded demo data.
- [ ] The dedicated composer applies channel-specific copy budgets and lightweight client-side queue interactions.
- [ ] Authenticated requests to `/history` return a dedicated history page that can filter previously sent posts by channel and render an empty state when no real history exists.
- [ ] `POST /posting-schedule` validates and stores the per-channel posting schedule in local D1-backed app state without inventing a separate scheduler config table.
- [ ] Authenticated requests to `/demo` return a seeded demo workspace only when `DEMO_MODE=true` is configured locally and the request stays on a loopback host.
- [ ] `POST /demo/queue` stores scheduled demo posts in local D1-backed app state without calling any external publishing service.
- [ ] The health route returns stable JSON for smoke tests and tooling.
- [ ] The scheduled handler writes backup artifacts to R2 when configured and skips when the export content is unchanged.
- [ ] The spec is updated in the same change set.
- [ ] Automated tests cover the critical behavior.

### Regression Guardrails

- `GET /` must not expose the scheduler page to anonymous users.
- `GET /login` must remain usable as the local sign-in entry point.
- `GET /home.js` must keep returning the lightweight client-side queue and composer behavior script.
- `GET /styles.css` must keep returning the generated stylesheet.
- `GET /api/health` must keep returning HTTP 200 JSON with `ok: true`.
- The queue view must keep showing the saved per-channel posting schedule and the derived Cloudflare cron string for each channel.
- The dedicated composer must keep exactly one channel panel visible at a time while preserving channel-specific limits and queue controls.
- The history page must keep filtering cards on the client without a full page reload.
- Posting schedule edits must stay authenticated, require at least one weekday plus a valid UTC time per channel, and reject readonly users.
- `/demo` must return HTTP 404 unless demo mode is explicitly enabled for local development and the request stays on a loopback host.
- Demo scheduling must write only to local demo state and must not call any external publishing adapter or service.
- Session cookies must stay signed with `SESSION_SECRET` and marked `HttpOnly`.
- Scheduled backups must remain deterministic enough to skip unchanged exports.
- Unknown routes must return HTTP 404.

### Verification

- **Automated tests:** colocated Vitest files under `src/**/*.test.ts` for module behavior and colocated Playwright files under `src/**/*.e2e.ts` for the browser-visible flow.
- **Coverage target:** Keep the `src/worker.ts`, `src/auth/**`, `src/backup/**`, `src/api/**`, and `src/views/**` branches, lines, functions, and statements above the repo coverage thresholds.

### Scenarios

**Scenario: Anonymous visitor opens the app**

- Given: the Worker is running locally
- When: the developer visits `/`
- Then: they are redirected to `/login`

**Scenario: Operator signs in**

- Given: the local D1 database contains at least one auth user
- When: the operator submits valid credentials to `/login`
- Then: the Worker sets a signed session cookie and returns the default queue page at `/`

**Scenario: Operator reviews the queue**

- Given: the operator is already authenticated
- When: they open `/`
- Then: they see the default queue view with queue metrics, a per-channel posting schedule editor, and queued-post review space without seeded demo data

**Scenario: Operator updates the posting schedule**

- Given: the operator is already authenticated
- When: they submit `POST /posting-schedule` with weekdays and a UTC time for each channel
- Then: the Worker stores the resulting per-channel Cloudflare cron expressions in local D1-backed app state and redirects back to `/`

**Scenario: Operator opens the dedicated composer**

- Given: the operator is already authenticated
- When: they navigate to `/compose`
- Then: they see LinkedIn, X, and Bluesky draft tabs, one visible authoring panel, and local queue preview controls without seeded demo data

**Scenario: Operator opens history**

- Given: the operator is already authenticated
- When: they navigate to `/history`
- Then: they see a dedicated history page with per-channel filters and either real history entries or an empty state

**Scenario: Operator filters history**

- Given: the operator is already authenticated and already on `/history`
- When: they use the history channel filters
- Then: the page narrows the visible sent-post cards to the selected channel without a full reload

**Scenario: Operator switches draft channels**

- Given: the operator is already authenticated
- When: they select a different draft tab
- Then: the chosen channel panel becomes visible, the previously active panel is hidden, and the draft controls remain scoped to the active channel

**Scenario: Operator queues a draft from the composer**

- Given: the operator is already authenticated
- When: they edit a channel draft on `/compose` and click `Queue post`
- Then: the client-side mock queue prepends that post into the composer queue preview and updates queue metrics without a full page reload

**Scenario: Developer opens demo mode locally**

- Given: `DEMO_MODE=true` is set in `.dev.vars` and the request uses `127.0.0.1` or `localhost`
- When: the authenticated developer opens `/demo`
- Then: they see seeded demo drafts, a seeded demo queue, and seeded demo history in a development-only sandbox

**Scenario: Developer schedules a demo post**

- Given: demo mode is enabled locally for an authenticated editor
- When: they submit `POST /demo/queue`
- Then: the Worker stores that demo queue item in local D1-backed app state and redirects back to `/demo` without calling any external service

**Scenario: Tooling checks app health**

- Given: the Worker is running locally
- When: a tool requests `/api/health`
- Then: it receives a stable JSON response with `ok: true`

**Scenario: Browser requests starter stylesheet**

- Given: the Worker is running locally
- When: the browser requests `/styles.css`
- Then: it receives the generated Tailwind stylesheet through the same local runtime path used by the browser tests

**Scenario: Scheduled backup runs after state changes**

- Given: the Worker has D1 data and an R2 backup binding
- When: the scheduled handler runs after the exported auth or app state data changes
- Then: it writes a JSON export, summary report, and manifest under the configured backup prefix

**Scenario: Unknown route**

- Given: the operator is already authenticated
- When: a request hits an undefined route
- Then: the Worker returns HTTP 404
