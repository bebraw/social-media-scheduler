# Development

This document collects development-facing setup and workflow notes for the template.

## Agent Context

The template vendors the ASDLC knowledge base in `.asdlc/`.

- Start with `.asdlc/SKILL.md` for ASDLC concepts, patterns, and practices.
- Use `AGENTS.md` as the Codex-native context anchor for this repo.

## Local CI

This template is set up for the local Agent CI runner from `agent-ci.dev`.

### Prerequisites

- Local development in this template targets macOS. The documented commands assume a macOS shell environment and are not maintained as a cross-platform baseline.
- If you use `nvm`, run `nvm use 24.14.1` before repo commands. The exact Node.js version is pinned in `package.json`.
- Install dependencies with `npm install`.
- CI reads that same exact Node.js version directly through `actions/setup-node`.
- npm comes from that pinned Node release rather than a separate repo-level npm pin.
- Copy `.dev.vars.example` to `.dev.vars` and replace placeholder values when a project needs local secrets.
- Copy `.env.agent-ci.example` to `.env.agent-ci` when you need machine-local Agent CI overrides. The repo's `ci:local*` scripts source that file into the shell before invoking `agent-ci`, and `agent-ci` also reads it for machine-local workflow secrets.
- If your clone has no `origin` remote, set `GITHUB_REPO=owner/repo` in `.env.agent-ci` to stop Agent CI from warning while inferring the repository name.
- If Docker Desktop is running on macOS but Agent CI still cannot find Docker, set `DOCKER_HOST=unix:///Users/<your-user>/.docker/run/docker.sock` in `.env.agent-ci`. The repo scripts export that value before `agent-ci` starts, which is necessary because `agent-ci` itself does not import `DOCKER_HOST` from `.env.agent-ci`.
- Start a Docker runtime before running Agent CI.
- Install the GitHub Actions runner image once with `docker pull ghcr.io/actions/actions-runner:latest`.

The repo pins CLI tooling in `devDependencies`, including Wrangler for Cloudflare-based experiments. Prefer invoking those tools through `npx` or repo scripts so the project version is used instead of a global install.

The Worker config enables Wrangler's `nodejs_compat` compatibility flag. Keep that flag in place unless the provider SDK layer is rewritten to avoid Node built-ins, because the current Bluesky, X, and LinkedIn libraries pull in modules such as `crypto` during local development and bundling.

If local CI fails with `No such image: ghcr.io/actions/actions-runner:latest`, pull that image manually and re-run the workflow.

If local CI warns with `No such remote 'origin'`, add `GITHUB_REPO=owner/repo` to `.env.agent-ci` and rerun the workflow.

If local CI says Docker is not running even though Docker Desktop is open, add `DOCKER_HOST=unix:///Users/<your-user>/.docker/run/docker.sock` to `.env.agent-ci` and rerun the workflow through the repo script so that value is exported before `agent-ci` starts.

### Commands

- Run the local workflow with `npm run ci:local`.
- Run the quiet local workflow with `npm run ci:local:quiet`.
- Run all relevant workflows with `npm run ci:local:all`.
- Rebuild the generated stylesheet manually with `npm run build:css`.
- Apply local D1 migrations with `npm run db:migrate`.
- Apply remote D1 migrations with `npm run db:migrate:remote`.
- Create or update a local auth user with `npm run account:create -- --name "Scheduler Admin" --password "change-me" --role editor`.
- Run the fast local gate with `npm run quality:gate:fast`.
- Run the baseline quality gate with `npm run quality:gate`.
- Run the shipped runtime dependency audit with `npm run security:audit`.
- Start the local Worker with `npm run dev`.
- Prepare the e2e D1 state with `npm run e2e:prepare`.
- Install the Playwright browser with `npm run playwright:install`.
- Run end-to-end tests with `npm run e2e`.
- Run unit and integration tests with `npm test`.
- Run the unit coverage gate with `npm run test:coverage`.
- Run TypeScript checks with `npm run typecheck`.
- Run Lighthouse with `LIGHTHOUSE_URL=http://127.0.0.1:8787 LIGHTHOUSE_SERVER_COMMAND="npm run dev" npm run lighthouse`.
- Format the repo with `npm run format`.
- Check formatting with `npm run format:check`.
- If a run pauses on failure, fix the issue and resume with `npm run ci:local:retry -- --name <runner-name>`.

The template now ships with a private scheduler foundation in `src/worker.ts`. `npm run dev` starts it on `http://127.0.0.1:8787`, and Playwright uses `npm run e2e:server` on `http://127.0.0.1:8788` after first applying local D1 migrations, creating the default e2e account, and seeding deterministic channel fixtures. The e2e server forces Chokidar polling mode to avoid file-watcher exhaustion in macOS-hosted local runs while preserving the normal `npm run dev` developer loop. Auth helpers live under `src/auth/`, backup helpers live under `src/backup/`, posting schedule helpers live under `src/schedule/`, API modules live under `src/api/`, view modules live under `src/views/`, and tests are colocated under `src/`.

After sign-in, the default authenticated surface is now the `Queue` view at `/`, which includes the per-channel posting schedule editor for whichever providers are currently configured in Settings. The dedicated `Compose` and `History` views also derive their visible accounts and filters from those saved channel connections instead of assuming one fixed card per provider.

Posting schedules are stored in D1 `app_state` as Cloudflare-cron-compatible expressions derived from the queue UI's weekday and UTC time controls. The app saves and renders those cron expressions directly, but it does not rewrite deployed Wrangler Cron Triggers for you. If you want scheduled events to fire in a deployed environment, copy the saved cron values into `wrangler.jsonc` or the equivalent deployment config.

The GitHub Actions CI workflow splits fast checks from browser checks into separate jobs, reads the pinned Node version from `package.json`, runs repository-shape validation as part of the fast job, runs the browser job in the version-pinned Playwright container image `mcr.microsoft.com/playwright:v1.58.2-noble`, and cancels superseded runs on the same ref. That keeps the browser job from reinstalling Chromium on every run while still matching the repo's pinned Playwright version.

The starter UI now follows the same Tailwind v4 baseline shape as `thesis-journey-tracker`: Tailwind input lives in `src/tailwind-input.css`, generated CSS is written to `.generated/styles.css`, and Wrangler runs `npm run build:css` automatically before local development.

Auth now mirrors the lightweight setup used in `thesis-journey-tracker`: accounts live in D1, passwords are stored as PBKDF2-SHA256 hashes, session cookies are HMAC-signed with `SESSION_SECRET`, and failed logins are rate-limited per client IP and login name. Scheduler state lives in D1 `app_state`, channel connection metadata lives in `channel_connections`, and token-like credentials are encrypted before they are written into `app_secrets`.

Automated backups also follow the `thesis-journey-tracker` shape: a scheduled handler writes a JSON export, a small Markdown summary, and a manifest into R2, then skips creating new artifacts when the export content hash has not changed. Those exports now include encrypted secret blobs and channel connection metadata in addition to auth users and app state.

The Lighthouse setup is also generic, but the Worker stub gives it a concrete local target. Use `LIGHTHOUSE_URL=http://127.0.0.1:8787 LIGHTHOUSE_SERVER_COMMAND="npm run dev" npm run lighthouse`. Reports are written to `reports/lighthouse/`.

The Vitest setup is generic as well. `vitest.config.ts` targets colocated `src/**/*.test.ts` files while excluding `src/**/*.e2e.ts`. The default `npm test` command uses `--passWithNoTests` so the template remains usable before a project adds its first test file.

The coverage gate is stricter than the basic test run. `npm run test:coverage` measures runtime `src/**` code with the V8 provider, writes reports to `reports/coverage/`, and enforces high thresholds once a project actually has `src/` code. Colocated unit tests, end-to-end tests, and test-support files do not count as source files for the gate's skip-or-fail logic.

The TypeScript setup is generic too. `tsconfig.json` covers repo-level `.ts` files and `src/**/*.ts`, `npm run typecheck` runs `tsc --noEmit`, and the compiler rejects unused locals so stray imports fail the baseline gate.

The README includes a committed application screenshot at `docs/screenshots/home.png`. Refresh that asset manually when the starter UI changes materially, but keep screenshot tooling and screenshot automation out of the template baseline.

## Security Baseline

The template keeps secret handling lightweight and explicit:

- Keep local secrets in untracked files such as `.dev.vars`.
- Commit example files such as `.dev.vars.example` with placeholder values only.
- Treat R2 backups as sensitive because they include password hashes from `app_users`.
- Treat encrypted channel credentials as sensitive even though the stored D1 and backup values are ciphertext.
- Treat `npm run security:audit` as part of the baseline gate for shipped runtime dependencies.

## Quality Gate

Use this expectation for routine changes:

- `npm run quality:gate` must pass before a change is considered ready.
- Use `npm run quality:gate:fast` for quicker local iteration when browser coverage is not the immediate focus.
- `npm run ci:local:quiet` should also pass before proposing or landing the change.

The quality gate currently runs the fast gate first, then the Playwright browser gate. The local and remote CI workflow runs separate fast and browser jobs, with repository-shape validation included in the fast job. The repo's local CI scripts call the pinned `agent-ci` binary directly after sourcing `.env.agent-ci`, rather than going through a custom wrapper or ad hoc `npx` usage, and local browser installation should also go through the pinned `npm run playwright:install` script.

Treat the browser gate as a seeded-fixture check, not a live provider-integration check. If Playwright needs a new account, connection, or queue baseline, add it to `npm run e2e:prepare` instead of wiring browser tests through real provider validation flows. Provider token validation should stay covered by mocked unit and route tests.
