import { describe, expect, it } from "vitest";
import { clearLoginAttempt, getLoginAttempt, listAuthUsers, saveLoginAttempt, upsertAuthUser } from "./store";
import { createTestDatabase } from "../test-support";

describe("auth store", () => {
  it("upserts and lists auth users", async () => {
    const db = createTestDatabase();

    const createdId = await upsertAuthUser(db, {
      name: "Scheduler Admin",
      passwordHash: "hash-1",
      role: "editor",
    });

    await upsertAuthUser(db, {
      name: "scheduler admin",
      passwordHash: "hash-2",
      role: "readonly",
    });

    expect(createdId).toBeGreaterThan(0);
    await expect(listAuthUsers(db)).resolves.toEqual([
      {
        id: createdId,
        name: "Scheduler Admin",
        passwordHash: "hash-2",
        role: "readonly",
      },
    ]);
  });

  it("stores and clears login attempts", async () => {
    const db = createTestDatabase();
    const attempt = {
      attemptKey: "ip:127.0.0.1|user:scheduler",
      failureCount: 2,
      firstFailedAt: "2026-03-31T10:00:00.000Z",
      lastFailedAt: "2026-03-31T10:05:00.000Z",
      lockedUntil: null,
    };

    await saveLoginAttempt(db, attempt);
    await expect(getLoginAttempt(db, attempt.attemptKey)).resolves.toEqual(attempt);

    await clearLoginAttempt(db, attempt.attemptKey);
    await expect(getLoginAttempt(db, attempt.attemptKey)).resolves.toBeNull();
  });
});
