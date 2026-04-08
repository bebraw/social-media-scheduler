# ADR-021: Drive Publishing From A Fixed Worker Poll

**Status:** Accepted

**Date:** 2026-04-08

## Context

The repo now stores real channel connections, encrypted credentials, and per-channel posting schedules, but the authenticated queue still was not a real publishing system.

The previous schedule decision stored Cloudflare-cron-compatible data in D1, yet the deployed runtime still depended on static Wrangler cron entries and manual operator sync. That left the UI as documentation for a deployment step rather than the runtime source of truth.

Moving to production requires three things:

- persisted queued posts that survive page reloads and Worker restarts
- a scheduled runtime that evaluates saved posting schedules directly
- one publishing layer that can invoke provider adapters without scattering provider SDK calls through routes or views

## Decision

We will drive queued publishing from a fixed Worker poller instead of trying to map every saved schedule directly into deployed Wrangler cron triggers.

The repo now uses:

- a server-persisted queued-post store in D1 `app_state`
- a sent-post history store in D1 `app_state`
- a fixed 15-minute Worker cron trigger that evaluates saved per-channel schedules and publishes the oldest due queued post per saved connection
- a separate daily cron trigger for automated backups
- provider-specific publishing behind a shared internal publishing adapter

## Trigger

The product needed to stop pretending it was a scheduler and become one: saved schedules now need to control real runtime behavior, not just render as configuration hints.

## Consequences

**Positive:**

- The authenticated queue, compose page, and scheduled runtime now share one durable queue state.
- Operators can change channel cadence in the app without editing deployment config for each schedule tweak.
- Publishing logic stays organized behind a shared adapter boundary instead of leaking provider SDK calls into the Worker routes.

**Negative:**

- Publish timing is quantized to the fixed poll interval instead of being represented as one native deployment trigger per saved schedule.
- The Worker scheduled path now owns more operational responsibility and needs stronger verification than the earlier backup-only handler.

**Neutral:**

- Saved schedules remain Cloudflare-cron-compatible even though the deployment config now holds only the fixed poller and backup windows.
- The queue model is still intentionally lightweight: one queued text post per publish attempt, oldest first per connection, without richer prioritization yet.

## Alternatives Considered

### Rewrite Wrangler cron triggers from the authenticated UI

This was rejected because deployed trigger configuration is not a runtime-owned surface. Pretending otherwise would hide a real deployment boundary.

### Create one fixed cron trigger per provider

This was rejected because the app already stores finer-grained per-channel schedule data, and a provider-only trigger would still need an internal decision layer.

### Keep the queue as a client-only draft surface

This was rejected because it could not support real scheduled publishing, history, or operational recovery.
