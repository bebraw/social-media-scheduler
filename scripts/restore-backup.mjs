import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const DEFAULT_DATABASE_NAME = "social_media_scheduler_db";

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);

  if (args.help || !args.file) {
    printUsage(args.help ? 0 : 1);
    return;
  }

  if (args.local && args.remote) {
    console.error("Choose either --local or --remote, not both.");
    process.exit(1);
  }

  const fileContents = readFileSync(args.file, "utf8");
  const dataExport = parseSchedulerDataExport(fileContents);
  const sql = buildRestoreSql(dataExport, {
    truncate: !args.append,
  });

  if (args.printSql) {
    process.stdout.write(`${sql}\n`);
  }

  if (args.printSql && !args.local && !args.remote) {
    return;
  }

  const wranglerArgs = ["wrangler", "d1", "execute", args.database ?? DEFAULT_DATABASE_NAME];
  if (args.remote) {
    wranglerArgs.push("--remote");
  } else {
    wranglerArgs.push("--local");
  }
  if (args.persistTo) {
    wranglerArgs.push("--persist-to", args.persistTo);
  }
  if (args.envFile) {
    wranglerArgs.push("--env-file", args.envFile);
  }
  wranglerArgs.push("--command", sql);

  const result = spawnSync("npx", wranglerArgs, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

export function parseSchedulerDataExport(fileContents) {
  let parsed;

  try {
    parsed = JSON.parse(fileContents);
  } catch {
    throw new Error("Backup export must be valid JSON.");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    parsed.app !== "social-media-scheduler" ||
    parsed.schemaVersion !== 2 ||
    !Array.isArray(parsed.authUsers) ||
    !Array.isArray(parsed.stateEntries) ||
    !Array.isArray(parsed.channelConnections) ||
    !Array.isArray(parsed.appSecrets)
  ) {
    throw new Error("Backup export is not in the expected scheduler format.");
  }

  return parsed;
}

export function buildRestoreSql(dataExport, options = {}) {
  const statements = ["BEGIN TRANSACTION;"];

  if (options.truncate !== false) {
    statements.push("DELETE FROM login_attempts;");
    statements.push("DELETE FROM app_secrets;");
    statements.push("DELETE FROM channel_connections;");
    statements.push("DELETE FROM app_state;");
    statements.push("DELETE FROM app_users;");
  }

  for (const user of dataExport.authUsers) {
    statements.push(`INSERT INTO app_users (name, password_hash, role)
VALUES ('${escapeSql(user.name)}', '${escapeSql(user.passwordHash)}', '${escapeSql(user.role)}')
ON CONFLICT(name) DO UPDATE SET
  password_hash = excluded.password_hash,
  role = excluded.role;`);
  }

  for (const entry of dataExport.stateEntries) {
    statements.push(`INSERT INTO app_state (state_key, value_json, updated_at)
VALUES ('${escapeSql(entry.key)}', '${escapeSql(entry.valueJson)}', '${escapeSql(entry.updatedAt)}')
ON CONFLICT(state_key) DO UPDATE SET
  value_json = excluded.value_json,
  updated_at = excluded.updated_at;`);
  }

  for (const connection of dataExport.channelConnections) {
    statements.push(`INSERT INTO channel_connections (
  id,
  channel,
  label,
  account_handle,
  access_token_secret_key,
  refresh_token_secret_key,
  created_at,
  updated_at
) VALUES (
  '${escapeSql(connection.id)}',
  '${escapeSql(connection.channel)}',
  '${escapeSql(connection.label)}',
  '${escapeSql(connection.accountHandle)}',
  '${escapeSql(buildAccessTokenSecretKey(connection.id))}',
  ${connection.hasRefreshToken ? `'${escapeSql(buildRefreshTokenSecretKey(connection.id))}'` : "NULL"},
  '${escapeSql(connection.createdAt)}',
  '${escapeSql(connection.updatedAt)}'
)
ON CONFLICT(id) DO UPDATE SET
  channel = excluded.channel,
  label = excluded.label,
  account_handle = excluded.account_handle,
  access_token_secret_key = excluded.access_token_secret_key,
  refresh_token_secret_key = excluded.refresh_token_secret_key,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;`);
  }

  for (const secret of dataExport.appSecrets) {
    statements.push(`INSERT INTO app_secrets (secret_key, encrypted_value, updated_at)
VALUES ('${escapeSql(secret.key)}', '${escapeSql(secret.encryptedValue)}', '${escapeSql(secret.updatedAt)}')
ON CONFLICT(secret_key) DO UPDATE SET
  encrypted_value = excluded.encrypted_value,
  updated_at = excluded.updated_at;`);
  }

  statements.push("COMMIT;");
  return statements.join("\n\n");
}

function buildAccessTokenSecretKey(connectionId) {
  return `channel_connection:${connectionId}:access_token`;
}

function buildRefreshTokenSecretKey(connectionId) {
  return `channel_connection:${connectionId}:refresh_token`;
}

function escapeSql(value) {
  return String(value).replaceAll("'", "''");
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help") {
      args.help = true;
      continue;
    }
    if (arg === "--local") {
      args.local = true;
      continue;
    }
    if (arg === "--remote") {
      args.remote = true;
      continue;
    }
    if (arg === "--print-sql") {
      args.printSql = true;
      continue;
    }
    if (arg === "--append") {
      args.append = true;
      continue;
    }
    if (arg === "--file") {
      args.file = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--database") {
      args.database = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--persist-to") {
      args.persistTo = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--env-file") {
      args.envFile = argv[index + 1];
      index += 1;
      continue;
    }

    console.error(`Unknown argument: ${arg}`);
    process.exit(1);
  }

  return args;
}

function printUsage(exitCode) {
  const output = exitCode === 0 ? console.log : console.error;
  output(`Usage:
  npm run backup:restore -- --file ./scheduler-export.json --print-sql
  npm run backup:restore -- --file ./scheduler-export.json --remote
  npm run backup:restore -- --file ./scheduler-export.json --append --local

Options:
  --file        Path to a scheduler export JSON file
  --local       Restore into the local D1 database (default when executing)
  --remote      Restore into the remote D1 database
  --append      Keep existing rows instead of truncating auth, state, secrets, and connections first
  --print-sql   Print the generated restore SQL in addition to optionally executing it`);
  process.exit(exitCode);
}
