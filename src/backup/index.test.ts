import { describe, expect, it } from "vitest";
import { saveEncryptedSecret } from "../secrets";
import { runAutomatedBackup } from "./index";
import { createTestDatabase, createTestR2Bucket, seedAuthUser, seedStateEntry } from "../test-support";
import { createChannelConnection } from "../channels";
import { createTestEnv } from "../test-support";

describe("runAutomatedBackup", () => {
  it("writes a new backup when the exported content changes", async () => {
    const db = createTestDatabase();
    const bucket = createTestR2Bucket();
    const env = createTestEnv({
      APP_ENCRYPTION_SECRET: "dedicated-secret",
    });

    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password",
      role: "editor",
    });
    seedStateEntry(db, "draft-policy", { adapters: ["mastodon"] });
    await createChannelConnection(db, env, {
      channel: "linkedin",
      label: "Company LinkedIn",
      accountHandle: "Example Company",
      accessToken: "access-token-value",
      refreshToken: "",
    });
    await saveEncryptedSecret(db, "manual:extra", "custom-value", "dedicated-secret");

    const result = await runAutomatedBackup(db, bucket, {
      backupPrefix: "automated-backups",
      cron: "30 1 * * *",
      timestamp: new Date("2026-03-31T10:15:00.000Z"),
    });

    expect(result.skipped).toBe(false);
    expect(result.manifest?.counts).toEqual({
      authUsers: 1,
      stateEntries: 1,
      channelConnections: 1,
      appSecrets: 2,
    });
    expect(bucket.objects.size).toBe(3);
  });

  it("skips when the latest stored backup already matches the current export", async () => {
    const db = createTestDatabase();
    const bucket = createTestR2Bucket();

    await seedAuthUser(db, {
      name: "Scheduler Admin",
      password: "test-password",
      role: "editor",
    });

    await runAutomatedBackup(db, bucket, {
      backupPrefix: "automated-backups",
      cron: "30 1 * * *",
      timestamp: new Date("2026-03-31T10:15:00.000Z"),
    });

    const result = await runAutomatedBackup(db, bucket, {
      backupPrefix: "automated-backups",
      cron: "30 1 * * *",
      timestamp: new Date("2026-03-31T10:20:00.000Z"),
    });

    expect(result.skipped).toBe(true);
    expect(result.manifest).toBeNull();
    expect(result.matchedManifestKey).toContain("backup-manifest.json");
  });
});
