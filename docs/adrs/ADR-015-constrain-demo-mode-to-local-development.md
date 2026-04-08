# ADR-015: Constrain Demo Mode To Local Development

**Status:** Superseded by [ADR-020](./ADR-020-align-local-development-with-production-routes.md)

**Date:** 2026-04-02

## Context

The scheduler UI still benefits from seeded example data during local development because the real posting workflow is not yet connected to external publishing adapters.

Leaving seeded drafts, queue entries, and history examples on the normal authenticated routes would blur the line between real app state and demonstration state. It would also make future adapter work harder to reason about because the production-facing pages would keep carrying development-only assumptions.

At the same time, developers still need a safe place to exercise scheduling flows without calling any real service.

## Decision

We will isolate seeded example data behind a dedicated demo mode route.

The repo now uses:

- a dedicated authenticated `/demo` route for local seeded scheduler data
- explicit `DEMO_MODE=true` configuration in `.dev.vars` to enable that route
- an additional loopback-host check so demo mode is available only through local development URLs such as `127.0.0.1` and `localhost`
- local D1-backed app state for demo scheduling changes so demo queue writes stay inside the local sandbox

The normal authenticated routes `/`, `/compose`, and `/history` must not rely on seeded demo content.

## Trigger

The repo needed to preserve a useful local walkthrough surface while making the main authenticated product routes safe to interpret as real application state.

## Consequences

**Positive:**

- Normal authenticated routes now have a cleaner boundary between real state and demo state.
- Developers still have a safe sandbox for local walkthroughs and UI verification.
- Demo scheduling remains testable without introducing any external publishing integration.

**Negative:**

- The repo now carries an additional local-only route and gate.
- Developers must opt in through `.dev.vars` before the demo surface appears.

**Neutral:**

- Demo queue writes live in local D1 app state and can still be included in local backup/export flows.
- Future real publishing adapters can evolve separately from the demo sandbox.

## Alternatives Considered

### Keep seeded data on the main authenticated routes

This was rejected because it would keep blurring the boundary between real scheduler state and demonstration state.

### Remove seeded data entirely and offer no demo surface

This was rejected because local development still benefits from a safe walkthrough mode while adapter integrations do not exist yet.

### Enable demo mode through a deployed environment flag alone

This was rejected because the goal is to keep demo mode local-only, not merely optional.
