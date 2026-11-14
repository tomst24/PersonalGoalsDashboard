CREATE TABLE IF NOT EXISTS dashboard_state (
 id TEXT PRIMARY KEY NOT NULL,
 payload TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL
);
-- For a previously deployed old schema, run once separately:
-- ALTER TABLE dashboard_state ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
