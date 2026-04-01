# Feature: Scheduler Foundation

## Blueprint

### Context

This project is evolving from a generic Worker starter into a private social media scheduler for personal projects.

Before planning richer scheduling UI, the repo needs an operational foundation that is small, testable, and reusable:

- local auth so the app is private by default
- explicit Cloudflare persistence bindings instead of ad hoc storage
- scheduled backups that preserve recoverable state as the real scheduler model grows

### Architecture

- **Entry points:** `wrangler dev` via `src/worker.ts`, `npm run account:create` for auth user management, and the Worker scheduled handler for automated backups
- **Source layout:** `src/worker.ts` routes requests, `src/auth/` holds auth primitives and D1-backed auth state helpers, `src/backup/` holds the backup export flow, `src/queue/` holds channel constraint logic, `src/api/` holds API handlers, and `src/views/` holds HTML rendering modules plus the home-page interaction script.
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
- [ ] Authenticated requests to `/` return a visible queue-planning page with separate LinkedIn, X, and Bluesky drafts exposed through a tabbed editor.
- [ ] The queue UI applies channel-specific copy budgets and lightweight client-side queue interactions.
- [ ] The health route returns stable JSON for smoke tests and tooling.
- [ ] The scheduled handler writes backup artifacts to R2 when configured and skips when the export content is unchanged.
- [ ] The spec is updated in the same change set.
- [ ] Automated tests cover the critical behavior.

### Regression Guardrails

- `GET /` must not expose the scheduler page to anonymous users.
- `GET /login` must remain usable as the local sign-in entry point.
- `GET /home.js` must keep returning the lightweight client-side queue behavior script.
- `GET /styles.css` must keep returning the generated stylesheet.
- `GET /api/health` must keep returning HTTP 200 JSON with `ok: true`.
- The draft workspace must keep exactly one channel panel visible at a time while preserving channel-specific limits and queue controls.
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
- Then: the Worker sets a signed session cookie and returns the scheduler queue page

**Scenario: Operator reviews the queue**

- Given: the operator is already authenticated
- When: they open `/`
- Then: they see LinkedIn, X, and Bluesky draft tabs, one visible authoring panel, and a queued-post list that sketches the future scheduling workflow

**Scenario: Operator switches draft channels**

- Given: the operator is already authenticated
- When: they select a different draft tab
- Then: the chosen channel panel becomes visible, the previously active panel is hidden, and the draft controls remain scoped to the active channel

**Scenario: Operator queues a draft from a channel column**

- Given: the operator is already authenticated
- When: they edit a channel draft and click `Queue post`
- Then: the client-side mock queue prepends that post into the queued-post list and updates queue metrics without a full page reload

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
