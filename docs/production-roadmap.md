# Production Roadmap

This roadmap turns the current production-readiness review into an implementation sequence with reviewable slices.

## Phase 1: Real Publishing Runtime

Goal: move from a private scheduler foundation to a deployable scheduler that can actually publish queued posts.

- Persist queued posts on the server instead of keeping them only in client-side page state.
- Add authenticated queue actions for creating, reviewing, and removing queued posts.
- Add a provider-agnostic publishing layer behind provider adapters.
- Publish queued posts from the Worker scheduled handler and record outcomes in sent-post history.
- Change scheduled execution so saved posting schedules drive runtime behavior instead of acting as manual documentation for Wrangler cron edits.

## Phase 2: Connection Rotation And Revocation

Goal: make provider credentials operable in production without manual D1 surgery.

- Add editor-only flows to rotate stored credentials for an existing connection.
- Add editor-only flows to revoke and delete a saved connection.
- Ensure secret cleanup happens when a connection is deleted or replaced.
- Keep readonly access unchanged.

## Phase 3: Backup Operations

Goal: make backups usable as an operational control instead of a write-only artifact stream.

- Add an operator restore path for backup exports.
- Add retention controls so automated backups do not grow without policy.
- Document the production backup and restore runbook.

## Delivery Order

1. Roadmap and planning artifacts
2. Real queue and scheduled publishing runtime
3. Connection rotation and revocation
4. Backup restore and retention improvements

Each phase should land as its own commit after the relevant verification passes.
