# ADR-016: Store Posting Schedules As Cloudflare Cron

**Status:** Accepted

**Date:** 2026-04-02

## Context

The scheduler now has enough authenticated UI surface to let operators shape channel cadence directly in the app.

That introduces a lasting design choice: whether posting schedules should live as a custom scheduler data model, a heavier dedicated config store, or a representation that already matches the Cloudflare Worker runtime the project uses.

Cloudflare scheduled events already use cron expressions, but the authenticated app cannot rewrite deployed Wrangler Cron Triggers at runtime. Any schedule feature needs to make that boundary explicit instead of hiding it behind a misleading abstraction.

## Decision

We will store per-channel posting schedules in D1 `app_state` as Cloudflare-cron-compatible expressions derived from queue-side weekday and UTC time controls.

The repo now uses:

- one `posting_schedules_v1` app-state entry for the saved per-channel schedule set
- a queue-side editor that derives and shows the Cloudflare cron string for each channel
- explicit documentation that saved schedules do not mutate `wrangler.jsonc` or deployed Cron Triggers automatically

## Trigger

Operators needed to adjust per-channel posting cadence before any real publishing adapter exists, and the feature needed to fit the repo's Cloudflare-native baseline without introducing a heavier custom scheduler layer.

## Consequences

**Positive:**

- The saved schedule format already matches the runtime trigger language the Worker ecosystem uses.
- The feature stays lightweight by reusing generic D1 `app_state` instead of adding a new scheduler-specific table.
- Future scheduled publishing work can build from explicit cron-compatible state rather than reverse-engineering a UI-only rule format.

**Negative:**

- Deployment still requires a manual step to sync saved cron expressions into Wrangler Cron Triggers.
- The first schedule editor supports one weekly posting window per channel rather than a richer multi-slot planner.

**Neutral:**

- The queue view becomes the place where operators review both queued work and baseline channel cadence.
- Backup exports now include the saved posting schedule because it lives in `app_state`.

## Alternatives Considered

### Create a custom posting schedule DSL

This was rejected because it would add a second rule language that future scheduled runtime work would need to translate back into cron anyway.

### Add a dedicated D1 schedule table immediately

This was rejected because one per-channel schedule set does not justify a more specific schema yet, and the repo already treats `app_state` as the lightweight durable store for emerging scheduler state.

### Pretend the UI can rewrite deployed Cron Triggers

This was rejected because Worker deployment config is explicit and separate from authenticated runtime state. Hiding that would make the feature look more automatic than it really is.
