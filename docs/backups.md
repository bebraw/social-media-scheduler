# Backups

This project can create automated backups when it is deployed on Cloudflare with both D1 and R2 configured.

## What The Scheduled Backup Stores

Each scheduled run compares the latest stored backup against a stable hash of the current export content. When the exported data has changed, the Worker writes three files into the configured R2 bucket:

- a full JSON export containing auth users and generic `app_state` entries
- a Markdown summary report with counts and key names
- a manifest file with counts, the cron expression, and the generated object keys

If the exported data is unchanged, the scheduled run skips creating a new snapshot.

By default the files are stored under:

```text
automated-backups/YYYY/MM/DD/TIMESTAMP/
```

## Security Notes

These backups include password hashes from `app_users`. They do not include plaintext passwords or `.dev.vars` secrets, but they should still be treated as sensitive operational data:

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

There is no in-app restore surface yet. For now, restore is an operator task:

1. Download the JSON export from R2
2. Inspect the auth users and app state entries you want to restore
3. Recreate those rows into D1 with deliberate SQL or a future import tool

That keeps the current implementation lightweight while still preserving recoverable state for future scheduler features.

## Retention

R2 retention is not managed by the Worker itself. A reasonable starting point is:

- keep daily backups for 90 days
- keep a smaller weekly or monthly archive longer if needed
- test a restore periodically instead of only checking that files exist
