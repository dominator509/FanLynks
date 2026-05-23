UPDATE pages SET
  title = 'Fan Lynks — Smarter Bio Links for Creators',
  subtitle = 'A smarter bio link hub for creators who want better analytics, cleaner funnels, and more control.',
  avatar_url = 'https://custom-link-hub-v5.pages.dev/assets/fanlynks/fanlynks-stamp.png',
  announcement_enabled = 0,
  announcement_text = 'Fan Lynks creator beta is opening soon',
  announcement_url = 'https://fanlynks.com/join',
  hero_cta_label = 'Start Building Your Fan Lynks Page',
  hero_cta_url = 'https://fanlynks.com/join',
  tracking_mode = 'first_party',
  privacy_mode = 'default_standard',
  page_theme_json = '{"bg":"#050505","surface":"#121212","text":"#ffffff","muted":"#c8c2b5","accent":"#cfa029","primaryBg":"#cfa029","primaryText":"#050505","secondaryBg":"#171717","secondaryText":"#ffffff","neutralBg":"#101010","neutralText":"#f5f0e8","border":"#302819","iconBg":"#ffffff","fontBody":"ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif","fontHeading":"ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif","gap":"14px","radius":"10px","buttonRadius":"8px","maxWidth":"720px"}',
  page_privacy_json = '{"bannerVersion":"fanlynks-v1","privacyChoicesLabel":"Privacy Choices","footerNote":"Fan Lynks keeps creator funnels clean, fast, and privacy-aware.","bannerTitle":"Choose your Fan Lynks privacy settings","bannerBody":"Fan Lynks uses first-party analytics to understand page performance. Optional marketing tags are off until you allow them.","acceptLabel":"Allow all","analyticsOnlyLabel":"Analytics only","declineLabel":"Essential only","gpcTitle":"Global Privacy Control detected","gpcBody":"Advertising-related tracking is disabled for this visit because your browser sent a privacy preference signal.","honorGpc":true}',
  published_version = published_version + 1,
  updated_at = datetime('now')
WHERE id = 'page_demo';

DELETE FROM page_links WHERE page_id = 'page_demo';

INSERT INTO page_links (id,page_id,section_id,title,subtitle,url,icon_type,icon_value,badge_text,style_role,row_order,is_enabled,start_at,end_at,created_at,updated_at) VALUES
('link_fanlynks_beta','page_demo',NULL,'Join the Creator Beta','Get early access to the creator-first link hub.','https://fanlynks.com/join','none',NULL,'Beta','primary',1,1,NULL,NULL,datetime('now'),datetime('now')),
('link_fanlynks_demo','page_demo',NULL,'See Why Creators Are Switching','A quick look at cleaner pages and higher-converting funnels.','https://fanlynks.com/demo','none',NULL,NULL,'secondary',2,1,NULL,NULL,datetime('now'),datetime('now')),
('link_fanlynks_analytics','page_demo',NULL,'Built-In Analytics Preview','See the first-party metrics built into every page.','https://fanlynks.com/analytics','none',NULL,NULL,'secondary',3,1,NULL,NULL,datetime('now'),datetime('now')),
('link_fanlynks_creators','page_demo',NULL,'For Influencers, Fanvue & Premium Creators','Designed for influencers, premium creators, and fan-led brands.','https://fanlynks.com/creators','none',NULL,NULL,'neutral',4,1,NULL,NULL,datetime('now'),datetime('now')),
('link_fanlynks_contact','page_demo',NULL,'Contact / Partner With Fan Lynks','Partnerships, launch questions, and creator support.','https://fanlynks.com/contact','none',NULL,NULL,'neutral',5,1,NULL,NULL,datetime('now'),datetime('now'));

UPDATE integrations
SET is_enabled = 0, config_json = '{}', updated_at = datetime('now')
WHERE page_id = 'page_demo'
  AND provider IN ('ga4','meta','gtm','cfwa');
