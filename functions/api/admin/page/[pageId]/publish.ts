import { errorJson, json } from '../../../_utils';
import { publishedPageKey, variantManifestKey } from '../../../../../src/server/cache/keys';
import { parseSessionCookie } from '../../../../../src/server/auth/session';
import { buildPublishedPagePayloadById } from '../../../../../src/server/page/payload';
import { makeId } from '../../../../../src/server/db/ids';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const session = await parseSessionCookie(context.request, context.env.SESSION_SECRET);
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

  const refreshed = await buildPublishedPagePayloadById(context.env.DB, pageId, nowIso);
  if (!refreshed) return errorJson('Unable to rebuild page snapshot.', 500);

  const pageSnapshot = {
    payload: refreshed.payload,
    pageId: refreshed.pageId,
    tenantId: refreshed.tenantId
  };

  await context.env.PAGE_CACHE.put(publishedPageKey(refreshed.payload.page.slug), JSON.stringify(pageSnapshot));

  if (refreshed.payload.experiment) {
    await context.env.PAGE_CACHE.put(
      variantManifestKey(pageId),
      JSON.stringify({
        experimentId: refreshed.payload.experiment.id,
        variants: refreshed.payload.experiment.variants.map((variant) => ({
          variantId: variant.variantId,
          variantName: variant.variantName
        })),
        generatedAt: nowIso
      })
    );
  }

  return json({
    ok: true,
    published: true,
    pageId,
    slug: refreshed.payload.page.slug,
    publishedVersion: refreshed.payload.page.publishedVersion
  });
};
