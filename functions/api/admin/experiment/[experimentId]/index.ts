import { errorJson, json, readJson } from '../../../_utils';
import { requireExperimentAccess } from '../_shared';
import { getExperimentById, updateExperiment, writeAuditLog, type ExperimentStatus, type VariantInput } from '../../../../../src/server/experiments/service';

interface UpdateExperimentBody {
  name?: string;
  assignmentTtlDays?: number;
  status?: ExperimentStatus;
  variants?: VariantInput[];
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const access = await requireExperimentAccess(context as EventContext<Env, string, unknown>);
  if (access instanceof Response) return access;

  const experiment = await getExperimentById(context.env.DB, access.experimentId);
  if (!experiment) return errorJson('Experiment not found.', 404);
  return json({ ok: true, experiment });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const access = await requireExperimentAccess(context as EventContext<Env, string, unknown>);
  if (access instanceof Response) return access;

  const body = (await readJson(context.request)) as UpdateExperimentBody | null;
  if (!body || typeof body !== 'object') return errorJson('Invalid request body.', 400);

  try {
    const experiment = await updateExperiment(context.env.DB, access.experimentId, {
      name: typeof body.name === 'string' ? body.name : undefined,
      assignmentTtlDays: typeof body.assignmentTtlDays === 'number' ? body.assignmentTtlDays : undefined,
      status: typeof body.status === 'string' ? body.status : undefined,
      variants: Array.isArray(body.variants) ? body.variants : undefined
    });

    await writeAuditLog({
      db: context.env.DB,
      tenantId: access.tenantId,
      userId: access.userId,
      action: 'experiment_updated',
      targetType: 'experiment',
      targetId: access.experimentId,
      diff: {
        name: experiment.name,
        status: experiment.status,
        variantCount: experiment.variants.length
      }
    });

    return json({ ok: true, experiment });
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : 'Unable to update experiment.', 400);
  }
};
