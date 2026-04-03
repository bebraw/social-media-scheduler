# ADR-017: Store Channel Connections and Encrypted Credentials

**Status:** Accepted

**Date:** 2026-04-03

## Context

The scheduler now needs an operator-facing way to configure actual publishing accounts.

That requirement changes two earlier assumptions:

- one provider no longer maps cleanly to one credential slot because operators may need multiple accounts on the same provider
- adapter credentials can no longer stay as a future concern because the settings UI needs to persist them now

The repo already reserved `APP_ENCRYPTION_SECRET` and `app_secrets`, but it did not yet define how multi-account connections should be modeled or how encrypted credentials should relate to readable account metadata.

## Decision

We will model channel setup as account-level channel connections.

The repo now uses:

- a dedicated D1 `channel_connections` table for readable metadata such as provider, label, and account handle/profile label
- D1 `app_secrets` for encrypted token-like values keyed per connection
- an authenticated `/settings` view plus `POST /settings/channels` endpoint for managing connections
- `APP_ENCRYPTION_SECRET` as the preferred encryption key, with `SESSION_SECRET` as the fallback when a separate encryption secret is not configured

Backups continue to include recoverable state, which now means channel connection metadata plus encrypted credential blobs. The encryption secret itself remains environment-managed and is never stored in D1 or R2.

## Trigger

The product scope moved from abstract per-provider channels toward real account configuration, and the user explicitly identified the need for multiple X accounts plus encrypted credential storage.

## Consequences

**Positive:**

- The scheduler can represent multiple accounts on the same provider without special-case config code.
- Readable settings metadata stays queryable without exposing plaintext credentials.
- Future publishing adapters can load credentials through one reusable encrypted-secret layer instead of inventing provider-specific storage.

**Negative:**

- The data model is now more concrete than the earlier generic `app_state` placeholder approach.
- Backups become more sensitive because they now include encrypted adapter credentials as recoverable artifacts.
- Restores will need both the database content and the matching encryption secret to make credentials usable again.

**Neutral:**

- `APP_ENCRYPTION_SECRET` is no longer just reserved; it is now part of the active storage design.
- The queue and settings UI now distinguish provider-level channels from account-level connections.

## Alternatives Considered

### Store all connection data in `app_state`

This was rejected because multi-account connection metadata is now structured enough to justify its own table, and mixing readable metadata with encrypted secret payloads in one JSON blob would make validation, querying, and future updates harder.

### Store credentials plaintext in `channel_connections`

This was rejected because the app now holds real publishing credentials. Plaintext storage would make D1 reads and backups unnecessarily risky, and the repo already had a lightweight secret-storage path available.

### Require a separate secret manager before shipping settings

This was rejected because the project already relies on D1 as its lightweight persistence baseline. Encrypting credentials before writing them to D1 fits the repo’s current scale without introducing a heavier platform dependency first.
