import { describe, expect, it } from "vitest";
import { createTestR2Bucket } from "../test-support";
import {
  buildAutomatedBackupPrefix,
  findLatestStoredBackup,
  normalizeBackupPrefix,
  normalizeBackupRetentionDays,
  pruneStoredBackups,
} from "./storage";

describe("backup storage", () => {
  it("normalizes prefixes and builds dated backup paths", () => {
    expect(normalizeBackupPrefix(" /custom-prefix/ ")).toBe("custom-prefix");
    expect(normalizeBackupPrefix("")).toBe("automated-backups");
    expect(normalizeBackupRetentionDays(undefined)).toBe(90);
    expect(normalizeBackupRetentionDays("30")).toBe(30);
    expect(normalizeBackupRetentionDays("0")).toBeNull();
    expect(buildAutomatedBackupPrefix(new Date("2026-03-31T10:15:00.000Z"), "custom-prefix")).toContain(
      "custom-prefix/2026/03/31/2026-03-31T10-15-00-000Z",
    );
  });

  it("returns null when list or get support is unavailable", async () => {
    await expect(
      findLatestStoredBackup(
        {
          async put() {},
        },
        "automated-backups",
      ),
    ).resolves.toBeNull();

    await expect(
      findLatestStoredBackup(
        {
          async put() {},
          async list() {
            return {
              objects: [{ key: "automated-backups/2026/03/31/latest/backup-manifest.json" }],
            };
          },
        },
        "automated-backups",
      ),
    ).resolves.toEqual({
      manifestKey: "automated-backups/2026/03/31/latest/backup-manifest.json",
      contentHash: null,
    });
  });

  it("reads the content hash from either the manifest or the export fallback", async () => {
    const bucket = createTestR2Bucket();
    await bucket.put(
      "automated-backups/2026/03/31/one/backup-manifest.json",
      JSON.stringify({
        artifacts: {
          jsonExportKey: "automated-backups/2026/03/31/one/scheduler-export.json",
        },
      }),
    );
    await bucket.put(
      "automated-backups/2026/03/31/one/scheduler-export.json",
      JSON.stringify({
        app: "social-media-scheduler",
        schemaVersion: 2,
        exportedAt: "2026-03-31T10:15:00.000Z",
        authUsers: [],
        stateEntries: [],
        channelConnections: [],
        appSecrets: [],
      }),
    );

    const fallbackResult = await findLatestStoredBackup(bucket, "automated-backups");
    expect(fallbackResult?.manifestKey).toContain("backup-manifest.json");
    expect(fallbackResult?.contentHash).toMatch(/^[a-f0-9]{64}$/);

    await bucket.put(
      "automated-backups/2026/03/31/two/backup-manifest.json",
      JSON.stringify({
        contentHash: "known-hash",
        artifacts: {
          jsonExportKey: "ignored.json",
        },
      }),
    );

    await expect(findLatestStoredBackup(bucket, "automated-backups")).resolves.toEqual({
      manifestKey: "automated-backups/2026/03/31/two/backup-manifest.json",
      contentHash: "known-hash",
    });
  });

  it("returns null content hashes for invalid manifests", async () => {
    const bucket = createTestR2Bucket();
    await bucket.put("automated-backups/2026/03/31/one/backup-manifest.json", "not-json");

    await expect(findLatestStoredBackup(bucket, "automated-backups")).resolves.toEqual({
      manifestKey: "automated-backups/2026/03/31/one/backup-manifest.json",
      contentHash: null,
    });
  });

  it("prunes stored backup artifacts outside the retention window", async () => {
    const bucket = createTestR2Bucket();
    await bucket.put("automated-backups/2026/01/01/2026-01-01T10-15-00-000Z/backup-manifest.json", "{}");
    await bucket.put("automated-backups/2026/01/01/2026-01-01T10-15-00-000Z/scheduler-export.json", "{}");
    await bucket.put("automated-backups/2026/03/31/2026-03-31T10-15-00-000Z/backup-manifest.json", "{}");

    await expect(
      pruneStoredBackups(bucket, "automated-backups", {
        now: new Date("2026-04-01T00:00:00.000Z"),
        retentionDays: 30,
      }),
    ).resolves.toEqual([
      "automated-backups/2026/01/01/2026-01-01T10-15-00-000Z/backup-manifest.json",
      "automated-backups/2026/01/01/2026-01-01T10-15-00-000Z/scheduler-export.json",
    ]);

    expect(bucket.objects.has("automated-backups/2026/01/01/2026-01-01T10-15-00-000Z/backup-manifest.json")).toBe(false);
    expect(bucket.objects.has("automated-backups/2026/03/31/2026-03-31T10-15-00-000Z/backup-manifest.json")).toBe(true);
  });
});
