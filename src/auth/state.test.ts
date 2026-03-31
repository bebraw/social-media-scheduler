import { describe, expect, it } from "vitest";
import { resolveAuthState, verifyLoginCredentials } from "./state";
import { createTestDatabase, createTestEnv, seedAuthUser } from "../test-support";

describe("auth state", () => {
  it("reports missing or unavailable auth storage", async () => {
    await expect(resolveAuthState({})).resolves.toEqual({
      users: [],
      error: "D1 binding is missing. Configure DB in wrangler.jsonc before using auth.",
    });

    const brokenDb = {
      prepare() {
        throw new Error("boom");
      },
    };

    await expect(resolveAuthState({ DB: brokenDb })).resolves.toEqual({
      users: [],
      error: "Auth user storage is unavailable. Run the latest D1 migrations before starting the app.",
    });
  });

  it("reports when no users exist and authenticates the only user without a name", async () => {
    const emptyDb = createTestDatabase();
    await expect(resolveAuthState({ DB: emptyDb })).resolves.toEqual({
      users: [],
      error: "No auth users found in the database. Create at least one account and run the latest D1 migrations.",
    });

    const db = createTestDatabase();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password",
      role: "editor",
    });
    const env = createTestEnv({ DB: db });
    const authState = await resolveAuthState(env);

    await expect(
      verifyLoginCredentials(
        env,
        new Request("http://example.com/login", {
          headers: {
            "x-forwarded-for": "198.51.100.10, 198.51.100.11",
          },
        }),
        authState,
        "",
        "test-password",
      ),
    ).resolves.toEqual({
      status: "authenticated",
      user: {
        name: "Scheduler Admin",
        role: "editor",
      },
    });
  });

  it("rate-limits repeated failed logins", async () => {
    const db = createTestDatabase();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password",
      role: "editor",
    });
    const env = createTestEnv({ DB: db });
    const authState = await resolveAuthState(env);

    let result: Awaited<ReturnType<typeof verifyLoginCredentials>> | undefined;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      result = await verifyLoginCredentials(
        env,
        new Request("http://example.com/login", {
          headers: {
            "cf-connecting-ip": "203.0.113.7",
          },
        }),
        authState,
        "Scheduler Admin",
        "wrong-password",
      );
    }

    expect(result).toEqual({ status: "rate_limited" });
  });

  it("returns password_reset when the stored hash exceeds the supported iteration count", async () => {
    const db = createTestDatabase();
    db.state.appUsers.push({
      id: 1,
      name: "Legacy User",
      passwordHash: `pbkdf2_sha256$100001$${btoa(String.fromCharCode(...new Uint8Array(16).fill(1)))}$${btoa(
        String.fromCharCode(...new Uint8Array(32).fill(2)),
      )}`,
      role: "editor",
    });
    db.state.nextUserId = 2;

    const env = createTestEnv({ DB: db });
    const authState = await resolveAuthState(env);

    await expect(
      verifyLoginCredentials(env, new Request("http://example.com/login"), authState, "Legacy User", "whatever"),
    ).resolves.toEqual({
      status: "password_reset",
    });
  });

  it("returns invalid when no database is available for verification", async () => {
    await expect(
      verifyLoginCredentials(
        createTestEnv({ DB: undefined }),
        new Request("http://example.com/login"),
        { users: [] },
        "missing",
        "missing",
      ),
    ).resolves.toEqual({
      status: "invalid",
    });
  });
});
