# Setup

This guide covers the local setup flow for running the private scheduler foundation for the first time.

## Prerequisites

- Node.js `24.14.1` via `package.json`
- npm `11.11.0` via that pinned Node release
- A Cloudflare account with Wrangler access

## 1. Install Dependencies

If you use `nvm`, switch to the pinned Node release first:

```bash
nvm use 24.14.1
```

```bash
npm install
```

## 2. Create The D1 Database

Create the database once:

```bash
npx wrangler d1 create social_media_scheduler_db
```

Wrangler will return a `database_id`. Replace the placeholder value in [`wrangler.jsonc`](../wrangler.jsonc):

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "social_media_scheduler_db",
    "database_id": "YOUR_DATABASE_ID",
    "migrations_dir": "migrations"
  }
]
```

The repo checks in an all-zero placeholder UUID so the binding shape is explicit in version control. Replace it before relying on local or remote D1 flows.

## 3. Configure Local Secrets

Create your local environment file:

```bash
cp .dev.vars.example .dev.vars
```

Set these values in `.dev.vars`:

- `SESSION_SECRET`: required, used to sign auth cookies
- `DEMO_MODE`: optional, set to `true` if you want the local-only demo workspace at `/demo`
- `APP_ENCRYPTION_SECRET`: optional for future encrypted adapter credentials; if omitted, future encrypted storage can fall back to `SESSION_SECRET`

Example:

```env
SESSION_SECRET=change-this-to-a-long-random-secret
DEMO_MODE=true
APP_ENCRYPTION_SECRET=change-this-to-a-different-long-random-secret
```

## 4. Apply Migrations

```bash
npm run db:migrate
```

This applies the SQL files in [`migrations/`](../migrations) to Wrangler's local D1 state for the configured `social_media_scheduler_db` binding.

## 5. Create At Least One Login Account

Create an editor account in D1:

```bash
npm run account:create -- --name "Scheduler Admin" --password "change-this-password" --role editor
```

Optional readonly account:

```bash
npm run account:create -- --name "Read Only" --password "change-this-password" --role readonly
```

The command defaults to local D1 writes. Add `--remote` if you want to write to the deployed database instead.

## 6. Optionally Configure Scheduled Backups

Create the R2 bucket if you want automated backups:

```bash
npx wrangler r2 bucket create social-media-scheduler-backups
```

The checked-in [`wrangler.jsonc`](../wrangler.jsonc) already includes:

- `BACKUP_BUCKET` bound to `social-media-scheduler-backups`
- daily cron `30 1 * * *`
- `BACKUP_PREFIX=automated-backups`

If you want different names or retention rules, adjust the binding and update the corresponding docs in the same change set.

## 7. Start The App

```bash
npm run dev
```

Open the local URL shown by Wrangler, usually `http://127.0.0.1:8787`.

After signing in, the app opens on the default `Queue` view at `/`. Use `/compose` for the dedicated post composer.

If `DEMO_MODE=true` is set in `.dev.vars`, local development also exposes `/demo` on loopback hosts for seeded demo data and local-only scheduling practice.

## First Run Checklist

- If login fails immediately, confirm that `.dev.vars` contains `SESSION_SECRET`.
- If the app says no auth users exist, rerun `npm run account:create`.
- If D1 commands fail, confirm that `wrangler.jsonc` no longer contains the placeholder `database_id`.
- If you want browser verification, keep the default e2e account credentials aligned with `npm run e2e:prepare`.

## Related Docs

- [backups.md](./backups.md)
- [development.md](./development.md)
