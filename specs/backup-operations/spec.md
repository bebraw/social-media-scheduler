# Feature: Backup Operations

## Blueprint

### Context

The scheduler already writes automated exports to R2, but production operations also need a supported restore path and a retention policy that prevents backup sprawl.

### Architecture

- **Entry points:** the Worker scheduled handler in `src/worker.ts` for automated backup creation plus retention pruning, and `npm run backup:restore` for operator-driven restore execution
- **Source layout:** `src/backup/` owns export, manifest, retention, and storage helpers; `scripts/restore-backup.mjs` owns the operator restore workflow; `docs/backups.md` owns the runbook
- **Data model:** backup exports remain schema-versioned JSON snapshots of auth users, app state, channel connections, and encrypted secrets
- **Operational model:** the Worker keeps a configurable retention window through `BACKUP_RETENTION_DAYS`, while restore stays an explicit CLI action against local or remote D1

### Anti-Patterns

- Do not expose backup restore as a browser action inside the authenticated product.
- Do not let automated backups grow forever without an explicit retention policy.
- Do not require hand-written SQL for normal restore workflows when the export schema is already known.

## Contract

### Definition of Done

- [ ] Automated backups can prune expired artifacts according to the configured retention window.
- [ ] The default retention policy keeps backups for 90 days unless the operator overrides it.
- [ ] Operators can generate restore SQL from a backup export with `npm run backup:restore`.
- [ ] Operators can execute the restore flow against local or remote D1 through the same script.
- [ ] Backup documentation includes the restore workflow, retention configuration, and safety notes.

### Regression Guardrails

- Backup pruning must never delete artifacts newer than the configured retention window.
- Restore SQL must reconstruct channel connection secret-key references deterministically from exported connection ids.
- Restore must continue to support a review-first mode through `--print-sql`, and execution must require explicit operator intent plus an explicit local or remote target.
- Backup exports must remain schema-versioned and reject unknown formats during restore.

### Verification

- **Automated tests:** `src/backup/index.test.ts`, `src/backup/storage.test.ts`, and `scripts/restore-backup.test.mjs`
- **Quality gate:** `npm run quality:gate:fast`

### Scenarios

**Scenario: Automated backup prunes expired artifacts**

- Given: the Worker has an R2 backup bucket with objects older than the retention window
- When: the daily backup flow runs
- Then: it deletes only the expired backup objects and keeps newer ones

**Scenario: Operator restores a backup export**

- Given: the operator has a scheduler export JSON file from R2
- When: they run `npm run backup:restore -- --file ./scheduler-export.json --print-sql`
- Then: the script prints deterministic restore SQL for the exported users, state, connections, and encrypted secrets

**Scenario: Operator restores directly into D1**

- Given: the operator has verified the backup export they want to apply
- When: they run `npm run backup:restore -- --file ./scheduler-export.json --execute --remote`
- Then: the script executes the generated restore SQL against the selected D1 database
