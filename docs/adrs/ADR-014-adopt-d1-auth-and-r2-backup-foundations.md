# ADR-014: Adopt D1 Auth and R2 Backup Foundations

**Status:** Accepted

**Date:** 2026-03-31

## Context

The repo started with a runnable Worker stub, but the actual project goal is now a private social media scheduler for personal projects.

Before planning richer UI or channel adapters, the project needs a small but durable operational foundation:

- local authentication so the app is private by default
- lightweight persistence that future scheduler features can extend
- recoverable backups that do not depend on a future UI import/export tool existing first

The reference project `thesis-journey-tracker` already carries a proportionate Cloudflare-native pattern for these concerns: D1-backed local accounts, signed session cookies, login rate limiting, and scheduled R2 backups that skip unchanged exports.

## Decision

We will adopt that same foundation pattern here, adapted to the scheduler's still-abstract domain model.

The repo now uses:

- Cloudflare D1 for `app_users`, `login_attempts`, and generic `app_state`
- PBKDF2-SHA256 password hashes compatible with the Cloudflare Workers runtime
- HMAC-signed `SESSION_SECRET` cookies for authenticated sessions
- an operator-facing `account:create` script for managing D1 auth users
- a scheduled R2 backup flow that writes a JSON export, Markdown summary, and manifest

The scheduler data model intentionally stays generic for now. `app_state` exists as a durable placeholder for future scheduler state until concrete adapter and workflow requirements justify more specific tables.

## Trigger

The project needed auth and backup groundwork before moving into basic UI planning, and the reference implementation already provided a lightweight Cloudflare-native pattern that fits this repo's constraints.

## Consequences

**Positive:**

- The app is private by default instead of shipping a permanently open stub surface.
- Future scheduler features can build on explicit D1 and R2 bindings rather than ad hoc local storage.
- Backup behavior is available early, before the domain model becomes harder to reconstruct later.

**Negative:**

- Local setup now requires D1 migration and account creation before the main UI is usable.
- The repo is no longer stateless.
- R2 backups now contain password hashes and must be treated as sensitive.

**Neutral:**

- The scheduler domain model remains intentionally abstract.
- `APP_ENCRYPTION_SECRET` is reserved for future encrypted adapter credentials but is not required by the current code path.

## Alternatives Considered

### Keep the Worker publicly accessible until the real scheduler UI exists

This was rejected because a private personal scheduler should default toward access control, and retrofitting auth after UI work tends to spread security-sensitive changes across more files.

### Wait to add backups until scheduler tables exist

This was rejected because the backup mechanism itself is a durable architectural concern. Establishing the pattern early is easier than retrofitting scheduled exports after data begins to accumulate.

### Use KV or filesystem-like local storage instead of D1

This was rejected because D1 already fits the Cloudflare-native workflow in the reference implementation and gives a clearer path for future relational scheduler data than ad hoc key-value storage.
