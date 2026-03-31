import { describe, expect, it } from "vitest";
import { buildSessionCookie, clearSessionCookie, createSessionToken, getSessionUser, SESSION_COOKIE } from "./session";

describe("session auth", () => {
  it("round-trips a signed session cookie", async () => {
    const token = await createSessionToken("test-secret", 60, {
      name: "Scheduler Admin",
      role: "editor",
    });
    const request = new Request("http://example.com/", {
      headers: {
        cookie: `${SESSION_COOKIE}=${token}`,
      },
    });

    await expect(getSessionUser(request, "test-secret", SESSION_COOKIE)).resolves.toEqual({
      name: "Scheduler Admin",
      role: "editor",
    });
  });

  it("rejects tampered cookies", async () => {
    const token = await createSessionToken("test-secret", 60, {
      name: "Scheduler Admin",
      role: "editor",
    });
    const request = new Request("http://example.com/", {
      headers: {
        cookie: `${SESSION_COOKIE}=${token}tampered`,
      },
    });

    await expect(getSessionUser(request, "test-secret", SESSION_COOKIE)).resolves.toBeNull();
  });

  it("builds secure cookies for https requests and clears them", () => {
    expect(buildSessionCookie("token", "https://example.com/", { cookieName: SESSION_COOKIE, ttlSeconds: 60 })).toContain(" Secure;");
    expect(clearSessionCookie("https://example.com/", { cookieName: SESSION_COOKIE, ttlSeconds: 60 })).toContain("Max-Age=0");
  });

  it("rejects missing, malformed, or expired session cookies", async () => {
    await expect(getSessionUser(new Request("http://example.com/"), "test-secret", SESSION_COOKIE)).resolves.toBeNull();

    await expect(
      getSessionUser(
        new Request("http://example.com/", {
          headers: {
            cookie: `${SESSION_COOKIE}=missing-dot`,
          },
        }),
        "test-secret",
        SESSION_COOKIE,
      ),
    ).resolves.toBeNull();

    const expiredToken = await createSessionToken("test-secret", -1, {
      name: "Scheduler Admin",
      role: "editor",
    });

    await expect(
      getSessionUser(
        new Request("http://example.com/", {
          headers: {
            cookie: `${SESSION_COOKIE}=${expiredToken}`,
          },
        }),
        "test-secret",
        SESSION_COOKIE,
      ),
    ).resolves.toBeNull();
  });
});
