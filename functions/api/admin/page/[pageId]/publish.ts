import { errorJson, json } from '../../../_utils';
import { validateAdminSession } from '../../../../../src/server/auth/session';
import { buildPublishedPagePayloadById } from '../../../../../src/server/page/payload';
import { refreshPublishedPageCache } from '../../../../../src/server/page/cache';
import { makeId } from '../../../../../src/server/db/ids';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const session = await validateAdminSession({
    request: context.request,
    secret: context.env.SESSION_SECRET,
    db: context.env.DB
  });
  if (!session) return errorJson('Unauthorized.', 401);

  const pageId = context.params.pageId as string;
  const built = await buildPublishedPagePayloadById(context.env.DB, pageId);
  if (!built) return errorJson('Page not found.', 404);
  if (built.tenantId !== session.tenantId) return errorJson('Forbidden.', 403);

  const nowIso = new Date().toISOString();
  const nextVersion = built.payload.page.publishedVersion + 1;

  await context.env.DB.batch([
    context.env.DB.prepare(`UPDATE pages SET published_version = ?, updated_at = ? WHERE id = ?`).bind(nextVersion, nowIso, pageId),
    context.env.DB.prepare(`
      INSERT INTO audit_log (id, tenant_id, user_id, action, target_type, target_id, diff_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      makeId('audit'),
      built.tenantId,
      session.userId,
      'admin_publish',
      'page',
      pageId,
      JSON.stringify({ publishedVersion: nextVersion }),
      nowIso
    )
  ]);

  const cacheState = await refreshPublishedPageCache({
    db: context.env.DB,
    cache: context.env.PAGE_CACHE,
    pageId,
    nowIso
  });

  return json({
    ok: true,
    published: true,
    pageId,
    slug: cacheState.slug,
    publishedVersion: cacheState.publishedVersion,
    cacheRefreshed: true
  });
};
