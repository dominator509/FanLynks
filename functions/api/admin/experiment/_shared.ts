import { errorJson } from '../../_utils';
import { validateAdminSession } from '../../../../src/server/auth/session';

export async function requireExperimentAccess(context: EventContext<Env, string, unknown>): Promise<{
  experimentId: string;
  pageId: string;
  tenantId: string;
  userId: string;
} | Response> {
  const session = await validateAdminSession({
    request: context.request,
    secret: context.env.SESSION_SECRET,
    db: context.env.DB
  });
  if (!session) return errorJson('Unauthorized.', 401);

  const experimentId = context.params.experimentId as string;
  const row = await context.env.DB.prepare(`
    SELECT e.page_id, p.tenant_id
    FROM experiments e
    JOIN pages p ON p.id = e.page_id
    WHERE e.id = ?
    LIMIT 1
  `).bind(experimentId).first<{ page_id: string; tenant_id: string }>();

  if (!row) return errorJson('Experiment not found.', 404);
  if (row.tenant_id !== session.tenantId) return errorJson('Forbidden.', 403);

  return {
    experimentId,
    pageId: row.page_id,
    tenantId: row.tenant_id,
    userId: session.userId
  };
}
