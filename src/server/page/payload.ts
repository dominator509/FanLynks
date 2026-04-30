import type { PublishedIntegration, PublishedLink, PublishedPagePayload, PublishedSection, PublishedVariant } from '../../shared/types/page';
import { makeId } from '../db/ids';

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
      tokens: safeParseJson(variant.tokens_json),
      contentOverrides: variant.content_overrides_json ? safeParseJson(variant.content_overrides_json) : null
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
    url: row.url,
    iconType: row.icon_type,
    iconValue: row.icon_value,
    badgeText: row.badge_text,
    styleRole: row.style_role,
    rowOrder: row.row_order
  }));

  const integrations: PublishedIntegration[] = (integrationsRes.results ?? []).map((row) => ({
    provider: row.provider,
    isEnabled: Boolean(row.is_enabled),
    config: safeParseJson(row.config_json)
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
        avatarUrl: page.avatar_url,
        announcementEnabled: Boolean(page.announcement_enabled),
        announcementText: page.announcement_text,
        announcementUrl: page.announcement_url,
        heroCtaLabel: page.hero_cta_label,
        heroCtaUrl: page.hero_cta_url,
        trackingMode: page.tracking_mode,
        privacyMode: page.privacy_mode,
        publishedVersion: page.published_version,
        themeTokens: safeParseJson(page.page_theme_json),
        privacyUi: safeParseJson(page.page_privacy_json)
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
}): Promise<void> {
  const assignedAt = new Date();
  const expiresAt = new Date(assignedAt.getTime() + args.ttlDays * 86400_000);

  await args.db
    .prepare(`
      INSERT INTO variant_assignments (
        id, experiment_id, page_id, visitor_key, variant_id, assigned_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      makeId('va'),
      args.experimentId,
      args.pageId,
      args.visitorKey,
      args.variantId,
      assignedAt.toISOString(),
      expiresAt.toISOString()
    )
    .run();
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
