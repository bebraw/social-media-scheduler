import type { Env } from "../app-env";
import type { D1Database } from "../db-core";
import { getChannelConstraint, type QueueChannel } from "../queue/constraints";
import { deleteEncryptedSecret, resolveAppEncryptionSecret, saveEncryptedSecret } from "../secrets";

interface ChannelConnectionRow {
  account_handle: string;
  channel: QueueChannel;
  created_at: string;
  id: string;
  label: string;
  refresh_token_secret_key: string | null;
  updated_at: string;
}

interface ChannelConnectionLookupRow {
  id: string;
}

export interface ChannelConnection {
  accountHandle: string;
  channel: QueueChannel;
  createdAt: string;
  hasRefreshToken: boolean;
  id: string;
  label: string;
  updatedAt: string;
}

export interface ChannelConnectionDraft {
  accessToken: string;
  accountHandle: string;
  channel: string;
  label: string;
  refreshToken: string;
}

export class ChannelConnectionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChannelConnectionValidationError";
  }
}

export function getDefaultChannelConnectionDraft(): ChannelConnectionDraft {
  return {
    accessToken: "",
    accountHandle: "",
    channel: "x",
    label: "",
    refreshToken: "",
  };
}

export async function loadChannelConnections(db: D1Database): Promise<ChannelConnection[]> {
  const result = await db
    .prepare(
      "SELECT id, channel, label, account_handle, refresh_token_secret_key, created_at, updated_at FROM channel_connections ORDER BY channel ASC, label ASC, created_at ASC",
    )
    .all<ChannelConnectionRow>();

  return result.results.map((row) => ({
    accountHandle: row.account_handle,
    channel: row.channel,
    createdAt: row.created_at,
    hasRefreshToken: typeof row.refresh_token_secret_key === "string" && row.refresh_token_secret_key.length > 0,
    id: row.id,
    label: row.label,
    updatedAt: row.updated_at,
  }));
}

export async function createChannelConnection(
  db: D1Database,
  env: Pick<Env, "APP_ENCRYPTION_SECRET" | "SESSION_SECRET">,
  input: ChannelConnectionDraft,
): Promise<ChannelConnection> {
  const normalized = normalizeChannelConnectionDraft(input);
  const existingConnection = await db
    .prepare("SELECT id FROM channel_connections WHERE channel = ? AND account_handle = ? COLLATE NOCASE")
    .bind(normalized.channel, normalized.accountHandle)
    .first<ChannelConnectionLookupRow>();

  if (existingConnection?.id) {
    throw new ChannelConnectionValidationError(
      `${getChannelConstraint(normalized.channel).name} account ${normalized.accountHandle} is already connected.`,
    );
  }

  const connectionId = crypto.randomUUID();
  const accessTokenSecretKey = buildAccessTokenSecretKey(connectionId);
  const refreshTokenSecretKey = normalized.refreshToken ? buildRefreshTokenSecretKey(connectionId) : null;
  const encryptionSecret = resolveAppEncryptionSecret(env);
  const timestamp = new Date().toISOString();

  await saveEncryptedSecret(db, accessTokenSecretKey, normalized.accessToken, encryptionSecret);

  try {
    if (refreshTokenSecretKey) {
      await saveEncryptedSecret(db, refreshTokenSecretKey, normalized.refreshToken, encryptionSecret);
    }

    await db
      .prepare(
        "INSERT INTO channel_connections (id, channel, label, account_handle, access_token_secret_key, refresh_token_secret_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        connectionId,
        normalized.channel,
        normalized.label,
        normalized.accountHandle,
        accessTokenSecretKey,
        refreshTokenSecretKey,
        timestamp,
        timestamp,
      )
      .run();
  } catch (error) {
    await deleteEncryptedSecret(db, accessTokenSecretKey);
    if (refreshTokenSecretKey) {
      await deleteEncryptedSecret(db, refreshTokenSecretKey);
    }
    throw error;
  }

  return {
    accountHandle: normalized.accountHandle,
    channel: normalized.channel,
    createdAt: timestamp,
    hasRefreshToken: Boolean(refreshTokenSecretKey),
    id: connectionId,
    label: normalized.label,
    updatedAt: timestamp,
  };
}

export function normalizeChannelConnectionDraft(input: ChannelConnectionDraft): {
  accessToken: string;
  accountHandle: string;
  channel: QueueChannel;
  label: string;
  refreshToken: string;
} {
  const channel = normalizeChannel(input.channel);
  const label = input.label.trim();
  const accountHandle = input.accountHandle.trim();
  const accessToken = input.accessToken.trim();
  const refreshToken = input.refreshToken.trim();

  if (!channel) {
    throw new ChannelConnectionValidationError("Choose a supported channel for the connection.");
  }

  if (!label) {
    throw new ChannelConnectionValidationError("Add a label so this connection is easy to identify later.");
  }

  if (!accountHandle) {
    throw new ChannelConnectionValidationError("Add a handle or profile label for the connected account.");
  }

  if (!accessToken) {
    throw new ChannelConnectionValidationError("Add an access token before saving the channel connection.");
  }

  return {
    accessToken,
    accountHandle,
    channel,
    label,
    refreshToken,
  };
}

export function buildAccessTokenSecretKey(connectionId: string): string {
  return `channel_connection:${connectionId}:access_token`;
}

export function buildRefreshTokenSecretKey(connectionId: string): string {
  return `channel_connection:${connectionId}:refresh_token`;
}

export function listConfiguredProviders(connections: ChannelConnection[]): QueueChannel[] {
  const unique = new Set<QueueChannel>();

  for (const connection of connections) {
    unique.add(connection.channel);
  }

  const orderedProviders: QueueChannel[] = ["linkedin", "x", "bluesky"];
  return orderedProviders.filter((channel) => unique.has(channel));
}

function normalizeChannel(value: string): QueueChannel | null {
  if (value === "linkedin" || value === "x" || value === "bluesky") {
    return value;
  }

  return null;
}
