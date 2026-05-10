import { errorJson, json, readJson } from '../../../../_utils';
import { validateAdminSession } from '../../../../../../src/server/auth/session';
import { makeId } from '../../../../../../src/server/db/ids';
import {
  normalizeIcon,
  normalizeIsoDate,
  normalizeOptionalText,
  normalizePublicUrl,
  normalizeStyleRole,
  normalizeText
} from '../../../../../../src/server/security/validation';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const session = await validateAdminSession({
    request: context.request,
    secret: context.env.SESSION_SECRET,
    db: context.env.DB
  });
  if (!session) return errorJson('Unauthorized.', 401);

  const pageId = context.params.pageId as string;
  const body = await readJson(context.request);
  if (!body || typeof body !== 'object') return errorJson('Invalid request body.', 400);

  const page = await context.env.DB.prepare('SELECT tenant_id FROM pages WHERE id = ? LIMIT 1').bind(pageId).first<{ tenant_id: string }>();
  if (!page) return errorJson('Page not found.', 404);
  if (page.tenant_id !== session.tenantId) return errorJson('Forbidden.', 403);

  const title = normalizeText(body.title, 120);
  let url: string;
  let icon: { iconType: 'emoji' | 'image' | 'none'; iconValue: string | null };
  try {
    url = normalizePublicUrl(body.url);
    icon = normalizeIcon({ iconType: body.iconType, iconValue: body.iconValue });
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : 'Invalid link payload.', 400);
  }

  if (!title) return errorJson('Title and URL are required.', 400);

  const orderRow = await context.env.DB.prepare('SELECT COALESCE(MAX(row_order), 0) AS max_row_order FROM page_links WHERE page_id = ?').bind(pageId).first<{ max_row_order: number }>();
  const rowOrder = Number.isFinite(Number(body.rowOrder)) ? Math.max(1, Math.floor(Number(body.rowOrder))) : (Number(orderRow?.max_row_order || 0) + 1);
  const now = new Date().toISOString();
  const id = makeId('link');

  await context.env.DB.prepare(`
    INSERT INTO page_links (
      id, page_id, section_id, title, subtitle, url, icon_type, icon_value, badge_text, style_role,
      row_order, is_enabled, start_at, end_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    pageId,
    typeof body.sectionId === 'string' ? body.sectionId : null,
    title,
    normalizeOptionalText(body.subtitle, 180),
    url,
    icon.iconType,
    icon.iconValue,
    normalizeOptionalText(body.badgeText, 48),
    normalizeStyleRole(body.styleRole),
    rowOrder,
    body.isEnabled === false ? 0 : 1,
    normalizeIsoDate(body.startAt),
    normalizeIsoDate(body.endAt),
    now,
    now
  ).run();

  return json({ ok: true, linkId: id });
};
