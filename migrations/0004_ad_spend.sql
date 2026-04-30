CREATE TABLE IF NOT EXISTS ad_spend_entries (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  source TEXT,
  medium TEXT,
  variant_id TEXT,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT "USD",
  note TEXT,
  spend_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (page_id) REFERENCES pages(id),
  FOREIGN KEY (variant_id) REFERENCES experiment_variants(id)
);

CREATE INDEX IF NOT EXISTS idx_ad_spend_page_date ON ad_spend_entries(page_id, spend_date);
CREATE INDEX IF NOT EXISTS idx_ad_spend_page_source ON ad_spend_entries(page_id, source, medium, spend_date);
CREATE INDEX IF NOT EXISTS idx_ad_spend_page_variant ON ad_spend_entries(page_id, variant_id, spend_date);
