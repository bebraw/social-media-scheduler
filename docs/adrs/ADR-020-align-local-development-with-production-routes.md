# ADR-020: Align Local Development With Production Routes

**Status:** Accepted

**Date:** 2026-04-08

## Context

The repo previously kept a dedicated local-only `/demo` surface with seeded drafts, queue entries, and history.

That sandbox reduced the risk of confusing seeded state with real scheduler state on the main authenticated routes, but it also introduced a second product surface that local development and browser tests could drift toward.

Once the scheduler started adding real connection validation, the extra route became a liability:

- local development no longer matched the production route set
- browser tests could exercise behavior that production never exposes
- contributors had to maintain duplicate UI and routing paths just to get a seeded walkthrough
- CI failures became harder to reason about because some flows existed only in local development

The user explicitly prefers a local environment that behaves like production so testing stays simpler and discrepancies are reduced.

## Decision

We will remove the dedicated demo mode and keep local development on the same authenticated route surface as production.

The repo now uses:

- the same authenticated routes locally and in production: `/`, `/compose`, `/history`, `/settings`, and their related POST handlers
- deterministic e2e setup through `npm run e2e:prepare` instead of a separate local-only demo workspace
- empty or real persisted application state on the normal routes rather than seeded demo-only content behind `/demo`

Local development may still use seeded fixtures for tests, but those fixtures must be introduced through the same production-facing routes and persistence setup that the app uses everywhere else.

## Trigger

The dedicated demo mode created a mismatch between local development and production behavior, and that mismatch started showing up as avoidable test discrepancies.

## Consequences

**Positive:**

- Local development and production now exercise the same route set.
- Browser verification targets only real application surfaces.
- The app drops a local-only branch of UI, routing, and state management.
- Future testing setup stays focused on seeded fixtures and persistence, not alternate product surfaces.

**Negative:**

- The repo no longer ships a built-in sandbox page with preloaded example content.
- Local walkthroughs now require configuring real local state such as accounts, connections, and queue data.

**Neutral:**

- Seeded e2e fixtures remain acceptable when they are loaded through the normal local setup path.
- Earlier rationale about keeping demo data away from the main routes still matters, but it is now handled by using empty or seeded persisted state on the real routes rather than a separate `/demo` product surface.

## Alternatives Considered

### Keep the demo route and improve its documentation

This was rejected because better documentation would not remove the core local-versus-production route mismatch.

### Keep a local-only demo route but exclude it from tests

This was rejected because the extra route would still impose ongoing maintenance cost and still invite drift during local development.

### Seed the main routes directly in local development by default

This was rejected because the user explicitly wanted the local environment to behave like production, and default seeded content on normal routes would blur the distinction between real state and example state again.
