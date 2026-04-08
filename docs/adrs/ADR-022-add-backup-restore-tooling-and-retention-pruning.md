# ADR-022: Add Backup Restore Tooling And Retention Pruning

**Status:** Accepted

**Date:** 2026-04-08

## Context

The repo already writes recoverable backup exports into R2, but production operations still were missing two critical controls:

- a supported restore path that does not require hand-written SQL every time
- a retention policy that prevents backups from growing forever without an explicit rule

An authenticated in-app restore surface would expose a highly sensitive operation inside the product itself, while leaving restore as ad hoc SQL is too fragile for production use.

## Decision

We will keep restore as an operator-managed workflow and provide a first-party CLI restore tool plus Worker-managed retention pruning.

The repo now uses:

- `npm run backup:restore` to convert a backup export JSON file into D1 restore SQL and optionally execute it through Wrangler
- a default 90-day automated backup retention window, configurable through `BACKUP_RETENTION_DAYS`
- backup pruning that runs inside the scheduled backup flow when the backing R2 API supports listing and deletion

## Trigger

Production readiness required backups to be more than artifacts on disk. Operators need a repeatable recovery path and a bounded storage policy.

## Consequences

**Positive:**

- Restore is now a supported operational workflow instead of a manual SQL exercise.
- Retention is enforced near the backup writer, so policy does not depend on out-of-band bucket cleanup.
- The product avoids exposing destructive restore controls inside the authenticated browser UI.

**Negative:**

- Restore remains a CLI/operator workflow and still requires deliberate access to D1 plus the exported backup file.
- Retention depends on object-key naming staying stable enough for the pruning logic to interpret backup run timestamps.

**Neutral:**

- Operators can still use `--print-sql` to inspect or customize restore behavior before execution.
- A retention value of `0` or an invalid value disables pruning explicitly rather than silently guessing.

## Alternatives Considered

### Add an authenticated restore page inside the app

This was rejected because restore is a highly sensitive operation with database-wide impact. Keeping it in an operator CLI flow is safer and easier to audit.

### Leave retention entirely to bucket lifecycle rules outside the repo

This was rejected because the project needed a portable default that travels with the codebase and works in local and small production deployments without extra platform setup.
