import { errorJson, json, readJson } from '../../../_utils';
import { requirePageAccess } from './analytics/_shared';
import { createExperiment, listExperiments, writeAuditLog, type VariantInput } from '../../../../../src/server/experiments/service';

interface CreateExperimentBody {
  name?: string;
  assignmentTtlDays?: number;
  variants?: VariantInput[];
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const access = await requirePageAccess(context as EventContext<Env, string, unknown>);
  if (access instanceof Response) return access;

  const experiments = await listExperiments(context.env.DB, access.pageId);
  return json({ ok: true, experiments });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const access = await requirePageAccess(context as EventContext<Env, string, unknown>);
  if (access instanceof Response) return access;

  const body = (await readJson(context.request)) as CreateExperimentBody | null;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return errorJson('Experiment name is required.', 400);

  try {
    const experiment = await createExperiment(context.env.DB, {
      pageId: access.pageId,
      name,
      assignmentTtlDays: Number(body?.assignmentTtlDays ?? 30),
      variants: Array.isArray(body?.variants) ? body!.variants : []
    });

    await writeAuditLog({
      db: context.env.DB,
      tenantId: access.tenantId,
      userId: access.userId,
      action: 'experiment_created',
      targetType: 'experiment',
      targetId: experiment.id,
      diff: { pageId: access.pageId, variantCount: experiment.variants.length }
    });

    return json({ ok: true, experiment }, 201);
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : 'Unable to create experiment.', 400);
  }
};
