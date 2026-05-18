import type { PublishedIntegration, PublishedLink, PublishedPagePayload, PublishedSection, PublishedVariant } from '../../shared/types/page';
import { normalizeOptionalPublicUrl, normalizeOptionalText, sanitizePrivacyUi, sanitizeThemeTokens } from '../security/validation';

interface PageRow {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  avatar_url: string | null;
  announcement_enabled: number;
  announcement_text: string | null;
  announcement_url: string | null;
  hero_cta_label: string | null;
  hero_cta_url: string | null;
  tracking_mode: string;
  privacy_mode: string;
  published_version: number;
  page_theme_json: string | null;
  page_privacy_json: string | null;
}

interface SectionRow {
  id: string;
  label: string;
  section_order: number;
}

interface LinkRow {
  id: string;
  section_id: string | null;
  title: string;
  subtitle: string | null;
  url: string;
  icon_type: 'emoji' | 'image' | 'none';
  icon_value: string | null;
  badge_text: string | null;
  style_role: 'primary' | 'secondary' | 'neutral';
  row_order: number;
}

interface IntegrationRow {
  provider: 'ga4' | 'meta' | 'gtm' | 'cfwa';
  is_enabled: number;
  config_json: string;
}

interface ExperimentRow {
  id: string;
  assignment_ttl_days: number;
}

interface VariantRow {
  id: string;
  name: string;
  weight: number;
  tokens_json: string;
  content_overrides_json: string | null;
}

export interface BuiltPageData {
  payload: PublishedPagePayload;
  pageId: string;
  tenantId: string;
}

export async function buildPublishedPagePayloadFromSlug(db: D1Database, slug: string, nowIso = new Date().toISOString()): Promise<BuiltPageData | null> {
  const page = await db
    .prepare(`
      SELECT
        id,
        tenant_id,
        slug,
        title,
        subtitle,
        avatar_url,
        announcement_enabled,
        announcement_text,
        announcement_url,
        hero_cta_label,
        hero_cta_url,
        tracking_mode,
        privacy_mode,
        published_version,
        page_theme_json,
        page_privacy_json
      FROM pages
      WHERE slug = ? AND is_active = 1
      LIMIT 1
    `)
    .bind(slug)
    .first<PageRow>();

  if (!page) return null;

  return buildPublishedPagePayload(db, page, nowIso);
}

export async function buildPublishedPagePayloadById(db: D1Database, pageId: string, nowIso = new Date().toISOString()): Promise<BuiltPageData | null> {
  const page = await db
    .prepare(`
      SELECT
        id,
        tenant_id,
        slug,
        title,
        subtitle,
        avatar_url,
        announcement_enabled,
        announcement_text,
        announcement_url,
        hero_cta_label,
        hero_cta_url,
        tracking_mode,
        privacy_mode,
        published_version,
        page_theme_json,
        page_privacy_json
      FROM pages
      WHERE id = ? AND is_active = 1
      LIMIT 1
    `)
    .bind(pageId)
    .first<PageRow>();

  if (!page) return null;

  return buildPublishedPagePayload(db, page, nowIso);
}

async function buildPublishedPagePayload(db: D1Database, page: PageRow, nowIso: string): Promise<BuiltPageData> {
  const [sectionsRes, linksRes, integrationsRes, experiment, variantsRes] = await Promise.all([
    db.prepare(`
      SELECT id, label, section_order
      FROM page_sections
      WHERE page_id = ? AND is_enabled = 1
      ORDER BY section_order ASC
    `).bind(page.id).all<SectionRow>(),
    db.prepare(`
      SELECT id, section_id, title, subtitle, url, icon_type, icon_value, badge_text, style_role, row_order
      FROM page_links
      WHERE page_id = ?
        AND is_enabled = 1
        AND (start_at IS NULL OR start_at <= ?)
        AND (end_at IS NULL OR end_at >= ?)
      ORDER BY row_order ASC
    `).bind(page.id, nowIso, nowIso).all<LinkRow>(),
    db.prepare(`
      SELECT provider, is_enabled, config_json
      FROM integrations
      WHERE page_id = ? AND is_enabled = 1
    `).bind(page.id).all<IntegrationRow>(),
    db.prepare(`
      SELECT id, assignment_ttl_days
      FROM experiments
      WHERE page_id = ? AND status = 'live'
      ORDER BY started_at DESC, created_at DESC
      LIMIT 1
    `).bind(page.id).first<ExperimentRow>(),
    Promise.resolve(null)
  ]);

  let variants: PublishedVariant[] = [];
  if (experiment?.id) {
    const dbVariants = await db.prepare(`
      SELECT id, name, weight, tokens_json, content_overrides_json
      FROM experiment_variants
      WHERE experiment_id = ? AND is_enabled = 1
      ORDER BY created_at ASC
    `).bind(experiment.id).all<VariantRow>();

    variants = (dbVariants.results ?? []).map((variant) => ({
      experimentId: experiment.id,
      variantId: variant.id,
      variantName: variant.name,
      weight: variant.weight,
      tokens: sanitizeThemeTokens(safeParseJson(variant.tokens_json)),
      contentOverrides: variant.content_overrides_json ? sanitizeContentOverrides(safeParseJson(variant.content_overrides_json)) : null
    }));
  }

  const sections: PublishedSection[] = (sectionsRes.results ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    sectionOrder: row.section_order
  }));

  const links: PublishedLink[] = (linksRes.results ?? []).map((row) => ({
    id: row.id,
    sectionId: row.section_id,
    title: row.title,
    subtitle: row.subtitle,
    url: normalizeOptionalPublicUrl(row.url) ?? '',
    iconType: row.icon_type,
    iconValue: row.icon_type === 'image' ? normalizeOptionalPublicUrl(row.icon_value) : row.icon_value,
    badgeText: row.badge_text,
    styleRole: row.style_role,
    rowOrder: row.row_order
  })).filter((link) => link.url);

  const integrations: PublishedIntegration[] = (integrationsRes.results ?? []).map((row) => ({
    provider: row.provider,
    isEnabled: Boolean(row.is_enabled),
    config: sanitizeIntegrationConfig(row.provider, safeParseJson(row.config_json))
  }));

  return {
    pageId: page.id,
    tenantId: page.tenant_id,
    payload: {
      page: {
        id: page.id,
        tenantId: page.tenant_id,
        slug: page.slug,
        title: page.title,
        subtitle: page.subtitle,
        avatarUrl: normalizeOptionalPublicUrl(page.avatar_url),
        announcementEnabled: Boolean(page.announcement_enabled),
        announcementText: page.announcement_text,
        announcementUrl: normalizeOptionalPublicUrl(page.announcement_url),
        heroCtaLabel: page.hero_cta_label,
        heroCtaUrl: normalizeOptionalPublicUrl(page.hero_cta_url),
        trackingMode: page.tracking_mode,
        privacyMode: page.privacy_mode,
        publishedVersion: page.published_version,
        themeTokens: sanitizeThemeTokens(safeParseJson(page.page_theme_json)),
        privacyUi: sanitizePrivacyUi(safeParseJson(page.page_privacy_json))
      },
      sections,
      links,
      integrations,
      experiment: experiment
        ? {
            id: experiment.id,
            assignmentTtlDays: experiment.assignment_ttl_days,
            variants
          }
        : null,
      generatedAt: nowIso
    }
  };
}

export async function upsertExperimentAssignment(args: {
  db: D1Database;
  pageId: string;
  experimentId: string;
  visitorKey: string;
  variantId: string;
  ttlDays: number;
}): Promise<{ variantId: string }> {
  const assignedAt = new Date();
  const expiresAt = new Date(assignedAt.getTime() + args.ttlDays * 86400_000);
  const assignedAtIso = assignedAt.toISOString();
  const expiresAtIso = expiresAt.toISOString();
  const assignmentId = await stableAssignmentId(args.pageId, args.experimentId, args.visitorKey);

  await args.db
    .prepare(`
      INSERT INTO variant_assignments (
        id, experiment_id, page_id, visitor_key, variant_id, assigned_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        variant_id = excluded.variant_id,
        assigned_at = excluded.assigned_at,
        expires_at = excluded.expires_at
      WHERE variant_assignments.expires_at <= ?
    `)
    .bind(
      assignmentId,
      args.experimentId,
      args.pageId,
      args.visitorKey,
      args.variantId,
      assignedAtIso,
      expiresAtIso,
      assignedAtIso
    )
    .run();

  const persisted = await args.db
    .prepare(`
      SELECT variant_id
      FROM variant_assignments
      WHERE id = ? AND expires_at > ?
      LIMIT 1
    `)
    .bind(assignmentId, assignedAtIso)
    .first<{ variant_id: string }>();

  return { variantId: persisted?.variant_id ?? args.variantId };
}

export async function getActiveAssignment(args: {
  db: D1Database;
  pageId: string;
  experimentId: string;
  visitorKey: string;
  nowIso?: string;
}): Promise<{ variantId: string } | null> {
  const row = await args.db
    .prepare(`
      SELECT variant_id
      FROM variant_assignments
      WHERE page_id = ? AND experiment_id = ? AND visitor_key = ? AND expires_at > ?
      ORDER BY assigned_at DESC
      LIMIT 1
    `)
    .bind(args.pageId, args.experimentId, args.visitorKey, args.nowIso ?? new Date().toISOString())
    .first<{ variant_id: string }>();

  return row ? { variantId: row.variant_id } : null;
}

function safeParseJson(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function stableAssignmentId(pageId: string, experimentId: string, visitorKey: string): Promise<string> {
  const source = `${pageId}:${experimentId}:${visitorKey}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  const bytes = new Uint8Array(digest);
  const hex = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `va_${hex.slice(0, 48)}`;
}

function sanitizeContentOverrides(input: Record<string, unknown>): Record<string, unknown> | null {
  const output: Record<string, unknown> = {};

  if (input.page && typeof input.page === 'object' && !Array.isArray(input.page)) {
    const page = input.page as Record<string, unknown>;
    const sanitizedPage: Record<string, unknown> = {};
    const title = normalizeOptionalText(page.title, 120);
    const subtitle = normalizeOptionalText(page.subtitle, 240);
    const avatarUrl = normalizeOptionalPublicUrl(page.avatarUrl);
    const announcementText = normalizeOptionalText(page.announcementText, 120);
    const announcementUrl = normalizeOptionalPublicUrl(page.announcementUrl);
    const heroCtaLabel = normalizeOptionalText(page.heroCtaLabel, 60);
    const heroCtaUrl = normalizeOptionalPublicUrl(page.heroCtaUrl);

    if (title) sanitizedPage.title = title;
    if (subtitle) sanitizedPage.subtitle = subtitle;
    if (avatarUrl) sanitizedPage.avatarUrl = avatarUrl;
    if (announcementText) sanitizedPage.announcementText = announcementText;
    if (announcementUrl) sanitizedPage.announcementUrl = announcementUrl;
    if (heroCtaLabel) sanitizedPage.heroCtaLabel = heroCtaLabel;
    if (heroCtaUrl) sanitizedPage.heroCtaUrl = heroCtaUrl;
    if (Object.keys(sanitizedPage).length) output.page = sanitizedPage;
  }

  if (input.links && typeof input.links === 'object' && !Array.isArray(input.links)) {
    const links: Record<string, unknown> = {};
    for (const [linkId, rawLink] of Object.entries(input.links as Record<string, unknown>)) {
      if (!/^[a-zA-Z0-9_-]{1,120}$/.test(linkId) || !rawLink || typeof rawLink !== 'object' || Array.isArray(rawLink)) continue;
      const link = rawLink as Record<string, unknown>;
      const sanitizedLink: Record<string, unknown> = {};
      const title = normalizeOptionalText(link.title, 120);
      const subtitle = normalizeOptionalText(link.subtitle, 180);
      const url = normalizeOptionalPublicUrl(link.url);
      const badgeText = normalizeOptionalText(link.badgeText, 48);
      if (title) sanitizedLink.title = title;
      if (subtitle) sanitizedLink.subtitle = subtitle;
      if (url) sanitizedLink.url = url;
      if (badgeText) sanitizedLink.badgeText = badgeText;
      if (Object.keys(sanitizedLink).length) links[linkId] = sanitizedLink;
    }
    if (Object.keys(links).length) output.links = links;
  }

  if (Array.isArray(input.linkOrder)) {
    const linkOrder = input.linkOrder.filter((value): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value)).slice(0, 100);
    if (linkOrder.length) output.linkOrder = linkOrder;
  }

  return Object.keys(output).length ? output : null;
}

function sanitizeIntegrationConfig(provider: IntegrationRow['provider'], input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  if (provider === 'ga4') {
    if (typeof input.measurementId === 'string' && /^G-[A-Z0-9]{6,20}$/.test(input.measurementId.trim())) {
      output.measurementId = input.measurementId.trim();
    }
    output.enablePageViews = (input.enablePageViews ?? input.trackPageViews) !== false;
    output.enableClickEvents = (input.enableClickEvents ?? input.trackClickEvents) !== false;
    output.enableExperimentParameters = (input.enableExperimentParameters ?? input.includeExperimentParams) !== false;
  }

  if (provider === 'meta') {
    if (typeof input.pixelId === 'string' && /^\d{6,32}$/.test(input.pixelId.trim())) output.pixelId = input.pixelId.trim();
    if (input.eventMappings && typeof input.eventMappings === 'object' && !Array.isArray(input.eventMappings)) {
      const eventMappings: Record<string, string> = {};
      for (const [eventName, mappedName] of Object.entries(input.eventMappings as Record<string, unknown>)) {
        if (/^[a-z0-9_]{1,40}$/.test(eventName) && typeof mappedName === 'string' && /^[A-Za-z0-9_]{1,60}$/.test(mappedName.trim())) {
          eventMappings[eventName] = mappedName.trim();
        }
      }
      output.eventMappings = eventMappings;
    }
  }

  if (provider === 'gtm') {
    if (typeof input.containerId === 'string' && /^GTM-[A-Z0-9]{4,16}$/.test(input.containerId.trim())) output.containerId = input.containerId.trim();
    output.advertisingEnabled = Boolean(input.advertisingEnabled);
  }

  if (provider === 'cfwa') {
    output.enabled = input.enabled !== false;
    output.overlayOnly = input.overlayOnly !== false;
  }

  return output;
}
