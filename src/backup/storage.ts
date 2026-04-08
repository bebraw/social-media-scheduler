import { type SchedulerDataExport } from "./types";
import { createDataExportContentHash } from "./data";
import type { R2BucketLike } from "./types";

const DEFAULT_BACKUP_PREFIX = "automated-backups";
const DEFAULT_BACKUP_RETENTION_DAYS = 90;
export const BACKUP_MANIFEST_FILENAME = "backup-manifest.json";

export function normalizeBackupPrefix(prefix: string | null | undefined): string {
  const trimmed = (prefix || DEFAULT_BACKUP_PREFIX).trim().replace(/^\/+|\/+$/g, "");
  return trimmed || DEFAULT_BACKUP_PREFIX;
}

export function buildAutomatedBackupPrefix(timestamp: Date, rawPrefix: string | null | undefined): string {
  const prefix = normalizeBackupPrefix(rawPrefix);
  const [year, month, day] = timestamp.toISOString().slice(0, 10).split("-");
  const timestampSlug = timestamp.toISOString().replace(/[:.]/g, "-");
  return `${prefix}/${year}/${month}/${day}/${timestampSlug}`;
}

export function normalizeBackupRetentionDays(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || String(value).trim().length === 0) {
    return DEFAULT_BACKUP_RETENTION_DAYS;
  }

  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function findLatestStoredBackup(
  bucket: R2BucketLike,
  backupPrefix: string,
): Promise<{ manifestKey: string; contentHash: string | null } | null> {
  if (!bucket.list) {
    return null;
  }

  const manifestKeys = await listBackupManifestKeys(bucket, backupPrefix);
  const latestManifestKey = manifestKeys.at(-1);
  if (!latestManifestKey) {
    return null;
  }

  return {
    manifestKey: latestManifestKey,
    contentHash: await readStoredBackupContentHash(bucket, latestManifestKey),
  };
}

async function listBackupManifestKeys(bucket: R2BucketLike, backupPrefix: string): Promise<string[]> {
  const manifestKeys: string[] = [];
  let cursor: string | undefined;

  do {
    const page = await bucket.list?.({
      cursor,
      prefix: `${backupPrefix}/`,
    });

    if (!page) {
      break;
    }

    for (const object of page.objects) {
      if (object.key.endsWith(`/${BACKUP_MANIFEST_FILENAME}`)) {
        manifestKeys.push(object.key);
      }
    }

    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  manifestKeys.sort();
  return manifestKeys;
}

export async function pruneStoredBackups(
  bucket: R2BucketLike,
  backupPrefix: string,
  options: {
    now?: Date;
    retentionDays: number | null;
  },
): Promise<string[]> {
  if (!bucket.list || !bucket.delete || !options.retentionDays) {
    return [];
  }

  const cutoffTimestamp = (options.now || new Date()).getTime() - options.retentionDays * 24 * 60 * 60 * 1000;
  const runKeys = await listStoredBackupObjectKeys(bucket, backupPrefix);
  const objectKeysToDelete = runKeys.filter((key) => {
    const runTimestamp = parseBackupRunTimestamp(key, backupPrefix);
    return runTimestamp !== null && runTimestamp < cutoffTimestamp;
  });

  if (objectKeysToDelete.length === 0) {
    return [];
  }

  await bucket.delete(objectKeysToDelete);
  return objectKeysToDelete;
}

async function listStoredBackupObjectKeys(bucket: R2BucketLike, backupPrefix: string): Promise<string[]> {
  const objectKeys: string[] = [];
  let cursor: string | undefined;

  do {
    const page = await bucket.list?.({
      cursor,
      prefix: `${backupPrefix}/`,
    });

    if (!page) {
      break;
    }

    for (const object of page.objects) {
      objectKeys.push(object.key);
    }

    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  objectKeys.sort();
  return objectKeys;
}

async function readStoredBackupContentHash(bucket: R2BucketLike, manifestKey: string): Promise<string | null> {
  if (!bucket.get) {
    return null;
  }

  const manifestObject = await bucket.get(manifestKey);
  if (!manifestObject) {
    return null;
  }

  const manifestText = await manifestObject.text();
  let parsedManifest: unknown;
  try {
    parsedManifest = JSON.parse(manifestText);
  } catch {
    return null;
  }

  if (!isRecord(parsedManifest)) {
    return null;
  }

  const contentHash = typeof parsedManifest.contentHash === "string" ? parsedManifest.contentHash.trim() : "";
  if (contentHash) {
    return contentHash;
  }

  const jsonExportKey = readStoredJsonExportKey(parsedManifest);
  if (!jsonExportKey) {
    return null;
  }

  const jsonExportObject = await bucket.get(jsonExportKey);
  if (!jsonExportObject) {
    return null;
  }

  const jsonExportText = await jsonExportObject.text();
  let parsedExport: unknown;
  try {
    parsedExport = JSON.parse(jsonExportText);
  } catch {
    return null;
  }

  if (!isSchedulerDataExportLike(parsedExport)) {
    return null;
  }

  return createDataExportContentHash(parsedExport);
}

function readStoredJsonExportKey(value: Record<string, unknown>): string | null {
  const artifacts = value.artifacts;
  if (!isRecord(artifacts) || typeof artifacts.jsonExportKey !== "string") {
    return null;
  }
  return artifacts.jsonExportKey;
}

function parseBackupRunTimestamp(key: string, backupPrefix: string): number | null {
  const normalizedPrefix = normalizeBackupPrefix(backupPrefix);
  const match = new RegExp(`^${escapeRegExp(normalizedPrefix)}/\\d{4}/\\d{2}/\\d{2}/([^/]+)/`).exec(key);
  if (!match?.[1]) {
    return null;
  }

  const timestampMatch = /^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/.exec(match[1]);
  if (!timestampMatch) {
    return null;
  }

  const [, hourPrefix, minute, second, milliseconds] = timestampMatch;
  const timestampText = `${hourPrefix}:${minute}:${second}.${milliseconds}Z`;
  const timestamp = Date.parse(timestampText);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isSchedulerDataExportLike(value: unknown): value is SchedulerDataExport {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.app === "social-media-scheduler" &&
    typeof value.schemaVersion === "number" &&
    typeof value.exportedAt === "string" &&
    Array.isArray(value.authUsers) &&
    Array.isArray(value.stateEntries) &&
    Array.isArray(value.channelConnections) &&
    Array.isArray(value.appSecrets)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
