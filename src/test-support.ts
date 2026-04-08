import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashPassword } from "./auth";
import type { Env } from "./app-env";
import type { D1Database, D1PreparedStatement } from "./db-core";
import type { AccessRole } from "./auth";
import type { R2BucketLike, R2ListOptions, R2ListResult, R2ObjectBodyLike, R2PutOptions } from "./backup";

export function ensureGeneratedStylesheet(): void {
  mkdirSync(".generated", { recursive: true });
  writeFileSync(join(".generated", "styles.css"), ":root{--color-app-canvas:#f5efe6;}", "utf8");
}

interface TestAuthUserRecord {
  id: number;
  name: string;
  passwordHash: string;
  role: AccessRole;
}

interface TestLoginAttemptRecord {
  attemptKey: string;
  failureCount: number;
  firstFailedAt: string;
  lastFailedAt: string;
  lockedUntil: string | null;
}

interface TestStateEntryRecord {
  key: string;
  valueJson: string;
  updatedAt: string;
}

interface TestSecretEntryRecord {
  encryptedValue: string;
  key: string;
  updatedAt: string;
}

interface TestChannelConnectionRecord {
  accessTokenSecretKey: string;
  accountHandle: string;
  channel: "linkedin" | "x" | "bluesky";
  createdAt: string;
  id: string;
  label: string;
  refreshTokenSecretKey: string | null;
  updatedAt: string;
}

interface TestDatabaseState {
  appUsers: TestAuthUserRecord[];
  appSecrets: Map<string, TestSecretEntryRecord>;
  channelConnections: Map<string, TestChannelConnectionRecord>;
  loginAttempts: Map<string, TestLoginAttemptRecord>;
  appState: Map<string, TestStateEntryRecord>;
  nextUserId: number;
}

export class TestDatabase implements D1Database {
  readonly state: TestDatabaseState = {
    appUsers: [],
    appSecrets: new Map(),
    channelConnections: new Map(),
    loginAttempts: new Map(),
    appState: new Map(),
    nextUserId: 1,
  };

  prepare(query: string): D1PreparedStatement {
    return new TestPreparedStatement(this.state, query);
  }
}

class TestPreparedStatement implements D1PreparedStatement {
  private readonly normalizedQuery: string;
  private bindings: Array<string | number | null> = [];

  constructor(
    private readonly state: TestDatabaseState,
    query: string,
  ) {
    this.normalizedQuery = query.replace(/\s+/g, " ").trim().toLowerCase();
  }

  bind(...values: Array<string | number | null>): D1PreparedStatement {
    this.bindings = values;
    return this;
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const result = await this.executeSelect();
    return (result[0] as T | undefined) ?? null;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    return { results: (await this.executeSelect()) as T[] };
  }

  async run<T = Record<string, unknown>>(): Promise<{ success: boolean; meta: { last_row_id?: number; changes?: number }; results?: T[] }> {
    if (this.normalizedQuery.startsWith("insert into app_users")) {
      const [name, passwordHash, role] = this.bindings as [string, string, AccessRole];
      const existingUser = this.state.appUsers.find((user) => user.name.toLocaleLowerCase() === name.toLocaleLowerCase());

      if (existingUser) {
        existingUser.passwordHash = passwordHash;
        existingUser.role = role;
        return { success: true, meta: { last_row_id: existingUser.id, changes: 1 } };
      }

      const nextUser = {
        id: this.state.nextUserId,
        name,
        passwordHash,
        role,
      };
      this.state.nextUserId += 1;
      this.state.appUsers.push(nextUser);
      this.state.appUsers.sort((left, right) => left.name.localeCompare(right.name));
      return { success: true, meta: { last_row_id: nextUser.id, changes: 1 } };
    }

    if (this.normalizedQuery.startsWith("insert into login_attempts")) {
      const [attemptKey, failureCount, firstFailedAt, lastFailedAt, lockedUntil] = this.bindings as [
        string,
        number,
        string,
        string,
        string | null,
      ];
      this.state.loginAttempts.set(attemptKey, {
        attemptKey,
        failureCount,
        firstFailedAt,
        lastFailedAt,
        lockedUntil,
      });
      return { success: true, meta: { changes: 1 } };
    }

    if (this.normalizedQuery.startsWith("delete from login_attempts")) {
      const [attemptKey] = this.bindings as [string];
      this.state.loginAttempts.delete(attemptKey);
      return { success: true, meta: { changes: 1 } };
    }

    if (this.normalizedQuery.startsWith("insert into app_state")) {
      const [key, valueJson] = this.bindings as [string, string];
      const existing = this.state.appState.get(key);
      this.state.appState.set(key, {
        key,
        valueJson,
        updatedAt: existing?.updatedAt || new Date().toISOString(),
      });
      return { success: true, meta: { changes: 1 } };
    }

    if (this.normalizedQuery.startsWith("insert into app_secrets")) {
      const [key, encryptedValue, updatedAt] = this.bindings as [string, string, string];
      this.state.appSecrets.set(key, {
        key,
        encryptedValue,
        updatedAt,
      });
      return { success: true, meta: { changes: 1 } };
    }

    if (this.normalizedQuery.startsWith("delete from app_secrets")) {
      const [key] = this.bindings as [string];
      this.state.appSecrets.delete(key);
      return { success: true, meta: { changes: 1 } };
    }

    if (this.normalizedQuery.startsWith("insert into channel_connections")) {
      const [id, channel, label, accountHandle, accessTokenSecretKey, refreshTokenSecretKey, createdAt, updatedAt] = this.bindings as [
        string,
        "linkedin" | "x" | "bluesky",
        string,
        string,
        string,
        string | null,
        string,
        string,
      ];
      this.state.channelConnections.set(id, {
        id,
        channel,
        label,
        accountHandle,
        accessTokenSecretKey,
        refreshTokenSecretKey,
        createdAt,
        updatedAt,
      });
      return { success: true, meta: { changes: 1 } };
    }

    if (
      this.normalizedQuery.startsWith(
        "update channel_connections set account_handle = ?, refresh_token_secret_key = ?, updated_at = ? where id = ?",
      )
    ) {
      const [accountHandle, refreshTokenSecretKey, updatedAt, connectionId] = this.bindings as [string, string | null, string, string];
      const existing = this.state.channelConnections.get(connectionId);
      if (!existing) {
        return { success: true, meta: { changes: 0 } };
      }

      this.state.channelConnections.set(connectionId, {
        ...existing,
        accountHandle,
        refreshTokenSecretKey,
        updatedAt,
      });
      return { success: true, meta: { changes: 1 } };
    }

    if (this.normalizedQuery.startsWith("delete from channel_connections where id = ?")) {
      const [connectionId] = this.bindings as [string];
      this.state.channelConnections.delete(connectionId);
      return { success: true, meta: { changes: 1 } };
    }

    throw new Error(`Unsupported run query in test database: ${this.normalizedQuery}`);
  }

  private async executeSelect(): Promise<Record<string, unknown>[]> {
    if (this.normalizedQuery.includes("from app_users order by name asc")) {
      if (this.normalizedQuery.includes("select id, name, password_hash, role")) {
        return this.state.appUsers.map((user) => ({
          id: user.id,
          name: user.name,
          password_hash: user.passwordHash,
          role: user.role,
        }));
      }

      if (this.normalizedQuery.includes("select name, password_hash, role")) {
        return this.state.appUsers.map((user) => ({
          name: user.name,
          password_hash: user.passwordHash,
          role: user.role,
        }));
      }
    }

    if (this.normalizedQuery.includes("from app_users where name = ? collate nocase")) {
      const [name] = this.bindings as [string];
      const user = this.state.appUsers.find((candidate) => candidate.name.toLocaleLowerCase() === name.toLocaleLowerCase());
      return user
        ? [
            {
              id: user.id,
              name: user.name,
              password_hash: user.passwordHash,
              role: user.role,
            },
          ]
        : [];
    }

    if (this.normalizedQuery.includes("from login_attempts where attempt_key = ?")) {
      const [attemptKey] = this.bindings as [string];
      const attempt = this.state.loginAttempts.get(attemptKey);
      return attempt
        ? [
            {
              attempt_key: attempt.attemptKey,
              failure_count: attempt.failureCount,
              first_failed_at: attempt.firstFailedAt,
              last_failed_at: attempt.lastFailedAt,
              locked_until: attempt.lockedUntil,
            },
          ]
        : [];
    }

    if (this.normalizedQuery.includes("from app_state order by state_key asc")) {
      return Array.from(this.state.appState.values())
        .sort((left, right) => left.key.localeCompare(right.key))
        .map((entry) => ({
          state_key: entry.key,
          value_json: entry.valueJson,
          updated_at: entry.updatedAt,
        }));
    }

    if (this.normalizedQuery.includes("from app_state where state_key = ?")) {
      const [stateKey] = this.bindings as [string];
      const entry = this.state.appState.get(stateKey);
      return entry
        ? [
            {
              state_key: entry.key,
              value_json: entry.valueJson,
              updated_at: entry.updatedAt,
            },
          ]
        : [];
    }

    if (this.normalizedQuery.includes("from app_secrets order by secret_key asc")) {
      return Array.from(this.state.appSecrets.values())
        .sort((left, right) => left.key.localeCompare(right.key))
        .map((entry) => ({
          secret_key: entry.key,
          encrypted_value: entry.encryptedValue,
          updated_at: entry.updatedAt,
        }));
    }

    if (this.normalizedQuery.includes("from app_secrets where secret_key = ?")) {
      const [key] = this.bindings as [string];
      const entry = this.state.appSecrets.get(key);
      return entry
        ? [
            {
              secret_key: entry.key,
              encrypted_value: entry.encryptedValue,
              updated_at: entry.updatedAt,
            },
          ]
        : [];
    }

    if (
      this.normalizedQuery.includes("from channel_connections order by channel asc, label asc, created_at asc") &&
      this.normalizedQuery.includes("select id, channel, label, account_handle, refresh_token_secret_key, created_at, updated_at")
    ) {
      return Array.from(this.state.channelConnections.values())
        .sort(
          (left, right) =>
            left.channel.localeCompare(right.channel) ||
            left.label.localeCompare(right.label) ||
            left.createdAt.localeCompare(right.createdAt),
        )
        .map((entry) => ({
          id: entry.id,
          channel: entry.channel,
          label: entry.label,
          account_handle: entry.accountHandle,
          refresh_token_secret_key: entry.refreshTokenSecretKey,
          created_at: entry.createdAt,
          updated_at: entry.updatedAt,
        }));
    }

    if (
      this.normalizedQuery.includes("from channel_connections order by channel asc, label asc, created_at asc") &&
      this.normalizedQuery.includes(
        "select id, channel, label, account_handle, access_token_secret_key, refresh_token_secret_key, created_at, updated_at",
      )
    ) {
      return Array.from(this.state.channelConnections.values())
        .sort(
          (left, right) =>
            left.channel.localeCompare(right.channel) ||
            left.label.localeCompare(right.label) ||
            left.createdAt.localeCompare(right.createdAt),
        )
        .map((entry) => ({
          id: entry.id,
          channel: entry.channel,
          label: entry.label,
          account_handle: entry.accountHandle,
          access_token_secret_key: entry.accessTokenSecretKey,
          refresh_token_secret_key: entry.refreshTokenSecretKey,
          created_at: entry.createdAt,
          updated_at: entry.updatedAt,
        }));
    }

    if (this.normalizedQuery.includes("from channel_connections where channel = ? and account_handle = ? collate nocase")) {
      const [channel, accountHandle] = this.bindings as [string, string];
      const connection = Array.from(this.state.channelConnections.values()).find(
        (candidate) => candidate.channel === channel && candidate.accountHandle.toLocaleLowerCase() === accountHandle.toLocaleLowerCase(),
      );

      return connection
        ? [
            {
              id: connection.id,
            },
          ]
        : [];
    }

    if (this.normalizedQuery.includes("from channel_connections where id = ?")) {
      const [connectionId] = this.bindings as [string];
      const connection = this.state.channelConnections.get(connectionId);

      return connection
        ? [
            {
              id: connection.id,
              channel: connection.channel,
              label: connection.label,
              account_handle: connection.accountHandle,
              access_token_secret_key: connection.accessTokenSecretKey,
              refresh_token_secret_key: connection.refreshTokenSecretKey,
              created_at: connection.createdAt,
              updated_at: connection.updatedAt,
            },
          ]
        : [];
    }

    throw new Error(`Unsupported select query in test database: ${this.normalizedQuery}`);
  }
}

export function createTestDatabase(): TestDatabase {
  return new TestDatabase();
}

export async function seedAuthUser(
  db: TestDatabase,
  input: {
    name: string;
    password: string;
    role: AccessRole;
  },
): Promise<void> {
  db.state.appUsers.push({
    id: db.state.nextUserId,
    name: input.name,
    passwordHash: await hashPassword(input.password),
    role: input.role,
  });
  db.state.nextUserId += 1;
  db.state.appUsers.sort((left, right) => left.name.localeCompare(right.name));
}

export function seedStateEntry(db: TestDatabase, key: string, value: unknown, updatedAt = "2026-03-31T10:00:00.000Z"): void {
  db.state.appState.set(key, {
    key,
    valueJson: JSON.stringify(value),
    updatedAt,
  });
}

export class TestR2Bucket implements R2BucketLike {
  readonly objects = new Map<string, { value: string | ArrayBuffer | ArrayBufferView; options?: R2PutOptions }>();

  async put(key: string, value: string | ArrayBuffer | ArrayBufferView, options?: R2PutOptions): Promise<void> {
    this.objects.set(key, {
      value,
      options,
    });
  }

  async list(options?: R2ListOptions): Promise<R2ListResult> {
    const prefix = options?.prefix || "";
    const objects = Array.from(this.objects.keys())
      .filter((key) => key.startsWith(prefix))
      .sort()
      .map((key) => ({ key }));

    return { objects };
  }

  async get(key: string): Promise<R2ObjectBodyLike | null> {
    const object = this.objects.get(key);
    if (!object) {
      return null;
    }

    return {
      text: async () => decodeTestR2Value(object.value),
      arrayBuffer: async () => toArrayBuffer(object.value),
      httpMetadata: object.options?.httpMetadata,
      customMetadata: object.options?.customMetadata,
    };
  }
}

export function createTestR2Bucket(): TestR2Bucket {
  return new TestR2Bucket();
}

export function createTestEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: createTestDatabase(),
    BACKUP_PREFIX: "automated-backups",
    SESSION_SECRET: "test-session-secret",
    ...overrides,
  };
}

function decodeTestR2Value(value: string | ArrayBuffer | ArrayBufferView): string {
  if (typeof value === "string") {
    return value;
  }

  return new TextDecoder().decode(
    value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
  );
}

function toArrayBuffer(value: string | ArrayBuffer | ArrayBufferView): ArrayBuffer {
  if (typeof value === "string") {
    return new TextEncoder().encode(value).buffer;
  }

  if (value instanceof ArrayBuffer) {
    return value.slice(0);
  }

  const copy = new Uint8Array(value.byteLength);
  copy.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  return copy.buffer;
}
