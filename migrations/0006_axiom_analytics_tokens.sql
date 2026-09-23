CREATE TABLE IF NOT EXISTS integration_api_tokens (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_integration_api_tokens_page
  ON integration_api_tokens(page_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_api_tokens_active_page
  ON integration_api_tokens(page_id)
  WHERE revoked_at IS NULL;
