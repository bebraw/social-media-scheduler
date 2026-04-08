import { describe, expect, it } from "vitest";
import { buildRestoreSql, parseSchedulerDataExport, resolveRestoreExecutionPlan } from "./restore-backup.mjs";

const backupExport = {
  app: "social-media-scheduler",
  schemaVersion: 2,
  exportedAt: "2026-04-08T10:00:00.000Z",
  authUsers: [
    {
      name: "Scheduler Admin",
      passwordHash: "pbkdf2_sha256$100000$salt$hash",
      role: "editor",
    },
  ],
  stateEntries: [
    {
      key: "posting_schedules_v1",
      updatedAt: "2026-04-08T10:00:00.000Z",
      valueJson: '[{"channel":"linkedin","cron":"0 9 * * MON"}]',
    },
  ],
  channelConnections: [
    {
      accountHandle: "Example Member (abc123)",
      channel: "linkedin",
      createdAt: "2026-04-08T10:00:00.000Z",
      hasRefreshToken: true,
      id: "connection-1",
      label: "Company LinkedIn",
      updatedAt: "2026-04-08T10:00:00.000Z",
    },
  ],
  appSecrets: [
    {
      encryptedValue: '{"ciphertext":"value"}',
      key: "channel_connection:connection-1:access_token",
      updatedAt: "2026-04-08T10:00:00.000Z",
    },
  ],
};

describe("restore-backup script", () => {
  it("parses a valid scheduler export", () => {
    expect(parseSchedulerDataExport(JSON.stringify(backupExport))).toEqual(backupExport);
  });

  it("rejects invalid scheduler exports", () => {
    expect(() => parseSchedulerDataExport('{"app":"wrong-app"}')).toThrow("Backup export is not in the expected scheduler format.");
  });

  it("builds restore SQL with truncation and reconstructed secret keys", () => {
    const sql = buildRestoreSql(backupExport);

    expect(sql).toContain("DELETE FROM login_attempts;");
    expect(sql).toContain("DELETE FROM app_users;");
    expect(sql).toContain("channel_connection:connection-1:access_token");
    expect(sql).toContain("channel_connection:connection-1:refresh_token");
    expect(sql).toContain("INSERT INTO app_secrets");
    expect(sql).toContain("COMMIT;");
  });

  it("can build append-only restore SQL", () => {
    const sql = buildRestoreSql(backupExport, { truncate: false });

    expect(sql).not.toContain("DELETE FROM app_users;");
    expect(sql).toContain("INSERT INTO app_users");
  });

  it("requires explicit intent before executing restore SQL", () => {
    expect(() => resolveRestoreExecutionPlan({ printSql: false })).toThrow("Choose --print-sql for review output or add --execute");
    expect(() => resolveRestoreExecutionPlan({ local: true })).toThrow("Use --execute together with --local or --remote");
    expect(() => resolveRestoreExecutionPlan({ execute: true })).toThrow("Choose --local or --remote when executing restore SQL.");
    expect(resolveRestoreExecutionPlan({ execute: true, local: true })).toEqual({
      execute: true,
      target: "local",
    });
    expect(resolveRestoreExecutionPlan({ printSql: true })).toEqual({
      execute: false,
      target: null,
    });
  });
});
