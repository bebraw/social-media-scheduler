import type { D1Database } from "../db-core";
import type { BackupAuthUser, BackupStateEntry, SchedulerDataExport } from "./types";

interface BackupAuthUserRow {
  name: string;
  password_hash: string;
  role: BackupAuthUser["role"];
}

interface BackupStateEntryRow {
  state_key: string;
  value_json: string;
  updated_at: string;
}

export async function collectBackupData(db: D1Database): Promise<{
  authUsers: BackupAuthUser[];
  stateEntries: BackupStateEntry[];
}> {
  const [authUsersResult, stateEntriesResult] = await Promise.all([
    db.prepare("SELECT name, password_hash, role FROM app_users ORDER BY name ASC").all<BackupAuthUserRow>(),
    db.prepare("SELECT state_key, value_json, updated_at FROM app_state ORDER BY state_key ASC").all<BackupStateEntryRow>(),
  ]);

  return {
    authUsers: authUsersResult.results.map((row) => ({
      name: row.name,
      passwordHash: row.password_hash,
      role: row.role,
    })),
    stateEntries: stateEntriesResult.results.map((row) => ({
      key: row.state_key,
      updatedAt: row.updated_at,
      valueJson: row.value_json,
    })),
  };
}

export async function createDataExportContentHash(dataExport: SchedulerDataExport): Promise<string> {
  const stableContent = JSON.stringify({
    app: dataExport.app,
    schemaVersion: dataExport.schemaVersion,
    authUsers: dataExport.authUsers,
    stateEntries: dataExport.stateEntries,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableContent));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}
