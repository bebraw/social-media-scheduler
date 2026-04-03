# ADR-018: Use Provider Adapters and Library-First Social Integrations

**Status:** Accepted

**Date:** 2026-04-03

## Context

The repo now stores account-level channel connections and encrypted credentials, but it still does not have a real publishing integration layer.

The next publishing slice needs to connect to Bluesky, X, and LinkedIn without scattering provider-specific OAuth, request signing, media upload, and token refresh logic through the Worker routes or views.

The current channel setup is intentionally generic:

- [`src/channels/index.ts`](../../src/channels/index.ts) stores connection metadata and secret-key references
- [`src/secrets/index.ts`](../../src/secrets/index.ts) encrypts token-like values at rest
- [`src/views/settings.ts`](../../src/views/settings.ts) currently renders a provider-agnostic credential form

That baseline is good for storage, but not yet specific enough for real provider integrations. Bluesky, X, and LinkedIn all differ materially in auth shape, SDK maturity, and media constraints.

This ADR captures the research pass and the first concrete provider implementation so future work starts from explicit trade-offs instead of repeating the same library evaluation.

## Decision

The repo will use a library-first provider-adapter architecture instead of hand-rolling every provider client from raw HTTP.

The architecture direction is:

- add one internal provider adapter per social network behind a shared publishing interface
- keep provider SDKs and protocol details out of routes, views, and generic channel persistence
- store provider-specific credentials in encrypted secrets, but resolve and normalize them inside the provider adapter layer
- test each provider integration through adapter contract tests and mocked SDK clients rather than live API calls in the baseline gate

The preferred provider choices are:

- **Bluesky:** prefer `@atproto/api`
- **X:** prefer `@xdevplatform/xdk`
- **LinkedIn:** prefer `linkedin-api-client`, but only behind a narrow adapter boundary because the library is beta and documented for Node.js server applications

## Trigger

The repo now has multi-account channel setup, and the first provider-specific integration slice needed a durable boundary before more social-network code accumulated in generic settings and channel modules.

## Consequences

**Positive:**

- Future publishing code can stay organized around one stable internal adapter contract instead of leaking provider-specific SDK calls across the app.
- The implementation can reuse official or near-official client behavior for OAuth flows, request formatting, media helpers, and typed responses where available.
- Tests can target the repo's own adapter contract while mocking provider libraries, which keeps the baseline gate deterministic and fast.
- Provider differences become explicit in one layer, which fits the repo's existing split between generic connection storage and future provider execution.
- Bluesky connections now exchange a handle plus app password for session tokens before encrypted persistence, so the app does not retain the raw app password.

**Negative:**

- The settings and credential model still needs to evolve beyond the current generic access-token and refresh-token form.
- LinkedIn remains the riskiest integration because access is approval-gated and the current official JavaScript client is marked beta and positioned for Node.js server use.
- X and LinkedIn auth flows may require additional provider-specific metadata beyond what `channel_connections` stores today.
- Wrapping SDKs behind adapters adds a small layer of translation code that would not exist in a direct HTTP-only implementation.

**Neutral:**

- The current generic connection storage design remains useful, but it becomes the persistence input to provider adapters rather than the integration boundary itself.
- The queue and compose constraints can stay generic at first, but provider-specific capability metadata will likely need to sit beside them once real publishing and media uploads exist.

## Alternatives Considered

### Implement every provider directly with raw `fetch`

This was rejected as the default because it would duplicate auth, request-shaping, and error-handling work that existing libraries already cover. It also increases the chance that provider quirks spread into unrelated application code.

### Use one generic cross-provider social SDK

This was rejected because Bluesky, X, and LinkedIn have meaningfully different platform models and auth requirements. A fake common denominator would likely hide important constraints and still require provider-specific escape hatches.

### Put provider SDK usage directly in routes or views

This was rejected because it would couple UI and request handling to provider-specific logic, making testing and later replacement harder. The repo already keeps generic channel persistence separate from UI concerns, and publishing should preserve that separation.

## Provider Notes

### Bluesky

- `@atproto/api` is the strongest fit from this research pass.
- The official docs show session creation, posting, and blob upload flows.
- The implemented connection flow now treats the submitted value as an app password, validates it against Bluesky, and stores the returned `accessJwt` and `refreshJwt` session tokens instead of the raw password.

### X

- `@xdevplatform/xdk` is the preferred first choice because it is the official TypeScript SDK.
- The implementation should keep OAuth 2.0 user-context auth as the preferred path and allow for OAuth 1.0a where X still requires it.
- The repo should eventually replace the current approximate X character-counting logic with an official parser such as `twitter-text` when real publishing validation lands.

### LinkedIn

- `linkedin-api-client` is the best available library candidate from this research pass because it hides Rest.li request construction and exposes auth helpers.
- It should be isolated behind the narrowest adapter boundary of the three providers.
- Implementation work should verify Cloudflare Worker compatibility before treating it as a settled runtime dependency.

## Testing Notes

The implementation plan implied by this proposal is:

- unit-test credential normalization and secret lookup separately from SDK calls
- unit-test each provider adapter with mocked SDK clients
- add provider-agnostic contract tests for publish and refresh behavior
- keep live provider smoke tests opt-in and out of the baseline quality gate

## Research Sources

- Bluesky get started: <https://docs.bsky.app/docs/get-started>
- Bluesky posts guide: <https://docs.bsky.app/docs/advanced-guides/posts>
- X TypeScript SDK install: <https://docs.x.com/xdks/typescript/install>
- X API overview: <https://docs.x.com/x-api>
- LinkedIn JavaScript client: <https://github.com/linkedin-developers/linkedin-api-js-client>
- LinkedIn access overview: <https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access>
- LinkedIn Posts API: <https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2025-11>
- LinkedIn refresh tokens: <https://learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens>
