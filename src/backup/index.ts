import type { D1Database } from "../db-core";
import { collectBackupData, createDataExportContentHash } from "./data";
import { BACKUP_MANIFEST_FILENAME, buildAutomatedBackupPrefix, findLatestStoredBackup, normalizeBackupPrefix } from "./storage";
import type { AutomatedBackupManifest, AutomatedBackupResult, R2BucketLike, SchedulerDataExport } from "./types";

export async function runAutomatedBackup(
  db: D1Database,
  bucket: R2BucketLike,
  options: {
    backupPrefix?: string | null;
    cron: string;
    timestamp?: Date;
  },
): Promise<AutomatedBackupResult> {
  const timestamp = options.timestamp || new Date();
  const { authUsers, stateEntries } = await collectBackupData(db);
  const exportedAt = timestamp.toISOString();
  const dataExport: SchedulerDataExport = {
    app: "social-media-scheduler",
    schemaVersion: 1,
    exportedAt,
    authUsers,
    stateEntries,
  };
  const contentHash = await createDataExportContentHash(dataExport);
  const normalizedPrefix = normalizeBackupPrefix(options.backupPrefix);
  const latestStoredBackup = await findLatestStoredBackup(bucket, normalizedPrefix);

  if (latestStoredBackup?.contentHash === contentHash) {
    return {
      skipped: true,
      contentHash,
      manifest: null,
      manifestKey: null,
      matchedManifestKey: latestStoredBackup.manifestKey,
    };
  }

  const prefix = buildAutomatedBackupPrefix(timestamp, options.backupPrefix);
  const jsonExportKey = `${prefix}/${buildExportFilename(timestamp)}`;
  const summaryReportKey = `${prefix}/${buildSummaryFilename(timestamp)}`;
  const manifestKey = `${prefix}/${BACKUP_MANIFEST_FILENAME}`;

  const jsonExport = JSON.stringify(dataExport, null, 2);
  const summaryReport = createBackupSummary(dataExport);

  const manifest: AutomatedBackupManifest = {
    app: "social-media-scheduler",
    backupVersion: 1,
    generatedAt: exportedAt,
    cron: options.cron,
    contentHash,
    counts: {
      authUsers: authUsers.length,
      stateEntries: stateEntries.length,
    },
    artifacts: {
      jsonExportKey,
      summaryReportKey,
    },
  };

  const customMetadata = {
    app: manifest.app,
    generatedAt: manifest.generatedAt,
    cron: manifest.cron,
    contentHash: manifest.contentHash,
    authUsers: String(manifest.counts.authUsers),
    stateEntries: String(manifest.counts.stateEntries),
  };

  await Promise.all([
    bucket.put(jsonExportKey, jsonExport, {
      httpMetadata: {
        cacheControl: "no-store",
        contentDisposition: `attachment; filename="${buildExportFilename(timestamp)}"`,
        contentType: "application/json; charset=utf-8",
      },
      customMetadata,
    }),
    bucket.put(summaryReportKey, summaryReport, {
      httpMetadata: {
        cacheControl: "no-store",
        contentDisposition: `attachment; filename="${buildSummaryFilename(timestamp)}"`,
        contentType: "text/markdown; charset=utf-8",
      },
      customMetadata,
    }),
  ]);

  await bucket.put(manifestKey, JSON.stringify(manifest, null, 2), {
    httpMetadata: {
      cacheControl: "no-store",
      contentType: "application/json; charset=utf-8",
    },
    customMetadata,
  });

  return {
    skipped: false,
    contentHash,
    manifest,
    manifestKey,
    matchedManifestKey: null,
  };
}

function buildExportFilename(timestamp: Date): string {
  return `scheduler-export-${buildTimestampSlug(timestamp)}.json`;
}

function buildSummaryFilename(timestamp: Date): string {
  return `scheduler-summary-${buildTimestampSlug(timestamp)}.md`;
}

function buildTimestampSlug(timestamp: Date): string {
  return timestamp.toISOString().replace(/[:.]/g, "-");
}

function createBackupSummary(dataExport: SchedulerDataExport): string {
  const authUsersSection =
    dataExport.authUsers.length > 0 ? dataExport.authUsers.map((user) => `- ${user.name} (${user.role})`).join("\n") : "- No auth users";
  const stateEntriesSection =
    dataExport.stateEntries.length > 0 ? dataExport.stateEntries.map((entry) => `- ${entry.key}`).join("\n") : "- No app state entries";

  return `# Social Media Scheduler Backup Summary

Generated at: ${dataExport.exportedAt}

## Counts

- Auth users: ${dataExport.authUsers.length}
- App state entries: ${dataExport.stateEntries.length}

## Auth Users

${authUsersSection}

## App State Keys

${stateEntriesSection}
`;
}

export { normalizeBackupPrefix } from "./storage";
export type {
  AutomatedBackupManifest,
  AutomatedBackupResult,
  BackupAuthUser,
  BackupStateEntry,
  R2BucketLike,
  R2HttpMetadata,
  R2ListOptions,
  R2ListResult,
  R2ObjectBodyLike,
  R2ObjectLike,
  R2PutOptions,
  SchedulerDataExport,
} from "./types";
