import type { AccessRole } from "../auth";

export interface R2HttpMetadata {
  contentDisposition?: string;
  contentType?: string;
  cacheControl?: string;
}

export interface R2PutOptions {
  httpMetadata?: R2HttpMetadata;
  customMetadata?: Record<string, string>;
}

export interface R2ObjectLike {
  key: string;
}

export interface R2ListOptions {
  cursor?: string;
  limit?: number;
  prefix?: string;
}

export interface R2ListResult {
  objects: R2ObjectLike[];
  truncated?: boolean;
  cursor?: string;
}

export interface R2ObjectBodyLike {
  text(): Promise<string>;
}

export interface R2BucketLike {
  put(key: string, value: string, options?: R2PutOptions): Promise<unknown>;
  list?(options?: R2ListOptions): Promise<R2ListResult>;
  get?(key: string): Promise<R2ObjectBodyLike | null>;
}

export interface BackupAuthUser {
  name: string;
  passwordHash: string;
  role: AccessRole;
}

export interface BackupStateEntry {
  key: string;
  updatedAt: string;
  valueJson: string;
}

export interface SchedulerDataExport {
  app: "social-media-scheduler";
  schemaVersion: 1;
  exportedAt: string;
  authUsers: BackupAuthUser[];
  stateEntries: BackupStateEntry[];
}

export interface AutomatedBackupManifest {
  app: "social-media-scheduler";
  backupVersion: 1;
  generatedAt: string;
  cron: string;
  contentHash: string;
  counts: {
    authUsers: number;
    stateEntries: number;
  };
  artifacts: {
    jsonExportKey: string;
    summaryReportKey: string;
  };
}

export interface AutomatedBackupResult {
  skipped: boolean;
  contentHash: string;
  manifest: AutomatedBackupManifest | null;
  manifestKey: string | null;
  matchedManifestKey: string | null;
}
