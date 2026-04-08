# Architecture

This file stores cross-cutting rules that apply to the whole repo and to projects cloned from it.

Use this file for global constraints. Use feature specs under `specs/` for domain-specific behavior and contracts.

## Global Rules

- Keep the template lightweight, reusable, easy to clone, and easy to prune.
- Keep the scheduler domain model intentionally abstract until a concrete adapter or workflow needs a stronger schema.
- Keep the local development route surface aligned with the production route surface so verification exercises the same behavior in both environments.
- Persist operator-defined posting schedules in D1 `app_state` as Cloudflare-cron-compatible data instead of inventing a separate scheduler config store too early.
- Store channel connection metadata in dedicated D1 rows and store adapter credentials only as encrypted `app_secrets` values.
- Keep social-provider SDKs behind provider adapter modules instead of calling them directly from routes or views.
- Treat repo documentation as living context that should evolve with the code.
- Treat architectural decisions as explicit records, not implicit tribal knowledge.
- Add or update an ADR in `docs/adrs/` whenever a change introduces or changes a lasting architectural constraint, selects between credible architectural alternatives, or replaces an earlier decision.
- Create or update the relevant feature spec in `specs/` in the same change set whenever feature behavior, contracts, workflows, or regression guardrails change.
- Keep the quality gate green before considering a change ready.

## Tooling Baseline

- Local development and local CI target macOS as the supported host platform baseline.
- Node and npm versions are pinned through `package.json`.
- D1 is the baseline persistence layer for local auth and generic app state.
- The Worker runtime must keep Cloudflare `nodejs_compat` enabled because the selected social-provider SDKs rely on Node built-ins such as `crypto`.
- The app must not pretend it can rewrite deployed Wrangler Cron Triggers at runtime; deployment config and saved schedule state stay explicit and separate.
- Session signing secrets stay in `.dev.vars` and must not be committed or copied into D1 backups.
- `APP_ENCRYPTION_SECRET` should stay in `.dev.vars` or the deployed secret manager and must not be stored in D1 or copied into R2 backups.
- Optional scheduled backups write application snapshots to R2 and should be treated as sensitive operational data.
- The verification baseline is split into a fast gate and a browser gate so quick checks can return earlier without dropping full coverage.
- Formatting, type checking, unit tests, and end-to-end tests are part of the baseline quality gate.
- Unit coverage for `src/` code should stay high enough that the coverage gate remains green.
- Local CI should validate the same baseline checks before changes are proposed or merged.

## Spec Conventions

- Put feature-level specs under `specs/{feature-domain}/spec.md`.
- Keep one spec per independently evolvable feature or domain.
- Update the relevant spec in the same change set whenever behavior, contracts, workflows, or guardrails change.
