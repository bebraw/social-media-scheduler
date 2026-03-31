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

interface TestDatabaseState {
  appUsers: TestAuthUserRecord[];
  loginAttempts: Map<string, TestLoginAttemptRecord>;
  appState: Map<string, TestStateEntryRecord>;
  nextUserId: number;
}

export class TestDatabase implements D1Database {
  readonly state: TestDatabaseState = {
    appUsers: [],
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
  readonly objects = new Map<string, { value: string; options?: R2PutOptions }>();

  async put(key: string, value: string, options?: R2PutOptions): Promise<void> {
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
      text: async () => object.value,
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
