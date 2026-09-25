ALTER TABLE users ADD COLUMN account_type TEXT NOT NULL DEFAULT 'owner'
  CHECK (account_type IN ('owner', 'customer'));
ALTER TABLE users ADD COLUMN email_verified_at TEXT;

CREATE TABLE IF NOT EXISTS customer_invites (
  id TEXT PRIMARY KEY,
  email_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  redeemed_at TEXT,
  redeemed_by TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (redeemed_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_customer_invites_email_expiry
  ON customer_invites(email_hash, expires_at);

CREATE TABLE IF NOT EXISTS customer_account_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_type TEXT NOT NULL CHECK (token_type IN ('verify_email', 'password_reset')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_customer_tokens_user_type_expiry
  ON customer_account_tokens(user_id, token_type, expires_at);
