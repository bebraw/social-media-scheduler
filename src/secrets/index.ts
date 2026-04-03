import type { D1Database } from "../db-core";

const AES_GCM_IV_BYTES = 12;
const PBKDF2_ITERATIONS = 250_000;
const PBKDF2_SALT_BYTES = 16;
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

interface AppSecretRow {
  encrypted_value: string;
  updated_at: string;
}

interface StoredEncryptedSecret {
  algorithm: "AES-GCM";
  ciphertextHex: string;
  ivHex: string;
  iterations: number;
  kdf: "PBKDF2-SHA-256";
  saltHex: string;
  version: 1;
}

export interface StoredAppSecret {
  encryptedValue: string;
  key: string;
  updatedAt: string;
}

export function resolveAppEncryptionSecret(env: { APP_ENCRYPTION_SECRET?: string; SESSION_SECRET?: string }): string {
  const encryptionSecret = env.APP_ENCRYPTION_SECRET?.trim();
  if (encryptionSecret) {
    return encryptionSecret;
  }

  const sessionSecret = env.SESSION_SECRET?.trim();
  if (sessionSecret) {
    return sessionSecret;
  }

  throw new Error("Encrypted secret storage requires APP_ENCRYPTION_SECRET or SESSION_SECRET.");
}

export async function encryptSecretValue(value: string, encryptionSecret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
  const key = await deriveAesKey(encryptionSecret, salt, ["encrypt"]);
  const ciphertextBuffer = await crypto.subtle.encrypt(
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
  } satisfies StoredEncryptedSecret);
}

export async function decryptSecretValue(encryptedValue: string, encryptionSecret: string): Promise<string> {
  const stored = parseStoredEncryptedSecret(encryptedValue);
  const key = await deriveAesKey(encryptionSecret, fromHex(stored.saltHex), ["decrypt"]);
  const plaintextBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(fromHex(stored.ivHex)),
    },
    key,
    toArrayBuffer(fromHex(stored.ciphertextHex)),
  );

  return textDecoder.decode(plaintextBuffer);
}

export async function saveEncryptedSecret(db: D1Database, key: string, value: string, encryptionSecret: string): Promise<void> {
  const encryptedValue = await encryptSecretValue(value, encryptionSecret);
  const updatedAt = new Date().toISOString();

  await db
    .prepare(
      "INSERT INTO app_secrets (secret_key, encrypted_value, updated_at) VALUES (?, ?, ?) ON CONFLICT(secret_key) DO UPDATE SET encrypted_value = excluded.encrypted_value, updated_at = excluded.updated_at",
    )
    .bind(key, encryptedValue, updatedAt)
    .run();
}

export async function deleteEncryptedSecret(db: D1Database, key: string): Promise<void> {
  await db.prepare("DELETE FROM app_secrets WHERE secret_key = ?").bind(key).run();
}

export async function loadEncryptedSecret(db: D1Database, key: string, encryptionSecret: string): Promise<string | null> {
  const row = await db.prepare("SELECT encrypted_value FROM app_secrets WHERE secret_key = ?").bind(key).first<AppSecretRow>();
  if (!row?.encrypted_value) {
    return null;
  }

  return await decryptSecretValue(row.encrypted_value, encryptionSecret);
}

export async function loadStoredSecrets(db: D1Database): Promise<StoredAppSecret[]> {
  const result = await db
    .prepare("SELECT secret_key, encrypted_value, updated_at FROM app_secrets ORDER BY secret_key ASC")
    .all<{ secret_key: string; encrypted_value: string; updated_at: string }>();

  return result.results.map((row) => ({
    encryptedValue: row.encrypted_value,
    key: row.secret_key,
    updatedAt: row.updated_at,
  }));
}

async function deriveAesKey(encryptionSecret: string, salt: Uint8Array, usages: Array<"encrypt" | "decrypt">): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey("raw", textEncoder.encode(encryptionSecret), "PBKDF2", false, ["deriveKey"]);

  return await crypto.subtle.deriveKey(
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

function parseStoredEncryptedSecret(value: string): StoredEncryptedSecret {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Encrypted secret payload must be valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Encrypted secret payload must be an object.");
  }

  const candidate = parsed as Partial<StoredEncryptedSecret>;
  if (
    candidate.version !== 1 ||
    candidate.algorithm !== "AES-GCM" ||
    candidate.kdf !== "PBKDF2-SHA-256" ||
    candidate.iterations !== PBKDF2_ITERATIONS ||
    typeof candidate.saltHex !== "string" ||
    typeof candidate.ivHex !== "string" ||
    typeof candidate.ciphertextHex !== "string"
  ) {
    throw new Error("Encrypted secret payload is not in the expected format.");
  }

  return candidate as StoredEncryptedSecret;
}

function toHex(value: Uint8Array): string {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string): Uint8Array {
  if (value.length === 0 || value.length % 2 !== 0 || /[^0-9a-f]/i.test(value)) {
    throw new Error("Encrypted secret payload contains invalid hex data.");
  }

  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }

  return bytes;
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}
