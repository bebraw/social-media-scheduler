# Production Roadmap

This roadmap started as a production-readiness implementation sequence. It now reflects what has landed and what still needs operator follow-through before a production push.

## Status

- `Completed`: roadmap and planning artifacts
- `Completed`: real queue and scheduled publishing runtime
- `Completed`: connection rotation and revocation
- `Completed`: backup restore and retention improvements
- `Remaining`: deployment configuration, live-provider validation, and production runbook rehearsal

## Completed Work

### Phase 1: Real Publishing Runtime

Delivered:

- queued posts now persist on the server instead of living only in page state
- authenticated queue actions support create, review, and delete flows
- provider publishing runs behind a shared internal adapter layer
- the Worker scheduled handler publishes due queued posts and records outcomes in sent-post history
- saved posting schedules now drive runtime behavior through the fixed publishing poll

### Phase 2: Connection Rotation And Revocation

Delivered:

- editor-only flows now rotate stored credentials for existing connections
- editor-only flows now revoke and delete saved connections
- secret cleanup happens when a connection is deleted or rotated
- readonly access remains unchanged

### Phase 3: Backup Operations

Delivered:

- backup restore now has an operator CLI path
- automated backups now enforce a retention policy
- the production backup and restore runbook is documented

## Remaining Before Production

### Deployment Configuration

- replace the placeholder D1 `database_id` in `wrangler.jsonc`
- provision and bind the production R2 backup bucket if backups are required
- set real deployment secrets for `SESSION_SECRET` and `APP_ENCRYPTION_SECRET`

### Live Validation

- run one real canary publish on each provider you plan to use in production
- verify the provider tokens and scopes you intend to rely on in production
- rehearse one backup restore with `npm run backup:restore -- --file ... --print-sql` before treating backups as operationally ready

### Final Verification

- rerun `npm run quality:gate:fast`
- rerun `npm run ci:local:quiet` on a machine with Docker access
- perform a final deploy smoke test against the production environment
