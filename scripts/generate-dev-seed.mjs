import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outToStdout = process.argv.includes('--stdout');
const now = new Date().toISOString();
const adminEmail = process.env.ADMIN_EMAIL || 'admin@custom-link-hub.local';
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || 'disabled';
const adminIsActive = process.env.ADMIN_PASSWORD_HASH ? 1 : 0;
const baseUrl = (process.env.PUBLIC_BASE_URL || 'https://custom-link-hub-v5.pages.dev').replace(/\/+$/, '');
const sql = `-- Custom Link Hub dev seed
-- Safe defaults:
-- - The admin user is inactive unless ADMIN_PASSWORD_HASH is provided.
-- - Third-party marketing/analytics integrations are disabled until real IDs are saved.
-- - CTA URLs point back to this deployment instead of external placeholder domains.
DELETE FROM ad_spend_entries;
DELETE FROM variant_assignments;
DELETE FROM experiment_variants;
DELETE FROM experiments;
DELETE FROM page_links;
DELETE FROM page_sections;
DELETE FROM integrations;
DELETE FROM pages;
DELETE FROM tenants;
DELETE FROM users;

INSERT INTO users (id, email, password_hash, created_at, updated_at, last_login_at, is_active) VALUES
('usr_dev_admin', '${adminEmail.replaceAll("'", "''")}', '${adminPasswordHash.replaceAll("'", "''")}', '${now}', '${now}', NULL, ${adminIsActive});

INSERT INTO tenants (id, owner_user_id, name, slug, created_at, updated_at) VALUES
('tenant_demo', 'usr_dev_admin', 'Custom Link Hub', 'custom-link-hub', '${now}', '${now}');

INSERT INTO pages (id, tenant_id, slug, title, subtitle, avatar_url, announcement_enabled, announcement_text, announcement_url, hero_cta_label, hero_cta_url, tracking_mode, privacy_mode, published_version, is_active, created_at, updated_at, page_theme_json, page_privacy_json) VALUES
('page_demo', 'tenant_demo', 'home', 'Custom Link Hub', 'A fast, privacy-aware link hub for your highest-value calls to action.', NULL, 1, 'Update your live offer in Admin', '${baseUrl}/admin.html', 'Open Admin', '${baseUrl}/admin.html', 'first_party', 'default_standard', 1, 1, '${now}', '${now}',
json_object('bg','#09090b','surface','#18181b','text','#fafafa','muted','#b2b2ba','accent','#d4af37','border','#34343a','iconBg','#232329','primaryBg','#ffffff','primaryText','#12141a','secondaryBg','#1c1f28','secondaryText','#f7f7fb','neutralBg','#141820','neutralText','#eef2fb','fontBody','Inter, system-ui, sans-serif','fontHeading','Cormorant Garamond, Georgia, serif','gap','14px'),
json_object('bannerVersion','v1','privacyChoicesLabel','Your Privacy Choices','bannerTitle','Choose your privacy settings','bannerBody','We use optional analytics and marketing tags only if you allow them. Essential features stay on either way.','acceptLabel','Allow all','analyticsOnlyLabel','Analytics only','declineLabel','Essential only','gpcTitle','Global Privacy Control detected','gpcBody','Advertising-related tracking is disabled for this visit because your browser sent a privacy preference signal.','honorGpc',1,'footerNote','Fast, privacy-aware link hub'));

INSERT INTO page_links (id, page_id, section_id, title, subtitle, url, icon_type, icon_value, badge_text, style_role, row_order, is_enabled, start_at, end_at, created_at, updated_at) VALUES
('link_offer', 'page_demo', NULL, 'Primary Offer', 'Replace this with your highest-value CTA', '${baseUrl}/admin.html', 'none', NULL, 'Top pick', 'primary', 1, 1, NULL, NULL, '${now}', '${now}'),
('link_join', 'page_demo', NULL, 'Email List', 'Use this row for newsletter or lead capture traffic', '${baseUrl}/admin.html', 'none', NULL, NULL, 'secondary', 2, 1, NULL, NULL, '${now}', '${now}'),
('link_book', 'page_demo', NULL, 'Booking Page', 'Use this row for high-intent visitors', '${baseUrl}/admin.html', 'none', NULL, NULL, 'neutral', 3, 1, NULL, NULL, '${now}', '${now}');

INSERT INTO integrations (id, page_id, provider, config_json, is_enabled, created_at, updated_at) VALUES
('intg_ga4', 'page_demo', 'ga4', json_object('measurementId','','enablePageViews',1,'enableClickEvents',1,'enableExperimentParameters',1), 0, '${now}', '${now}'),
('intg_meta', 'page_demo', 'meta', json_object('pixelId','','eventMappings', json_object('page_view','PageView','hero_cta_click','ViewContent','link_click','ViewContent')), 0, '${now}', '${now}'),
('intg_gtm', 'page_demo', 'gtm', json_object('containerId','','advertisingEnabled',0), 0, '${now}', '${now}'),
('intg_cfwa', 'page_demo', 'cfwa', json_object('enabled',1), 1, '${now}', '${now}');

INSERT INTO experiments (id, page_id, name, status, assignment_ttl_days, started_at, ended_at, winner_variant_id, created_at, updated_at) VALUES
('exp_demo', 'page_demo', 'Paused palette test', 'paused', 30, NULL, NULL, NULL, '${now}', '${now}');

INSERT INTO experiment_variants (id, experiment_id, name, weight, tokens_json, content_overrides_json, is_enabled, created_at, updated_at) VALUES
('var_black', 'exp_demo', 'Black Luxe', 50, json_object('bg','#09090b','surface','#18181b','text','#fafafa','accent','#d4af37'), json_object('page', json_object('title','Custom Link Hub')), 1, '${now}', '${now}'),
('var_pink', 'exp_demo', 'Pink Neon', 50, json_object('bg','#140917','surface','#2c1233','text','#fff7fb','accent','#ff4fd8'), json_object('page', json_object('title','Custom Link Hub')), 1, '${now}', '${now}');
`;

if (outToStdout) {
  process.stdout.write(sql);
} else {
  const outDir = join(process.cwd(), 'seeds');
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, 'dev_seed.sql');
  writeFileSync(outFile, sql, 'utf8');
  console.log(`Wrote ${outFile}`);
}
