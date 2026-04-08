import { RestliClient } from "linkedin-api-client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadEncryptedSecret } from "./secrets";
import worker, { handleRequest } from "./worker";
import { createTestDatabase, createTestEnv, createTestR2Bucket, ensureGeneratedStylesheet, seedAuthUser } from "./test-support";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "./auth";
import { createChannelConnection } from "./channels";
import { loadPostingSchedules } from "./schedule";

ensureGeneratedStylesheet();

function mockLinkedInProfileLookup(): void {
  vi.spyOn(RestliClient.prototype, "get").mockResolvedValue({
    data: {
      id: "abc123",
      localizedFirstName: "Example",
      localizedLastName: "Member",
    },
  } as unknown as Awaited<ReturnType<RestliClient["get"]>>);
}

describe("worker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects unauthenticated root requests to login", async () => {
    const db = createTestDatabase();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password-123",
      role: "editor",
    });
    const response = await handleRequest(new Request("http://example.com/"), createTestEnv({ DB: db }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/login");
  });

  it("renders the login page", async () => {
    const db = createTestDatabase();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password-123",
      role: "editor",
    });

    const response = await handleRequest(new Request("http://example.com/login"), createTestEnv({ DB: db }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");

    const body = await response.text();
    expect(body).toContain("Sign in");
    expect(body).toContain("Exactly one account exists");
  });

  it("redirects authenticated users away from login", async () => {
    const db = createTestDatabase();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password-123",
      role: "editor",
    });
    const sessionToken = await createSessionToken("test-session-secret", SESSION_TTL_SECONDS, {
      name: "Scheduler Admin",
      role: "editor",
    });

    const response = await handleRequest(
      new Request("http://example.com/login", {
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionToken}`,
        },
      }),
      createTestEnv({ DB: db }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/");
  });

  it("authenticates valid credentials and sets a session cookie", async () => {
    const db = createTestDatabase();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password-123",
      role: "editor",
    });

    const response = await handleRequest(
      new Request("http://example.com/login", {
        method: "POST",
        body: new URLSearchParams({
          name: "Scheduler Admin",
          password: "test-password-123",
        }),
      }),
      createTestEnv({ DB: db }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/");
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE}=`);
  });

  it("returns an auth error for invalid credentials", async () => {
    const db = createTestDatabase();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password-123",
      role: "editor",
    });

    const response = await handleRequest(
      new Request("http://example.com/login", {
        method: "POST",
        body: new URLSearchParams({
          name: "Scheduler Admin",
          password: "wrong-password",
        }),
      }),
      createTestEnv({ DB: db }),
    );

    expect(response.status).toBe(401);
    await expect(response.text()).resolves.toContain("Invalid credentials.");
  });

  it("renders the authenticated queue page", async () => {
    const db = createTestDatabase();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password-123",
      role: "editor",
    });
    const sessionToken = await createSessionToken("test-session-secret", SESSION_TTL_SECONDS, {
      name: "Scheduler Admin",
      role: "editor",
    });

    const response = await handleRequest(
      new Request("http://example.com/", {
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionToken}`,
        },
      }),
      createTestEnv({
        DB: db,
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Queue");
    expect(body).toContain("Session");
    expect(body).toContain("Scheduler Admin");
    expect(body).toContain(">Compose<");
    expect(body).not.toContain("Open composer");
    expect(body).toContain(">History<");
    expect(body).toContain(">Settings<");
    expect(body).toContain("Configured channels");
    expect(body).toContain("No channel connections are configured yet.");
    expect(body).toContain("Posting schedule");
    expect(body).toContain("Add a channel connection in Settings before editing the posting schedule.");
    expect(body).toContain("Configured connections");
    expect(body).not.toContain("Open demo mode");
  });

  it("renders only configured provider schedules on the queue page", async () => {
    const db = createTestDatabase();
    mockLinkedInProfileLookup();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password-123",
      role: "editor",
    });
    await createChannelConnection(
      db,
      createTestEnv({
        APP_ENCRYPTION_SECRET: "dedicated-secret",
      }),
      {
        channel: "linkedin",
        label: "Company LinkedIn",
        accountHandle: "Example Company",
        accessToken: "access-token-value",
        refreshToken: "",
      },
    );
    const sessionToken = await createSessionToken("test-session-secret", SESSION_TTL_SECONDS, {
      name: "Scheduler Admin",
      role: "editor",
    });

    const response = await handleRequest(
      new Request("http://example.com/", {
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionToken}`,
        },
      }),
      createTestEnv({
        APP_ENCRYPTION_SECRET: "dedicated-secret",
        DB: db,
      }),
    );

    const body = await response.text();
    expect(body).toContain("Company LinkedIn");
    expect(body).toContain("0 9 * * MON,WED,FRI");
    expect(body).not.toContain("30 16 * * MON,TUE,WED,THU,FRI");
  });

  it("allows editors to update per-channel posting schedules", async () => {
    const db = createTestDatabase();
    mockLinkedInProfileLookup();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password-123",
      role: "editor",
    });
    await createChannelConnection(
      db,
      createTestEnv({
        APP_ENCRYPTION_SECRET: "dedicated-secret",
      }),
      {
        channel: "linkedin",
        label: "Company LinkedIn",
        accountHandle: "Example Company",
        accessToken: "access-token-value",
        refreshToken: "",
      },
    );
    const sessionToken = await createSessionToken("test-session-secret", SESSION_TTL_SECONDS, {
      name: "Scheduler Admin",
      role: "editor",
    });

    const response = await handleRequest(
      new Request("http://example.com/posting-schedule", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionToken}`,
        },
        body: new URLSearchParams([
          ["linkedin-time", "10:45"],
          ["linkedin-weekday", "MON"],
          ["linkedin-weekday", "WED"],
        ]),
      }),
      createTestEnv({
        APP_ENCRYPTION_SECRET: "dedicated-secret",
        DB: db,
      }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/?schedule=updated");
    await expect(loadPostingSchedules(db)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ channel: "linkedin", cron: "45 10 * * MON,WED" })]),
    );
  });

  it("rejects posting schedule updates from readonly users", async () => {
    const db = createTestDatabase();
    await seedAuthUser(db, {
      name: "Readonly User",
      password: "test-password-123",
      role: "readonly",
    });
    const sessionToken = await createSessionToken("test-session-secret", SESSION_TTL_SECONDS, {
      name: "Readonly User",
      role: "readonly",
    });

    const response = await handleRequest(
      new Request("http://example.com/posting-schedule", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionToken}`,
        },
        body: new URLSearchParams([
          ["linkedin-time", "10:45"],
          ["linkedin-weekday", "TUE"],
          ["x-time", "16:30"],
          ["x-weekday", "MON"],
          ["bluesky-time", "11:15"],
          ["bluesky-weekday", "SAT"],
        ]),
      }),
      createTestEnv({ DB: db }),
    );

    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toContain("Readonly users cannot change posting schedules.");
  });

  it("rejects posting schedule updates when no channels are configured", async () => {
    const db = createTestDatabase();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password-123",
      role: "editor",
    });
    const sessionToken = await createSessionToken("test-session-secret", SESSION_TTL_SECONDS, {
      name: "Scheduler Admin",
      role: "editor",
    });

    const response = await handleRequest(
      new Request("http://example.com/posting-schedule", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionToken}`,
        },
        body: new URLSearchParams({
          "x-time": "16:30",
          "x-weekday": "MON",
        }),
      }),
      createTestEnv({ DB: db }),
    );

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toContain("Add at least one channel connection before editing the posting schedule.");
  });

  it("returns a validation error when a posting schedule is incomplete", async () => {
    const db = createTestDatabase();
    mockLinkedInProfileLookup();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password-123",
      role: "editor",
    });
    await createChannelConnection(
      db,
      createTestEnv({
        APP_ENCRYPTION_SECRET: "dedicated-secret",
      }),
      {
        channel: "linkedin",
        label: "Company LinkedIn",
        accountHandle: "Example Company",
        accessToken: "access-token-value",
        refreshToken: "",
      },
    );
    const sessionToken = await createSessionToken("test-session-secret", SESSION_TTL_SECONDS, {
      name: "Scheduler Admin",
      role: "editor",
    });

    const response = await handleRequest(
      new Request("http://example.com/posting-schedule", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionToken}`,
        },
        body: new URLSearchParams([["linkedin-time", "10:45"]]),
      }),
      createTestEnv({
        APP_ENCRYPTION_SECRET: "dedicated-secret",
        DB: db,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toContain("Choose at least one posting day for LinkedIn.");
  });

  it("renders the authenticated settings page", async () => {
    const db = createTestDatabase();
    mockLinkedInProfileLookup();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password-123",
      role: "editor",
    });
    await createChannelConnection(
      db,
      createTestEnv({
        APP_ENCRYPTION_SECRET: "dedicated-secret",
      }),
      {
        channel: "linkedin",
        label: "Company LinkedIn",
        accountHandle: "Example Company",
        accessToken: "access-token-value",
        refreshToken: "",
      },
    );
    const sessionToken = await createSessionToken("test-session-secret", SESSION_TTL_SECONDS, {
      name: "Scheduler Admin",
      role: "editor",
    });

    const response = await handleRequest(
      new Request("http://example.com/settings", {
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionToken}`,
        },
      }),
      createTestEnv({ DB: db }),
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("Channel setup");
  });

  it("allows editors to save encrypted channel connections", async () => {
    const db = createTestDatabase();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password-123",
      role: "editor",
    });
    const sessionToken = await createSessionToken("test-session-secret", SESSION_TTL_SECONDS, {
      name: "Scheduler Admin",
      role: "editor",
    });
    const env = createTestEnv({
      APP_ENCRYPTION_SECRET: "dedicated-secret",
      DB: db,
    });
    mockLinkedInProfileLookup();

    const response = await handleRequest(
      new Request("http://example.com/settings/channels", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionToken}`,
        },
        body: new URLSearchParams({
          channel: "linkedin",
          label: "Company LinkedIn",
          accountHandle: "Example Company",
          accessToken: "access-token-value",
          refreshToken: "refresh-token-value",
        }),
      }),
      env,
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/settings?channel=connected");
    const encryptedSecret = Array.from(db.state.appSecrets.values())[0];
    expect(encryptedSecret?.encryptedValue).not.toContain("access-token-value");
    await expect(loadEncryptedSecret(db, encryptedSecret!.key, "dedicated-secret")).resolves.toBe("access-token-value");
  });

  it("normalizes the saved X handle from the validated token", async () => {
    const db = createTestDatabase();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password-123",
      role: "editor",
    });
    const sessionToken = await createSessionToken("test-session-secret", SESSION_TTL_SECONDS, {
      name: "Scheduler Admin",
      role: "editor",
    });

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "https://api.x.com/2/users/me") {
        return new Response(
          JSON.stringify({
            data: {
              id: "123",
              username: "juho",
            },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    const env = createTestEnv({
      APP_ENCRYPTION_SECRET: "dedicated-secret",
      DB: db,
    });

    const response = await handleRequest(
      new Request("http://example.com/settings/channels", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionToken}`,
        },
        body: new URLSearchParams({
          channel: "x",
          label: "Personal X",
          accountHandle: "temporary value",
          accessToken: "oauth2-token-value",
          refreshToken: "refresh-token-value",
        }),
      }),
      env,
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/settings?channel=connected");
    const savedConnection = Array.from(db.state.channelConnections.values())[0];
    expect(savedConnection?.channel).toBe("x");
    expect(savedConnection?.accountHandle).toBe("@juho");
    await expect(loadEncryptedSecret(db, savedConnection!.accessTokenSecretKey, "dedicated-secret")).resolves.toBe("oauth2-token-value");
    await expect(loadEncryptedSecret(db, savedConnection!.refreshTokenSecretKey!, "dedicated-secret")).resolves.toBe("refresh-token-value");
  });

  it("exchanges Bluesky app passwords for session tokens before saving the connection", async () => {
    const db = createTestDatabase();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password-123",
      role: "editor",
    });
    const sessionToken = await createSessionToken("test-session-secret", SESSION_TTL_SECONDS, {
      name: "Scheduler Admin",
      role: "editor",
    });

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url === "https://bsky.social/xrpc/com.atproto.server.createSession") {
        return new Response(
          JSON.stringify({
            accessJwt: "access-jwt-value",
            refreshJwt: "refresh-jwt-value",
            handle: "juho.bsky.social",
            did: "did:plc:juho123",
            active: true,
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    const env = createTestEnv({
      APP_ENCRYPTION_SECRET: "dedicated-secret",
      DB: db,
    });

    const response = await handleRequest(
      new Request("http://example.com/settings/channels", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionToken}`,
        },
        body: new URLSearchParams({
          channel: "bluesky",
          label: "Personal Bluesky",
          accountHandle: "juho.bsky.social",
          accessToken: "app-password-value",
          refreshToken: "",
        }),
      }),
      env,
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/settings?channel=connected");
    const savedConnection = Array.from(db.state.channelConnections.values())[0];
    expect(savedConnection?.channel).toBe("bluesky");
    expect(savedConnection?.refreshTokenSecretKey).toBeTruthy();
    await expect(loadEncryptedSecret(db, savedConnection!.accessTokenSecretKey, "dedicated-secret")).resolves.toBe("access-jwt-value");
    await expect(loadEncryptedSecret(db, savedConnection!.refreshTokenSecretKey!, "dedicated-secret")).resolves.toBe("refresh-jwt-value");
  });

  it("rejects channel settings updates from readonly users", async () => {
    const db = createTestDatabase();
    await seedAuthUser(db, {
      name: "Readonly User",
      password: "test-password-123",
      role: "readonly",
    });
    const sessionToken = await createSessionToken("test-session-secret", SESSION_TTL_SECONDS, {
      name: "Readonly User",
      role: "readonly",
    });

    const response = await handleRequest(
      new Request("http://example.com/settings/channels", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionToken}`,
        },
        body: new URLSearchParams({
          channel: "x",
          label: "Personal X",
          accountHandle: "@juho",
          accessToken: "access-token-value",
        }),
      }),
      createTestEnv({ DB: db }),
    );

    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toContain("Readonly users cannot change channel settings.");
  });

  it("returns a validation error when a channel connection is incomplete", async () => {
    const db = createTestDatabase();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password-123",
      role: "editor",
    });
    const sessionToken = await createSessionToken("test-session-secret", SESSION_TTL_SECONDS, {
      name: "Scheduler Admin",
      role: "editor",
    });

    const response = await handleRequest(
      new Request("http://example.com/settings/channels", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionToken}`,
        },
        body: new URLSearchParams({
          channel: "x",
          label: "",
          accountHandle: "@juho",
          accessToken: "",
        }),
      }),
      createTestEnv({ DB: db }),
    );

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toContain("Add a label so this connection is easy to identify later.");
  });

  it("rejects live provider connection creation in strict e2e mode", async () => {
    const db = createTestDatabase();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password-123",
      role: "editor",
    });
    const sessionToken = await createSessionToken("test-session-secret", SESSION_TTL_SECONDS, {
      name: "Scheduler Admin",
      role: "editor",
    });

    const response = await handleRequest(
      new Request("http://127.0.0.1:8788/settings/channels", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionToken}`,
        },
        body: new URLSearchParams({
          channel: "x",
          label: "Personal X",
          accountHandle: "@juho",
          accessToken: "access-token-value",
          refreshToken: "refresh-token-value",
        }),
      }),
      createTestEnv({
        APP_ENCRYPTION_SECRET: "dedicated-secret",
        DB: db,
        E2E_SEEDED_STATE_ONLY: "true",
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.text()).resolves.toContain(
      "The Playwright e2e server uses seeded channel connections only. Update npm run e2e:prepare fixtures instead of creating live provider connections in browser tests.",
    );
  });

  it("renders the authenticated compose page", async () => {
    const db = createTestDatabase();
    mockLinkedInProfileLookup();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password-123",
      role: "editor",
    });
    await createChannelConnection(
      db,
      createTestEnv({
        APP_ENCRYPTION_SECRET: "dedicated-secret",
      }),
      {
        channel: "linkedin",
        label: "Company LinkedIn",
        accountHandle: "Example Company",
        accessToken: "access-token-value",
        refreshToken: "",
      },
    );
    const sessionToken = await createSessionToken("test-session-secret", SESSION_TTL_SECONDS, {
      name: "Scheduler Admin",
      role: "editor",
    });

    const response = await handleRequest(
      new Request("http://example.com/compose", {
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionToken}`,
        },
      }),
      createTestEnv({ DB: db }),
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Compose");
    expect(body).toContain("Channel drafts");
    expect(body).toContain("Company LinkedIn");
    expect(body).toContain("data-queue-button");
  });

  it("renders the authenticated history page", async () => {
    const db = createTestDatabase();
    mockLinkedInProfileLookup();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password-123",
      role: "editor",
    });
    await createChannelConnection(
      db,
      createTestEnv({
        APP_ENCRYPTION_SECRET: "dedicated-secret",
      }),
      {
        channel: "linkedin",
        label: "Company LinkedIn",
        accountHandle: "Example Company",
        accessToken: "access-token-value",
        refreshToken: "",
      },
    );
    const sessionToken = await createSessionToken("test-session-secret", SESSION_TTL_SECONDS, {
      name: "Scheduler Admin",
      role: "editor",
    });

    const response = await handleRequest(
      new Request("http://example.com/history", {
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionToken}`,
        },
      }),
      createTestEnv({ DB: db }),
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("History");
    expect(body).toContain("data-history-filter");
    expect(body).toContain("Company LinkedIn");
    expect(body).toContain("No sent posts are available yet.");
  });

  it("hides demo mode when the request is not local development", async () => {
    const db = createTestDatabase();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password-123",
      role: "editor",
    });
    const sessionToken = await createSessionToken("test-session-secret", SESSION_TTL_SECONDS, {
      name: "Scheduler Admin",
      role: "editor",
    });

    const response = await handleRequest(
      new Request("http://example.com/demo", {
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionToken}`,
        },
      }),
      createTestEnv({ DB: db, DEMO_MODE: "true" }),
    );

    expect(response.status).toBe(404);
  });

  it("renders demo mode only when enabled on loopback", async () => {
    const db = createTestDatabase();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password-123",
      role: "editor",
    });
    const sessionToken = await createSessionToken("test-session-secret", SESSION_TTL_SECONDS, {
      name: "Scheduler Admin",
      role: "editor",
    });

    const response = await handleRequest(
      new Request("http://127.0.0.1:8787/demo", {
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionToken}`,
        },
      }),
      createTestEnv({ DB: db, DEMO_MODE: "true" }),
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Demo Mode");
    expect(body).toContain("Schedule demo post");
  });

  it("allows editors to schedule demo posts without leaving demo mode", async () => {
    const db = createTestDatabase();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password-123",
      role: "editor",
    });
    const sessionToken = await createSessionToken("test-session-secret", SESSION_TTL_SECONDS, {
      name: "Scheduler Admin",
      role: "editor",
    });

    const response = await handleRequest(
      new Request("http://127.0.0.1:8787/demo/queue", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionToken}`,
        },
        body: new URLSearchParams({
          channel: "x",
          body: "Queue this demo-only post.",
          slot: "Tomorrow, 09:00",
        }),
      }),
      createTestEnv({ DB: db, DEMO_MODE: "true" }),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/demo");

    const demoResponse = await handleRequest(
      new Request("http://127.0.0.1:8787/demo", {
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionToken}`,
        },
      }),
      createTestEnv({ DB: db, DEMO_MODE: "true" }),
    );

    await expect(demoResponse.text()).resolves.toContain("Queue this demo-only post.");
  });

  it("returns a JSON health response", async () => {
    const response = await handleRequest(new Request("http://example.com/api/health"), createTestEnv());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      name: "social-media-scheduler",
      routes: ["/", "/compose", "/history", "/settings", "/settings/channels", "/posting-schedule", "/login", "/api/health"],
    });
  });

  it("includes the demo route in health output when demo mode is enabled locally", async () => {
    const response = await handleRequest(new Request("http://127.0.0.1:8787/api/health"), createTestEnv({ DEMO_MODE: "true" }));

    await expect(response.json()).resolves.toEqual({
      ok: true,
      name: "social-media-scheduler",
      routes: ["/", "/compose", "/history", "/settings", "/settings/channels", "/posting-schedule", "/login", "/api/health", "/demo"],
    });
  });

  it("returns a setup error when the session secret is missing", async () => {
    const response = await handleRequest(new Request("http://example.com/login"), {
      DB: createTestDatabase(),
    });

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toContain("SESSION_SECRET must be configured.");
  });

  it("returns a not found page for unknown routes", async () => {
    const db = createTestDatabase();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password-123",
      role: "editor",
    });
    const sessionToken = await createSessionToken("test-session-secret", SESSION_TTL_SECONDS, {
      name: "Scheduler Admin",
      role: "editor",
    });

    const response = await handleRequest(
      new Request("http://example.com/missing", {
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionToken}`,
        },
      }),
      createTestEnv({ DB: db }),
    );

    expect(response.status).toBe(404);

    const body = await response.text();
    expect(body).toContain("Not Found");
    expect(body).toContain("/missing");
  });

  it("exposes the same behavior through the worker fetch entrypoint", async () => {
    const response = await worker.fetch(new Request("http://example.com/api/health"), createTestEnv());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
  });

  it("serves generated styles", async () => {
    const response = await handleRequest(new Request("http://example.com/styles.css"), createTestEnv());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/css");
    await expect(response.text()).resolves.toContain("--color-app-canvas:#f5efe6");
  });

  it("serves the home page interaction script", async () => {
    const response = await handleRequest(new Request("http://example.com/home.js"), createTestEnv());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/javascript");
    await expect(response.text()).resolves.toContain("const channelColumns");
  });

  it("clears the session cookie on logout", async () => {
    const response = await handleRequest(new Request("http://example.com/logout", { method: "POST" }), createTestEnv());

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/login");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("exposes the scheduled backup entrypoint", async () => {
    const db = createTestDatabase();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password-123",
      role: "editor",
    });

    await expect(
      worker.scheduled(
        { cron: "30 1 * * *" },
        createTestEnv({
          DB: db,
          BACKUP_BUCKET: createTestR2Bucket(),
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it("allows the scheduled entrypoint to skip when bindings are absent or unchanged", async () => {
    const db = createTestDatabase();
    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password-123",
      role: "editor",
    });
    const bucket = createTestR2Bucket();

    await expect(worker.scheduled({ cron: "30 1 * * *" }, createTestEnv({ DB: undefined }))).resolves.toBeUndefined();
    await expect(worker.scheduled({ cron: "30 1 * * *" }, createTestEnv({ DB: db }))).resolves.toBeUndefined();

    await worker.scheduled(
      { cron: "30 1 * * *" },
      createTestEnv({
        DB: db,
        BACKUP_BUCKET: bucket,
      }),
    );
    await expect(
      worker.scheduled(
        { cron: "30 1 * * *" },
        createTestEnv({
          DB: db,
          BACKUP_BUCKET: bucket,
        }),
      ),
    ).resolves.toBeUndefined();
  });
});
