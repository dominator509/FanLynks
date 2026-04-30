import { errorJson, json, readJson } from '../../../_utils';
import { requireExperimentAccess } from '../_shared';
import { chooseWinner, writeAuditLog } from '../../../../../src/server/experiments/service';

interface WinnerBody {
  winnerVariantId?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const access = await requireExperimentAccess(context as EventContext<Env, string, unknown>);
  if (access instanceof Response) return access;

  const body = (await readJson(context.request)) as WinnerBody | null;
  const winnerVariantId = typeof body?.winnerVariantId === 'string' ? body.winnerVariantId : '';
  if (!winnerVariantId) return errorJson('winnerVariantId is required.', 400);

  try {
    const experiment = await chooseWinner(context.env.DB, access.experimentId, winnerVariantId);
    await writeAuditLog({
      db: context.env.DB,
      tenantId: access.tenantId,
      userId: access.userId,
      action: 'experiment_winner_selected',
      targetType: 'experiment',
      targetId: access.experimentId,
      diff: { winnerVariantId }
    });
    return json({ ok: true, experiment });
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : 'Unable to choose winner.', 400);
  }
};
