# ADR-019: Enable Node.js Compatibility for Provider SDKs

**Status:** Accepted

**Date:** 2026-04-08

## Context

The repo now validates and stores real provider connections for Bluesky, X, and LinkedIn through third-party SDKs selected in ADR-018.

Those libraries are intentionally isolated behind internal provider adapters, but at least part of that dependency set still assumes Node-style built-ins such as `crypto` during local Worker development and bundling.

Without an explicit Worker runtime compatibility setting, `wrangler dev` fails with the error:

> The package "crypto" wasn't found on the file system but is built into node.

That makes Node compatibility a durable runtime constraint for the current provider-integration architecture rather than an incidental local setup detail.

## Decision

The repo will enable Cloudflare Workers' `nodejs_compat` compatibility flag in `wrangler.jsonc`.

We will treat that flag as part of the runtime baseline for the current provider-adapter stack:

- keep `compatibility_flags: ["nodejs_compat"]` in Wrangler config
- rely on the existing `compatibility_date` to pick up current Node compatibility behavior
- document the constraint in the repo architecture and development docs
- revisit the requirement only if provider dependencies are replaced with Worker-native integrations that no longer require Node built-ins

## Trigger

Local development failed once the provider SDK stack was active because Wrangler could not resolve the Node built-in `crypto` module without the Cloudflare Node compatibility runtime enabled.

## Consequences

**Positive:**

- `npm run dev` can bundle provider SDK dependencies that expect Node built-ins.
- The runtime requirement becomes explicit for future contributors instead of surfacing as a confusing local error.
- The repo stays aligned with the provider-library-first direction accepted in ADR-018.

**Negative:**

- The Worker runtime now depends on Cloudflare's Node compatibility layer instead of a strictly Web-standard runtime surface.
- Future provider or utility dependencies may quietly lean on more Node APIs once the compatibility layer is available, so runtime scope should still be reviewed during upgrades.

**Neutral:**

- Provider adapters remain the boundary for SDK usage; this ADR changes the Worker runtime contract, not the internal module layout.
- Existing application behavior, data storage, and route contracts do not change.

## Alternatives Considered

### Replace the current provider libraries with Worker-native or raw `fetch` implementations

This was rejected for now because the repo already accepted a library-first provider strategy in ADR-018, and replacing the SDK layer would be a materially larger design change than enabling the runtime compatibility required by the current approach.

### Patch around the failing import locally without changing the Worker runtime contract

This was rejected because the failure comes from the deployed Worker bundling/runtime boundary, not just one local machine. A one-off workaround would hide a repo-level constraint that future contributors still need to understand.

## References

- Cloudflare Workers Node.js compatibility docs: <https://developers.cloudflare.com/workers/runtime-apis/nodejs/>
