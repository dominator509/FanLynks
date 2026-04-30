import { errorJson } from '../../../../_utils';
import { parseSessionCookie } from '../../../../../../src/server/auth/session';

export async function requirePageAccess(context: EventContext<Env, string, unknown>): Promise<{ pageId: string; tenantId: string; userId: string } | Response> {
  const session = await parseSessionCookie(context.request, context.env.SESSION_SECRET);
  if (!session) return errorJson('Unauthorized.', 401);

  const pageId = context.params.pageId as string;
  const page = await context.env.DB.prepare(`
    SELECT tenant_id
    FROM pages
    WHERE id = ?
    LIMIT 1
  `)
    .bind(pageId)
    .first<{ tenant_id: string }>();

  if (!page) return errorJson('Page not found.', 404);
  if (page.tenant_id !== session.tenantId) return errorJson('Forbidden.', 403);

  return {
    pageId,
    tenantId: page.tenant_id,
    userId: session.userId
  };
}
