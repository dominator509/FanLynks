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
  const orderedLinkIds = Array.isArray(body?.orderedLinkIds) ? body.orderedLinkIds.filter((v: unknown) => typeof v === 'string') : [];
  if (!orderedLinkIds.length) return errorJson('orderedLinkIds is required.', 400);

  const now = new Date().toISOString();
  for (let index = 0; index < orderedLinkIds.length; index += 1) {
    await context.env.DB.prepare(`
      UPDATE page_links
      SET row_order = ?, updated_at = ?
      WHERE id = ? AND page_id = ?
    `).bind(index + 1, now, orderedLinkIds[index], pageId).run();
  }

  return json({ ok: true, reordered: orderedLinkIds.length });
};
