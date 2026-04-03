PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS channel_connections (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('linkedin', 'x', 'bluesky')),
  label TEXT NOT NULL,
  account_handle TEXT NOT NULL COLLATE NOCASE,
  access_token_secret_key TEXT NOT NULL UNIQUE,
  refresh_token_secret_key TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(channel, account_handle)
);

CREATE INDEX IF NOT EXISTS idx_channel_connections_channel ON channel_connections (channel);

CREATE TRIGGER IF NOT EXISTS trg_channel_connections_updated_at
AFTER UPDATE ON channel_connections
FOR EACH ROW
BEGIN
  UPDATE channel_connections
  SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = OLD.id;
END;
