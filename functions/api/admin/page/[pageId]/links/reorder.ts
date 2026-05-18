import { errorJson, json, readJson } from '../../../../_utils';
import { validateAdminSession } from '../../../../../../src/server/auth/session';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const session = await validateAdminSession({
    request: context.request,
    secret: context.env.SESSION_SECRET,
    db: context.env.DB
  });
  if (!session) return errorJson('Unauthorized.', 401);

  const pageId = context.params.pageId as string;
  const page = await context.env.DB.prepare('SELECT tenant_id FROM pages WHERE id = ? LIMIT 1').bind(pageId).first<{ tenant_id: string }>();
  if (!page) return errorJson('Page not found.', 404);
  if (page.tenant_id !== session.tenantId) return errorJson('Forbidden.', 403);

  const body = await readJson(context.request);
  const orderedLinkIds: string[] = Array.isArray(body?.orderedLinkIds)
    ? body.orderedLinkIds.filter((v: unknown): v is string => typeof v === 'string')
    : [];
  if (!orderedLinkIds.length) return errorJson('orderedLinkIds is required.', 400);
  const uniqueOrderedIds = new Set(orderedLinkIds);
  if (uniqueOrderedIds.size !== orderedLinkIds.length) return errorJson('orderedLinkIds must be unique.', 400);

  const existing = await context.env.DB.prepare(`
    SELECT id
    FROM page_links
    WHERE page_id = ?
  `).bind(pageId).all<{ id: string }>();
  const existingIds = new Set((existing.results ?? []).map((row) => row.id));
  if (existingIds.size !== orderedLinkIds.length || orderedLinkIds.some((id) => !existingIds.has(id))) {
    return errorJson('orderedLinkIds must include every link on the page exactly once.', 400);
  }

  const now = new Date().toISOString();
  await context.env.DB.batch(orderedLinkIds.map((linkId, index) => (
    context.env.DB.prepare(`
      UPDATE page_links
      SET row_order = ?, updated_at = ?
      WHERE id = ? AND page_id = ?
    `).bind(index + 1, now, linkId, pageId)
  )));

  return json({ ok: true, reordered: orderedLinkIds.length });
};
