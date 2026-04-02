import { describe, expect, it } from "vitest";
import worker, { handleRequest } from "./worker";
import { createTestDatabase, createTestEnv, createTestR2Bucket, ensureGeneratedStylesheet, seedAuthUser } from "./test-support";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "./auth";

ensureGeneratedStylesheet();

describe("worker", () => {
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
        BACKUP_BUCKET: createTestR2Bucket(),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Queue");
    expect(body).toContain("Session");
    expect(body).toContain("Scheduler Admin");
    expect(body).toContain("Open composer");
    expect(body).toContain("View sent history");
    expect(body).not.toContain("Channel drafts");
    expect(body).not.toContain("Open demo mode");
  });

  it("renders the authenticated compose page", async () => {
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
    expect(body).toContain("data-queue-button");
  });

  it("renders the authenticated history page", async () => {
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
      new Request("http://example.com/history", {
        headers: {
          cookie: `${SESSION_COOKIE}=${sessionToken}`,
        },
      }),
      createTestEnv({ DB: db }),
    );

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Sent History");
    expect(body).toContain("data-history-filter");
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
      routes: ["/", "/compose", "/history", "/login", "/api/health"],
    });
  });

  it("includes the demo route in health output when demo mode is enabled locally", async () => {
    const response = await handleRequest(new Request("http://127.0.0.1:8787/api/health"), createTestEnv({ DEMO_MODE: "true" }));

    await expect(response.json()).resolves.toEqual({
      ok: true,
      name: "social-media-scheduler",
      routes: ["/", "/compose", "/history", "/login", "/api/health", "/demo"],
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
