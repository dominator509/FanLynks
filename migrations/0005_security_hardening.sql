ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TEXT;
ALTER TABLE users ADD COLUMN password_changed_at TEXT;

CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  user_id TEXT,
  event_type TEXT NOT NULL,
  identifier_hash TEXT,
  ip_hash TEXT,
  user_agent_hash TEXT,
  success INTEGER NOT NULL DEFAULT 0,
  detail_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_security_events_type_time ON security_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_user_time ON security_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_identifier_time ON security_events(identifier_hash, created_at);

