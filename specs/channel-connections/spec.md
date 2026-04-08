# Feature: Channel Connections

## Blueprint

### Context

The scheduler needs to support real publishing accounts, not just one abstract channel per provider.

Operators may need multiple accounts on the same provider, such as more than one X account, so connection setup has to be account-specific rather than hard-coded to one LinkedIn, one X, and one Bluesky credential slot.

### Architecture

- **Entry points:** authenticated `GET /settings` renders the connection management view and authenticated `POST /settings/channels` validates plus stores new channel connections.
- **Source layout:** `src/channels/` owns connection validation and D1 persistence, `src/providers/` owns provider-specific connection preparation, `src/secrets/` owns encrypted `app_secrets` storage, and `src/views/settings.ts` renders the operator-facing settings UI.
- **Data models:** D1 `channel_connections` stores readable metadata per connected account, while D1 `app_secrets` stores encrypted token-like values keyed per connection.
- **Dependencies:** the feature depends on authenticated sessions, D1, a configured `APP_ENCRYPTION_SECRET` or `SESSION_SECRET` fallback for encryption, and a Worker runtime with Cloudflare `nodejs_compat` enabled because the selected provider SDKs use Node built-ins.

### Anti-Patterns

- Do not collapse all provider credentials into a single one-row-per-provider config because that blocks multi-account publishing.
- Do not store access tokens, refresh tokens, or similar credentials in plaintext columns, `app_state`, or HTML responses.
- Do not store the encryption secret itself in D1 or in R2 backups.

## Contract

### Definition of Done

- [ ] The authenticated workspace navigation includes a Settings view.
- [ ] The Settings view lists each saved channel connection as its own account-level record.
- [ ] Operators can save multiple connections for the same provider.
- [ ] The authenticated Queue, Compose, and History views derive their visible connections from the saved channel setup instead of a fixed provider list.
- [ ] `POST /settings/channels` validates the provider, label, account handle/profile label, and credential input.
- [ ] Bluesky connections validate the submitted handle and app password before the connection is saved.
- [ ] Bluesky connections store returned session tokens instead of persisting the submitted app password.
- [ ] X connections validate the submitted user-context access token before the connection is saved.
- [ ] X connections normalize the stored account handle from the authenticated X username.
- [ ] LinkedIn connections validate the submitted member access token before the connection is saved.
- [ ] LinkedIn connections normalize the stored account identifier from the authenticated LinkedIn member profile.
- [ ] Token-like values are encrypted before they are written to D1.
- [ ] Readonly users can inspect settings but cannot change them.
- [ ] Backup exports include channel connection metadata plus encrypted secret blobs.
- [ ] Automated tests cover encryption, persistence, route handling, and the browser-visible settings flow.

### Regression Guardrails

- The queue page must not keep claiming a fixed provider count once connections are operator-defined.
- The authenticated compose page must not render fixed provider draft tabs when no matching connection exists.
- The authenticated history page must not render fixed provider filters when no matching connection exists.
- Duplicate connections for the same provider and account handle must be rejected.
- Bluesky must not store the submitted app password after exchanging it for session tokens.
- X must not trust a manually entered handle when the validated token resolves to a different authenticated username.
- LinkedIn must not trust a manually entered profile label when the validated token resolves to a different authenticated member profile.
- Encryption must remain reversible only with the configured app-level encryption secret.
- The settings page must never render stored secret values back into the UI.
- Backups may include encrypted credentials, but never the encryption secret itself.

### Verification

- **Automated tests:** `src/providers/bluesky.test.ts`, `src/providers/x.test.ts`, `src/providers/linkedin.test.ts`, `src/channels/index.test.ts`, `src/secrets/index.test.ts`, `src/views/settings.test.ts`, `src/worker.test.ts`, `src/worker.e2e.ts`, and `src/backup/index.test.ts`
- **Quality gate:** `npm run quality:gate`

### Scenarios

**Scenario: Operator reviews configured accounts**

- Given: the operator is already authenticated
- When: they open `/settings`
- Then: they see each saved channel connection with its provider, label, and account identifier

**Scenario: Operator adds a second X account**

- Given: the operator is already authenticated and already has one X connection saved
- When: they submit `POST /settings/channels` for another X account with a different handle
- Then: D1 stores a second `channel_connections` row and separate encrypted secret entries for that account

**Scenario: Operator adds a Bluesky connection with an app password**

- Given: the operator is already authenticated
- When: they submit `POST /settings/channels` with the Bluesky handle and app password
- Then: the app validates the Bluesky login, stores the normalized handle in `channel_connections`, and encrypts the returned session tokens instead of the submitted password

**Scenario: Operator adds an X connection with a user token**

- Given: the operator is already authenticated
- When: they submit `POST /settings/channels` with an X user-context access token
- Then: the app validates the token against the authenticated X account, stores the normalized `@username` in `channel_connections`, and encrypts the submitted token values

**Scenario: Operator adds a LinkedIn connection with a member token**

- Given: the operator is already authenticated
- When: they submit `POST /settings/channels` with a LinkedIn member access token
- Then: the app validates the token against the authenticated member profile, stores a normalized member identifier in `channel_connections`, and encrypts the submitted token values

**Scenario: Readonly user attempts to add a connection**

- Given: the authenticated user has the `readonly` role
- When: they submit `POST /settings/channels`
- Then: the Worker rejects the request with HTTP 403
