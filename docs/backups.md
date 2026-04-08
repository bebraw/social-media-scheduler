# Backups

This project can create automated backups when it is deployed on Cloudflare with both D1 and R2 configured.

## What The Scheduled Backup Stores

Each scheduled run compares the latest stored backup against a stable hash of the current export content. When the exported data has changed, the Worker writes three files into the configured R2 bucket:

- a full JSON export containing auth users and generic `app_state` entries
- channel connection metadata plus encrypted `app_secrets` entries
- a Markdown summary report with counts and key names
- a manifest file with counts, the cron expression, and the generated object keys

If the exported data is unchanged, the scheduled run skips creating a new snapshot.

By default the files are stored under:

```text
automated-backups/YYYY/MM/DD/TIMESTAMP/
```

By default the Worker also prunes automated backup artifacts older than 90 days. Override that window with `BACKUP_RETENTION_DAYS`, or set it to `0` to disable pruning explicitly.

## Security Notes

These backups include password hashes from `app_users` plus encrypted channel credentials from `app_secrets`. They do not include plaintext passwords or `.dev.vars` secrets, but they should still be treated as sensitive operational data:

- keep the R2 bucket private
- do not share backup downloads casually
- treat restore testing as part of security hygiene, not just operational hygiene

## Cloudflare Configuration

1. Create the R2 bucket:

```bash
npx wrangler r2 bucket create social-media-scheduler-backups
```

2. Keep or adjust the checked-in binding in [`wrangler.jsonc`](../wrangler.jsonc):

```jsonc
"triggers": {
  "crons": ["30 1 * * *"]
},
"r2_buckets": [
  {
    "binding": "BACKUP_BUCKET",
    "bucket_name": "social-media-scheduler-backups"
  }
],
"vars": {
  "BACKUP_PREFIX": "automated-backups"
}
```

The default cron runs every day at `01:30 UTC`. Adjust it if another off-peak window fits your usage better.

Retention is controlled through the Worker environment:

```env
BACKUP_RETENTION_DAYS=90
```

Set `BACKUP_RETENTION_DAYS=0` if you intentionally want to disable Worker-managed pruning and rely on an external lifecycle policy instead.

## Testing The Backup Locally

Wrangler can expose scheduled handlers in local development:

```bash
npx wrangler dev --test-scheduled
```

Then trigger the cron route from another terminal:

```bash
curl "http://127.0.0.1:8787/__scheduled?cron=30+1+*+*+*"
```

If the `BACKUP_BUCKET` binding is configured, the run will write backup artifacts into Wrangler's local R2 state.

## Restore Notes

Restore is now an operator task supported by a first-party script instead of hand-written SQL:

1. Download the JSON export from R2
2. Review the export locally
3. Generate restore SQL:

```bash
npm run backup:restore -- --file ./scheduler-export-2026-04-08.json --print-sql
```

4. Restore into local D1 when ready:

```bash
npm run backup:restore -- --file ./scheduler-export-2026-04-08.json --local
```

5. Restore into remote D1 only after you have reviewed the export and the generated SQL:

```bash
npm run backup:restore -- --file ./scheduler-export-2026-04-08.json --remote
```

By default the restore tool truncates auth users, app state, channel connections, encrypted secrets, and login attempts before replaying the export. Use `--append` if you deliberately need an additive restore instead.

## Retention

Worker-managed retention now defaults to 90 days. A reasonable production practice is still:

- keep the default 90-day rolling window unless you have a stronger policy
- keep a separate offline archive if compliance or audit requirements demand longer retention
- test a restore periodically instead of only checking that files exist
