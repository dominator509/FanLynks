import { errorJson, json, readJson } from '../../../_utils';
import { parseSessionCookie } from '../../../../../src/server/auth/session';
import { buildPublishedPagePayloadById } from '../../../../../src/server/page/payload';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await parseSessionCookie(context.request, context.env.SESSION_SECRET);
  if (!session) return errorJson('Unauthorized.', 401);

  const pageId = context.params.pageId as string;
  const page = await buildPublishedPagePayloadById(context.env.DB, pageId);
  if (!page) return errorJson('Page not found.', 404);
  if (page.tenantId !== session.tenantId) return errorJson('Forbidden.', 403);

  const [sectionsRes, linksRes] = await Promise.all([
    context.env.DB.prepare(`
      SELECT id, label, section_order, is_enabled
      FROM page_sections
      WHERE page_id = ?
      ORDER BY section_order ASC
    `).bind(pageId).all<{ id: string; label: string; section_order: number; is_enabled: number }>(),
    context.env.DB.prepare(`
      SELECT id, section_id, title, subtitle, url, icon_type, icon_value, badge_text, style_role, row_order, is_enabled, start_at, end_at
      FROM page_links
      WHERE page_id = ?
      ORDER BY row_order ASC
    `).bind(pageId).all<{
      id: string; section_id: string | null; title: string; subtitle: string | null; url: string; icon_type: 'emoji'|'image'|'none'; icon_value: string | null;
      badge_text: string | null; style_role: 'primary'|'secondary'|'neutral'; row_order: number; is_enabled: number; start_at: string | null; end_at: string | null;
    }>()
  ]);

  return json({
    ok: true,
    page: {
      ...page.payload,
      sections: (sectionsRes.results ?? []).map((row) => ({ id: row.id, label: row.label, sectionOrder: row.section_order, isEnabled: Boolean(row.is_enabled) })),
      links: (linksRes.results ?? []).map((row) => ({
        id: row.id,
        sectionId: row.section_id,
        title: row.title,
        subtitle: row.subtitle,
        url: row.url,
        iconType: row.icon_type,
        iconValue: row.icon_value,
        badgeText: row.badge_text,
        styleRole: row.style_role,
        rowOrder: row.row_order,
        isEnabled: Boolean(row.is_enabled),
        startAt: row.start_at,
        endAt: row.end_at
      }))
    }
  });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const session = await parseSessionCookie(context.request, context.env.SESSION_SECRET);
  if (!session) return errorJson('Unauthorized.', 401);

  const pageId = context.params.pageId as string;
  const body = await readJson(context.request);
  if (!body || typeof body !== 'object') return errorJson('Invalid request body.', 400);

  const existing = await context.env.DB.prepare('SELECT tenant_id FROM pages WHERE id = ? LIMIT 1').bind(pageId).first<{ tenant_id: string }>();
  if (!existing) return errorJson('Page not found.', 404);
  if (existing.tenant_id !== session.tenantId) return errorJson('Forbidden.', 403);

  const title = typeof body.title === 'string' ? body.title.trim() : null;
  if (!title) return errorJson('Title is required.', 400);

  const themeTokens = body.themeTokens && typeof body.themeTokens === 'object' ? JSON.stringify(body.themeTokens) : null;
  const privacyUi = body.privacyUi && typeof body.privacyUi === 'object' ? JSON.stringify(body.privacyUi) : null;

  await context.env.DB.prepare(`
    UPDATE pages
    SET title = ?,
        subtitle = ?,
        avatar_url = ?,
        announcement_enabled = ?,
        announcement_text = ?,
        announcement_url = ?,
        hero_cta_label = ?,
        hero_cta_url = ?,
        tracking_mode = ?,
        privacy_mode = ?,
        page_theme_json = ?,
        page_privacy_json = ?,
        updated_at = ?
    WHERE id = ?
  `).bind(
    title,
    typeof body.subtitle === 'string' ? body.subtitle : null,
    typeof body.avatarUrl === 'string' ? body.avatarUrl : null,
    body.announcementEnabled ? 1 : 0,
    typeof body.announcementText === 'string' ? body.announcementText : null,
    typeof body.announcementUrl === 'string' ? body.announcementUrl : null,
    typeof body.heroCtaLabel === 'string' ? body.heroCtaLabel : null,
    typeof body.heroCtaUrl === 'string' ? body.heroCtaUrl : null,
    typeof body.trackingMode === 'string' ? body.trackingMode : 'none',
    typeof body.privacyMode === 'string' ? body.privacyMode : 'default_standard',
    themeTokens,
    privacyUi,
    new Date().toISOString(),
    pageId
  ).run();

  return json({ ok: true, saved: true });
};
