import type { D1Database } from "../db-core";
import type { BackupAppSecret, BackupAuthUser, BackupChannelConnection, BackupStateEntry, SchedulerDataExport } from "./types";

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

interface BackupChannelConnectionRow {
  account_handle: string;
  channel: BackupChannelConnection["channel"];
  created_at: string;
  id: string;
  label: string;
  refresh_token_secret_key: string | null;
  updated_at: string;
}

interface BackupAppSecretRow {
  encrypted_value: string;
  secret_key: string;
  updated_at: string;
}

export async function collectBackupData(db: D1Database): Promise<{
  authUsers: BackupAuthUser[];
  stateEntries: BackupStateEntry[];
  channelConnections: BackupChannelConnection[];
  appSecrets: BackupAppSecret[];
}> {
  const [authUsersResult, stateEntriesResult, channelConnectionsResult, appSecretsResult] = await Promise.all([
    db.prepare("SELECT name, password_hash, role FROM app_users ORDER BY name ASC").all<BackupAuthUserRow>(),
    db.prepare("SELECT state_key, value_json, updated_at FROM app_state ORDER BY state_key ASC").all<BackupStateEntryRow>(),
    db
      .prepare(
        "SELECT id, channel, label, account_handle, refresh_token_secret_key, created_at, updated_at FROM channel_connections ORDER BY channel ASC, label ASC, created_at ASC",
      )
      .all<BackupChannelConnectionRow>(),
    db.prepare("SELECT secret_key, encrypted_value, updated_at FROM app_secrets ORDER BY secret_key ASC").all<BackupAppSecretRow>(),
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
    channelConnections: channelConnectionsResult.results.map((row) => ({
      accountHandle: row.account_handle,
      channel: row.channel,
      createdAt: row.created_at,
      hasRefreshToken: typeof row.refresh_token_secret_key === "string" && row.refresh_token_secret_key.length > 0,
      id: row.id,
      label: row.label,
      updatedAt: row.updated_at,
    })),
    appSecrets: appSecretsResult.results.map((row) => ({
      encryptedValue: row.encrypted_value,
      key: row.secret_key,
      updatedAt: row.updated_at,
    })),
  };
}

export async function createDataExportContentHash(dataExport: SchedulerDataExport): Promise<string> {
  const stableContent = JSON.stringify({
    app: dataExport.app,
    schemaVersion: dataExport.schemaVersion,
    authUsers: dataExport.authUsers,
    stateEntries: dataExport.stateEntries,
    channelConnections: dataExport.channelConnections,
    appSecrets: dataExport.appSecrets,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableContent));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}
