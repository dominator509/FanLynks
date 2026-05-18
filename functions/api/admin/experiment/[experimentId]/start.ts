import { errorJson, json } from '../../../_utils';
import { requireExperimentAccess } from '../_shared';
import { startExperiment, writeAuditLog } from '../../../../../src/server/experiments/service';
import { refreshPublishedPageCache } from '../../../../../src/server/page/cache';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const access = await requireExperimentAccess(context as EventContext<Env, string, unknown>);
  if (access instanceof Response) return access;

  try {
    const experiment = await startExperiment(context.env.DB, access.experimentId);
    await writeAuditLog({
      db: context.env.DB,
      tenantId: access.tenantId,
      userId: access.userId,
      action: 'experiment_started',
      targetType: 'experiment',
      targetId: access.experimentId,
      diff: { status: experiment.status }
    });
    const cacheState = await refreshPublishedPageCache({
      db: context.env.DB,
      cache: context.env.PAGE_CACHE,
      pageId: access.pageId
    });
    return json({ ok: true, experiment, cacheRefreshed: true, slug: cacheState.slug });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start experiment.';
    return errorJson(message, message === 'Published cache refresh failed.' ? 500 : 400);
  }
};
