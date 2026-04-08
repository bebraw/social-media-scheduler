import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { webcrypto } from "node:crypto";

const AES_GCM_IV_BYTES = 12;
const DEFAULT_DATABASE_NAME = "social_media_scheduler_db";
const PBKDF2_ITERATIONS = 250_000;
const PBKDF2_SALT_BYTES = 16;
const textEncoder = new TextEncoder();

const E2E_CONNECTION = {
  accessToken: "e2e-access-token",
  accountHandle: "@scheduler-admin-e2e",
  channel: "x",
  id: "e2e-x-main",
  label: "Personal X E2E",
  refreshToken: "e2e-refresh-token",
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnvFile(args.envFile);
  const encryptionSecret = (env.APP_ENCRYPTION_SECRET || env.SESSION_SECRET || "").trim();

  if (!encryptionSecret) {
    throw new Error("E2E channel seeding requires APP_ENCRYPTION_SECRET or SESSION_SECRET in the env file.");
  }

  const accessTokenSecretKey = buildAccessTokenSecretKey(E2E_CONNECTION.id);
  const refreshTokenSecretKey = buildRefreshTokenSecretKey(E2E_CONNECTION.id);
  const timestamp = new Date().toISOString();
  const sql = [
    upsertSecretSql(accessTokenSecretKey, await encryptSecretValue(E2E_CONNECTION.accessToken, encryptionSecret), timestamp),
    upsertSecretSql(refreshTokenSecretKey, await encryptSecretValue(E2E_CONNECTION.refreshToken, encryptionSecret), timestamp),
    upsertConnectionSql({
      accessTokenSecretKey,
      accountHandle: E2E_CONNECTION.accountHandle,
      channel: E2E_CONNECTION.channel,
      createdAt: timestamp,
      id: E2E_CONNECTION.id,
      label: E2E_CONNECTION.label,
      refreshTokenSecretKey,
      updatedAt: timestamp,
    }),
  ].join("\n");

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

function buildAccessTokenSecretKey(connectionId) {
  return `channel_connection:${connectionId}:access_token`;
}

function buildRefreshTokenSecretKey(connectionId) {
  return `channel_connection:${connectionId}:refresh_token`;
}

async function encryptSecretValue(value, encryptionSecret) {
  const iv = getCrypto().getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  const salt = getCrypto().getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
  const key = await deriveAesKey(encryptionSecret, salt, ["encrypt"]);
  const ciphertextBuffer = await getCrypto().subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    textEncoder.encode(value),
  );

  return JSON.stringify({
    algorithm: "AES-GCM",
    ciphertextHex: toHex(new Uint8Array(ciphertextBuffer)),
    ivHex: toHex(iv),
    iterations: PBKDF2_ITERATIONS,
    kdf: "PBKDF2-SHA-256",
    saltHex: toHex(salt),
    version: 1,
  });
}

async function deriveAesKey(encryptionSecret, salt, usages) {
  const keyMaterial = await getCrypto().subtle.importKey("raw", textEncoder.encode(encryptionSecret), "PBKDF2", false, ["deriveKey"]);

  return await getCrypto().subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    usages,
  );
}

function getCrypto() {
  return globalThis.crypto ?? webcrypto;
}

function loadEnvFile(filePath) {
  if (!filePath) {
    return process.env;
  }

  const env = { ...process.env };
  const content = readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    env[key] = stripQuotes(value);
  }

  return env;
}

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--local") {
      args.local = true;
      continue;
    }
    if (arg === "--remote") {
      args.remote = true;
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

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (args.local && args.remote) {
    throw new Error("Choose either --local or --remote, not both.");
  }

  return args;
}

function upsertSecretSql(secretKey, encryptedValue, updatedAt) {
  return `INSERT INTO app_secrets (secret_key, encrypted_value, updated_at)
VALUES ('${escapeSql(secretKey)}', '${escapeSql(encryptedValue)}', '${escapeSql(updatedAt)}')
ON CONFLICT(secret_key) DO UPDATE SET
  encrypted_value = excluded.encrypted_value,
  updated_at = excluded.updated_at;`;
}

function upsertConnectionSql(connection) {
  return `INSERT INTO channel_connections (
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
  '${escapeSql(connection.accessTokenSecretKey)}',
  '${escapeSql(connection.refreshTokenSecretKey)}',
  '${escapeSql(connection.createdAt)}',
  '${escapeSql(connection.updatedAt)}'
)
ON CONFLICT(id) DO UPDATE SET
  channel = excluded.channel,
  label = excluded.label,
  account_handle = excluded.account_handle,
  access_token_secret_key = excluded.access_token_secret_key,
  refresh_token_secret_key = excluded.refresh_token_secret_key,
  updated_at = excluded.updated_at;`;
}

function escapeSql(value) {
  return String(value).replaceAll("'", "''");
}

function toHex(value) {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toArrayBuffer(value) {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}
