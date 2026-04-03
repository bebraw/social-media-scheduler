# social-media-scheduler

This repo is the foundation for a private social media scheduler for personal projects. The current slice keeps the product model intentionally abstract while establishing two durable pieces of groundwork:

- D1-backed local auth with signed session cookies
- Optional scheduled R2 backups for application state snapshots
- A settings surface for multi-account channel connections with encrypted credentials at rest
- First provider adapter slices for validated Bluesky and X connections

Local development in this repo targets macOS. Other platforms may need script and tooling adjustments before the baseline workflow works as documented.

## Documentation

- Setup and first run: `docs/setup.md`
- Backup configuration and restore notes: `docs/backups.md`
- Development setup and local CI: `docs/development.md`
- Architecture decisions: `docs/adrs/README.md`
- Feature and architecture specs: `specs/README.md`
- Agent behavior and project rules: `AGENTS.md`

## Runtime

- If you use `nvm`, run `nvm use 24.14.1` before repo commands. The exact Node.js version is pinned in `package.json`.
- Install dependencies with `npm install`.
- CI reads the same pinned Node.js version directly from `package.json`.
- npm now comes from that pinned Node release instead of a separate repo version file.
- Copy `.dev.vars.example` to `.dev.vars` before running projects that need local secrets.
- Set `DEMO_MODE=true` in `.dev.vars` if you want the local-only demo workspace at `/demo`.
- Set `APP_ENCRYPTION_SECRET` in `.dev.vars` if you want channel credentials encrypted with a key separate from `SESSION_SECRET`.
- Create the D1 database binding and replace the placeholder `database_id` in `wrangler.jsonc` before running auth flows.
- Run `npm run db:migrate` before the first authenticated start.
- Create at least one local account with `npm run account:create -- --name "Scheduler Admin" --password "change-me" --role editor`.
- Use repo-pinned CLI tools through `npx`, including `npx wrangler` for Cloudflare-based experiments.
- Start the Worker with `npm run dev`, then open `http://127.0.0.1:8787`.
- Rebuild the generated Tailwind stylesheet manually with `npm run build:css` when needed.

## Verification

- Run the fast local gate with `npm run quality:gate:fast` during normal iteration.
- Run the baseline repo gate with `npm run quality:gate`.
- Run the containerized local workflow with `npm run ci:local:quiet`.
- If local Agent CI warns about `No such remote 'origin'`, set `GITHUB_REPO=owner/repo` in `.env.agent-ci`.
- Retry a paused local CI run with `npm run ci:local:retry -- --name <runner-name>`.
- Install the pinned Playwright browser with `npm run playwright:install`.
- Run unit tests from colocated `src/**/*.test.ts` files with `npm test`.
- Run browser tests from colocated `src/**/*.e2e.ts` files with `npm run e2e`.

## Starter App

- `GET /login` serves the local sign-in page.
- `GET /` redirects anonymous users to login and serves the authenticated queue view plus per-channel posting schedule editor for signed-in users.
- `GET /compose` serves the authenticated post composer for the currently configured channel connections.
- `GET /history` serves the authenticated history page with filters derived from the configured channel connections.
- `GET /settings` serves the authenticated channel settings page for per-account connection management.
- `POST /settings/channels` stores a new channel connection and encrypts its token fields in D1-backed secret storage.
- Bluesky connections use a handle plus app password at save time; the app validates that login and stores the returned session tokens instead of the raw password.
- X connections validate the submitted user-context access token and normalize the saved handle from the authenticated account before storing encrypted tokens.
- `POST /posting-schedule` updates the authenticated per-channel posting schedule and stores the resulting Cloudflare cron expressions in D1 app state.
- `GET /demo` serves the development-only demo workspace when `DEMO_MODE=true` is set locally and the request stays on a loopback host.
- `GET /styles.css` serves the generated Tailwind stylesheet.
- `GET /api/health` serves a JSON health response for smoke tests and tooling.
- The scheduled Worker entrypoint can write JSON exports, summary reports, and manifests to R2 when `BACKUP_BUCKET` is configured.

## Source Layout

- `src/worker.ts` is the Worker entry point and top-level router.
- `src/auth/` holds password hashing, session, and D1-backed auth state helpers.
- `src/backup/` holds the scheduled backup export and R2 storage helpers.
- `src/channels/` holds per-account channel connection persistence and validation.
- `src/providers/` holds provider-specific adapter logic such as Bluesky and X connection preparation.
- `src/demo/` holds development-only demo gating, seeded data, and local demo scheduling helpers.
- `src/history/` holds sent-post history loading for the normal authenticated routes.
- `src/queue/` holds channel constraint logic for the dedicated composer and related queue behavior.
- `src/schedule/` holds per-channel posting schedule persistence plus Cloudflare cron mapping helpers.
- `src/secrets/` holds reusable encrypted secret storage helpers for D1-backed credentials.
- `src/api/` holds API response modules such as the health endpoint.
- `src/views/` holds HTML rendering modules for the queue, compose, history, settings, and demo surfaces.
- Tests live next to the code they exercise under `src/`.
