PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  avatar_url TEXT,
  announcement_enabled INTEGER NOT NULL DEFAULT 0,
  announcement_text TEXT,
  announcement_url TEXT,
  hero_cta_label TEXT,
  hero_cta_url TEXT,
  tracking_mode TEXT NOT NULL DEFAULT 'none',
  privacy_mode TEXT NOT NULL DEFAULT 'default_standard',
  published_version INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS page_sections (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  label TEXT NOT NULL,
  section_order INTEGER NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (page_id) REFERENCES pages(id)
);

CREATE TABLE IF NOT EXISTS page_links (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  section_id TEXT,
  title TEXT NOT NULL,
  subtitle TEXT,
  url TEXT NOT NULL,
  icon_type TEXT NOT NULL DEFAULT 'none',
  icon_value TEXT,
  badge_text TEXT,
  style_role TEXT NOT NULL DEFAULT 'neutral',
  row_order INTEGER NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  start_at TEXT,
  end_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (page_id) REFERENCES pages(id),
  FOREIGN KEY (section_id) REFERENCES page_sections(id)
);

CREATE TABLE IF NOT EXISTS theme_presets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  name TEXT NOT NULL,
  tokens_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  assignment_ttl_days INTEGER NOT NULL DEFAULT 30,
  started_at TEXT,
  ended_at TEXT,
  winner_variant_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (page_id) REFERENCES pages(id)
);

CREATE TABLE IF NOT EXISTS experiment_variants (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  name TEXT NOT NULL,
  weight INTEGER NOT NULL,
  tokens_json TEXT NOT NULL,
  content_overrides_json TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (experiment_id) REFERENCES experiments(id)
);

CREATE TABLE IF NOT EXISTS variant_assignments (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  visitor_key TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (experiment_id) REFERENCES experiments(id),
  FOREIGN KEY (page_id) REFERENCES pages(id),
  FOREIGN KEY (variant_id) REFERENCES experiment_variants(id)
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  experiment_id TEXT,
  variant_id TEXT,
  event_name TEXT NOT NULL,
  event_payload_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS consent_records (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  visitor_key TEXT NOT NULL,
  country_code TEXT,
  region_policy TEXT NOT NULL,
  gpc_detected INTEGER NOT NULL DEFAULT 0,
  analytics_state TEXT NOT NULL,
  ads_state TEXT NOT NULL,
  banner_version TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  FOREIGN KEY (page_id) REFERENCES pages(id)
);

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  config_json TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (page_id) REFERENCES pages(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  diff_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_pages_tenant_id ON pages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_page_links_page_order ON page_links(page_id, row_order);
CREATE INDEX IF NOT EXISTS idx_sections_page_order ON page_sections(page_id, section_order);
CREATE INDEX IF NOT EXISTS idx_experiments_page_status ON experiments(page_id, status);
CREATE INDEX IF NOT EXISTS idx_variants_experiment ON experiment_variants(experiment_id);
CREATE INDEX IF NOT EXISTS idx_assignments_lookup ON variant_assignments(page_id, experiment_id, visitor_key);
CREATE INDEX IF NOT EXISTS idx_events_page_time ON events(page_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_name_time ON events(event_name, occurred_at);
CREATE INDEX IF NOT EXISTS idx_consent_lookup ON consent_records(page_id, visitor_key, recorded_at);
CREATE INDEX IF NOT EXISTS idx_integrations_page_provider ON integrations(page_id, provider);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_time ON audit_log(tenant_id, created_at);
