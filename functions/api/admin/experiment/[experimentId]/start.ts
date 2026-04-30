import { errorJson, json } from '../../../_utils';
import { requireExperimentAccess } from '../_shared';
import { startExperiment, writeAuditLog } from '../../../../../src/server/experiments/service';

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
    return json({ ok: true, experiment });
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : 'Unable to start experiment.', 400);
  }
};
