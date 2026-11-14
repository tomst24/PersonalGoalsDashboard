-- Cloudflare D1 backing store for a private single-user goals site.
CREATE TABLE IF NOT EXISTS dashboard_state (
  id TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
