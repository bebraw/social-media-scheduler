import type { Env } from "../app-env";
import type { D1Database } from "../db-core";
import { prepareChannelConnectionDraft, ProviderConnectionValidationError, type ProviderAdapterContext } from "../providers";
import { getChannelConstraint, type QueueChannel } from "../queue/constraints";
import { deleteEncryptedSecret, loadEncryptedSecret, resolveAppEncryptionSecret, saveEncryptedSecret } from "../secrets";

interface ChannelConnectionRow {
  access_token_secret_key: string;
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

export interface PublishingChannelConnection extends ChannelConnection {
  accessTokenSecretKey: string;
  refreshTokenSecretKey: string | null;
}

export interface ChannelConnectionDraft {
  accessToken: string;
  accountHandle: string;
  channel: string;
  label: string;
  refreshToken: string;
}

export interface ChannelCredentialRotationInput {
  accessToken: string;
  clearRefreshToken?: boolean;
  connectionId: string;
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
      "SELECT id, channel, label, account_handle, access_token_secret_key, refresh_token_secret_key, created_at, updated_at FROM channel_connections ORDER BY channel ASC, label ASC, created_at ASC",
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

export async function getChannelConnection(db: D1Database, connectionId: string): Promise<ChannelConnection | null> {
  const connection = await getStoredPublishingChannelConnection(db, connectionId);
  if (!connection) {
    return null;
  }

  return {
    accountHandle: connection.accountHandle,
    channel: connection.channel,
    createdAt: connection.createdAt,
    hasRefreshToken: connection.hasRefreshToken,
    id: connection.id,
    label: connection.label,
    updatedAt: connection.updatedAt,
  };
}

export async function listPublishingChannelConnections(db: D1Database): Promise<PublishingChannelConnection[]> {
  const result = await db
    .prepare(
      "SELECT id, channel, label, account_handle, access_token_secret_key, refresh_token_secret_key, created_at, updated_at FROM channel_connections ORDER BY channel ASC, label ASC, created_at ASC",
    )
    .all<ChannelConnectionRow>();

  return result.results.map((row) => ({
    accessTokenSecretKey: row.access_token_secret_key,
    accountHandle: row.account_handle,
    channel: row.channel,
    createdAt: row.created_at,
    hasRefreshToken: typeof row.refresh_token_secret_key === "string" && row.refresh_token_secret_key.length > 0,
    id: row.id,
    label: row.label,
    refreshTokenSecretKey: row.refresh_token_secret_key,
    updatedAt: row.updated_at,
  }));
}

export async function createChannelConnection(
  db: D1Database,
  env: Pick<Env, "APP_ENCRYPTION_SECRET" | "SESSION_SECRET">,
  input: ChannelConnectionDraft,
  context: ProviderAdapterContext = {},
): Promise<ChannelConnection> {
  const normalized = normalizeChannelConnectionDraft(input);
  const prepared = await prepareNormalizedDraft(normalized, context);
  const existingConnection = await db
    .prepare("SELECT id FROM channel_connections WHERE channel = ? AND account_handle = ? COLLATE NOCASE")
    .bind(prepared.channel, prepared.accountHandle)
    .first<ChannelConnectionLookupRow>();

  if (existingConnection?.id) {
    throw new ChannelConnectionValidationError(
      `${getChannelConstraint(prepared.channel).name} account ${prepared.accountHandle} is already connected.`,
    );
  }

  const connectionId = crypto.randomUUID();
  const accessTokenSecretKey = buildAccessTokenSecretKey(connectionId);
  const refreshTokenSecretKey = prepared.refreshToken ? buildRefreshTokenSecretKey(connectionId) : null;
  const encryptionSecret = resolveAppEncryptionSecret(env);
  const timestamp = new Date().toISOString();

  await saveEncryptedSecret(db, accessTokenSecretKey, prepared.accessToken, encryptionSecret);

  try {
    if (refreshTokenSecretKey) {
      await saveEncryptedSecret(db, refreshTokenSecretKey, prepared.refreshToken, encryptionSecret);
    }

    await db
      .prepare(
        "INSERT INTO channel_connections (id, channel, label, account_handle, access_token_secret_key, refresh_token_secret_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        connectionId,
        prepared.channel,
        prepared.label,
        prepared.accountHandle,
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
    accountHandle: prepared.accountHandle,
    channel: prepared.channel,
    createdAt: timestamp,
    hasRefreshToken: Boolean(refreshTokenSecretKey),
    id: connectionId,
    label: prepared.label,
    updatedAt: timestamp,
  };
}

export async function rotateChannelConnectionCredentials(
  db: D1Database,
  env: Pick<Env, "APP_ENCRYPTION_SECRET" | "SESSION_SECRET">,
  input: ChannelCredentialRotationInput,
  context: ProviderAdapterContext = {},
): Promise<ChannelConnection> {
  const connection = await getStoredPublishingChannelConnection(db, input.connectionId);
  if (!connection) {
    throw new ChannelConnectionValidationError("Choose a saved channel connection before rotating credentials.");
  }

  const encryptionSecret = resolveAppEncryptionSecret(env);
  const submittedRefreshToken = input.refreshToken.trim();
  const existingRefreshToken =
    submittedRefreshToken.length === 0 && !input.clearRefreshToken && connection.refreshTokenSecretKey
      ? await loadEncryptedSecret(db, connection.refreshTokenSecretKey, encryptionSecret)
      : null;
  const normalized = normalizeChannelConnectionDraft({
    accessToken: input.accessToken,
    accountHandle: connection.accountHandle,
    channel: connection.channel,
    label: connection.label,
    refreshToken: submittedRefreshToken || existingRefreshToken || "",
  });
  const prepared = await prepareNormalizedDraft(normalized, context);
  const conflictingConnection = await db
    .prepare("SELECT id FROM channel_connections WHERE channel = ? AND account_handle = ? COLLATE NOCASE")
    .bind(prepared.channel, prepared.accountHandle)
    .first<ChannelConnectionLookupRow>();

  if (conflictingConnection?.id && conflictingConnection.id !== connection.id) {
    throw new ChannelConnectionValidationError(
      `${getChannelConstraint(prepared.channel).name} account ${prepared.accountHandle} is already connected.`,
    );
  }

  const nextRefreshToken =
    submittedRefreshToken.length > 0 ? prepared.refreshToken : input.clearRefreshToken ? "" : existingRefreshToken || "";
  const nextRefreshTokenSecretKey = nextRefreshToken ? connection.refreshTokenSecretKey || buildRefreshTokenSecretKey(connection.id) : null;
  const timestamp = new Date().toISOString();

  await saveEncryptedSecret(db, connection.accessTokenSecretKey, prepared.accessToken, encryptionSecret);
  if (nextRefreshTokenSecretKey && nextRefreshToken) {
    await saveEncryptedSecret(db, nextRefreshTokenSecretKey, nextRefreshToken, encryptionSecret);
  }

  await db
    .prepare("UPDATE channel_connections SET account_handle = ?, refresh_token_secret_key = ?, updated_at = ? WHERE id = ?")
    .bind(prepared.accountHandle, nextRefreshTokenSecretKey, timestamp, connection.id)
    .run();

  if (!nextRefreshToken && connection.refreshTokenSecretKey) {
    await deleteEncryptedSecret(db, connection.refreshTokenSecretKey);
  }

  return {
    accountHandle: prepared.accountHandle,
    channel: connection.channel,
    createdAt: connection.createdAt,
    hasRefreshToken: Boolean(nextRefreshTokenSecretKey),
    id: connection.id,
    label: connection.label,
    updatedAt: timestamp,
  };
}

export async function deleteChannelConnection(db: D1Database, connectionId: string): Promise<boolean> {
  const connection = await getStoredPublishingChannelConnection(db, connectionId);
  if (!connection) {
    return false;
  }

  await db.prepare("DELETE FROM channel_connections WHERE id = ?").bind(connectionId).run();
  await deleteEncryptedSecret(db, connection.accessTokenSecretKey);
  if (connection.refreshTokenSecretKey) {
    await deleteEncryptedSecret(db, connection.refreshTokenSecretKey);
  }

  return true;
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

async function prepareNormalizedDraft(
  input: {
    accessToken: string;
    accountHandle: string;
    channel: QueueChannel;
    label: string;
    refreshToken: string;
  },
  context: ProviderAdapterContext,
): Promise<{
  accessToken: string;
  accountHandle: string;
  channel: QueueChannel;
  label: string;
  refreshToken: string;
}> {
  try {
    return await prepareChannelConnectionDraft(input, context);
  } catch (error) {
    if (error instanceof ProviderConnectionValidationError) {
      throw new ChannelConnectionValidationError(error.message);
    }

    throw error;
  }
}

function mapStoredPublishingChannelConnection(row: ChannelConnectionRow): PublishingChannelConnection {
  return {
    accessTokenSecretKey: row.access_token_secret_key,
    accountHandle: row.account_handle,
    channel: row.channel,
    createdAt: row.created_at,
    hasRefreshToken: typeof row.refresh_token_secret_key === "string" && row.refresh_token_secret_key.length > 0,
    id: row.id,
    label: row.label,
    refreshTokenSecretKey: row.refresh_token_secret_key,
    updatedAt: row.updated_at,
  };
}

async function getStoredPublishingChannelConnection(db: D1Database, connectionId: string): Promise<PublishingChannelConnection | null> {
  const row = await db
    .prepare(
      "SELECT id, channel, label, account_handle, access_token_secret_key, refresh_token_secret_key, created_at, updated_at FROM channel_connections WHERE id = ?",
    )
    .bind(connectionId)
    .first<ChannelConnectionRow>();

  return row ? mapStoredPublishingChannelConnection(row) : null;
}
