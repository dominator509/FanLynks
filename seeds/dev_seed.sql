-- Custom Link Hub dev seed
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
('usr_dev_admin', 'admin@example.com', 'REPLACE_WITH_ADMIN_PASSWORD_HASH', '2026-04-08T23:17:02.065Z', '2026-04-08T23:17:02.065Z', NULL, 1);

INSERT INTO tenants (id, owner_user_id, name, slug, created_at, updated_at) VALUES
('tenant_demo', 'usr_dev_admin', 'Demo Tenant', 'demo-tenant', '2026-04-08T23:17:02.065Z', '2026-04-08T23:17:02.065Z');

INSERT INTO pages (id, tenant_id, slug, title, subtitle, avatar_url, announcement_enabled, announcement_text, announcement_url, hero_cta_label, hero_cta_url, tracking_mode, privacy_mode, published_version, is_active, created_at, updated_at, page_theme_json, page_privacy_json) VALUES
('page_demo', 'tenant_demo', 'demo', 'Demo Link Hub', 'A fast, high-conversion one-page link hub.', NULL, 1, 'New offer is live', 'https://example.com/launch', 'Top Offer', 'https://example.com/offer', 'ga4_meta', 'default_standard', 1, 1, '2026-04-08T23:17:02.065Z', '2026-04-08T23:17:02.065Z',
json_object('bg','#09090b','surface','#18181b','text','#fafafa','muted','#b2b2ba','accent','#d4af37','border','#34343a','iconBg','#232329','primaryBg','#ffffff','primaryText','#12141a','secondaryBg','#1c1f28','secondaryText','#f7f7fb','neutralBg','#141820','neutralText','#eef2fb','fontBody','Inter, system-ui, sans-serif','fontHeading','Cormorant Garamond, Georgia, serif','gap','14px'),
json_object('bannerVersion','v1','privacyChoicesLabel','Your Privacy Choices','bannerTitle','Choose your privacy settings','bannerBody','We use optional analytics and marketing tags only if you allow them. Essential features stay on either way.','acceptLabel','Allow all','analyticsOnlyLabel','Analytics only','declineLabel','Essential only','gpcTitle','Global Privacy Control detected','gpcBody','Advertising-related tracking is disabled for this visit because your browser sent a privacy preference signal.','honorGpc',1,'footerNote','Fast, privacy-aware link hub'));

INSERT INTO page_links (id, page_id, section_id, title, subtitle, url, icon_type, icon_value, badge_text, style_role, row_order, is_enabled, start_at, end_at, created_at, updated_at) VALUES
('link_offer', 'page_demo', NULL, 'VIP Offer', 'Highest-value CTA first', 'https://example.com/vip', 'emoji', '🔥', 'Top pick', 'primary', 1, 1, NULL, NULL, '2026-04-08T23:17:02.065Z', '2026-04-08T23:17:02.065Z'),
('link_join', 'page_demo', NULL, 'Join Free List', 'Capture warm traffic before the sale', 'https://example.com/list', 'emoji', '✉️', NULL, 'secondary', 2, 1, NULL, NULL, '2026-04-08T23:17:02.065Z', '2026-04-08T23:17:02.065Z'),
('link_book', 'page_demo', NULL, 'Book a Call', 'High-intent visitors only', 'https://example.com/book', 'emoji', '📅', NULL, 'neutral', 3, 1, NULL, NULL, '2026-04-08T23:17:02.065Z', '2026-04-08T23:17:02.065Z');

INSERT INTO integrations (id, page_id, provider, config_json, is_enabled, created_at, updated_at) VALUES
('intg_ga4', 'page_demo', 'ga4', json_object('measurementId','G-REPLACE_ME','enablePageViews',1,'enableClickEvents',1,'enableExperimentParameters',1), 1, '2026-04-08T23:17:02.065Z', '2026-04-08T23:17:02.065Z'),
('intg_meta', 'page_demo', 'meta', json_object('pixelId','REPLACE_ME','eventMappings', json_object('page_view','PageView','hero_cta_click','ViewContent','link_click','ViewContent')), 0, '2026-04-08T23:17:02.065Z', '2026-04-08T23:17:02.065Z'),
('intg_gtm', 'page_demo', 'gtm', json_object('containerId','GTM-REPLACE','advertisingEnabled',0), 0, '2026-04-08T23:17:02.065Z', '2026-04-08T23:17:02.065Z'),
('intg_cfwa', 'page_demo', 'cfwa', json_object('enabled',1), 1, '2026-04-08T23:17:02.065Z', '2026-04-08T23:17:02.065Z');

INSERT INTO experiments (id, page_id, name, status, assignment_ttl_days, started_at, ended_at, winner_variant_id, created_at, updated_at) VALUES
('exp_demo', 'page_demo', 'Demo palette test', 'paused', 30, NULL, NULL, NULL, '2026-04-08T23:17:02.065Z', '2026-04-08T23:17:02.065Z');

INSERT INTO experiment_variants (id, experiment_id, name, weight, tokens_json, content_overrides_json, is_enabled, created_at, updated_at) VALUES
('var_black', 'exp_demo', 'Black Luxe', 50, json_object('bg','#09090b','surface','#18181b','text','#fafafa','accent','#d4af37'), json_object('page', json_object('title','Demo Link Hub')), 1, '2026-04-08T23:17:02.065Z', '2026-04-08T23:17:02.065Z'),
('var_pink', 'exp_demo', 'Pink Neon', 50, json_object('bg','#140917','surface','#2c1233','text','#fff7fb','accent','#ff4fd8'), json_object('page', json_object('title','Demo Link Hub')), 1, '2026-04-08T23:17:02.065Z', '2026-04-08T23:17:02.065Z');
