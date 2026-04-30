import { json } from '../../../../_utils';
import { requirePageAccess } from './_shared';

interface ExperimentRow { id: string; name: string; status: string; }
interface VariantStatsRow {
  variant_id: string;
  variant_name: string;
  page_views: number;
  clicks: number;
  spend: number;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const access = await requirePageAccess(context as EventContext<Env, string, unknown>);
  if (access instanceof Response) return access;

  const since = new URL(context.request.url).searchParams.get('since') ?? new Date(Date.now() - 30 * 86400_000).toISOString();

  const experiment = await context.env.DB.prepare(`
    SELECT id, name, status
    FROM experiments
    WHERE page_id = ? AND status IN ('live','paused','winner')
    ORDER BY CASE status WHEN 'live' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, updated_at DESC
    LIMIT 1
  `).bind(access.pageId).first<ExperimentRow>();

  if (!experiment) return json({ ok: true, since, recommendation: null });

  const statsRes = await context.env.DB.prepare(`
    WITH event_stats AS (
      SELECT
        ev.id AS variant_id,
        ev.name AS variant_name,
        SUM(CASE WHEN e.event_name = 'page_view' THEN 1 ELSE 0 END) AS page_views,
        SUM(CASE WHEN e.event_name IN ('link_click','hero_cta_click','social_click','announcement_click') THEN 1 ELSE 0 END) AS clicks
      FROM experiment_variants ev
      LEFT JOIN events e
        ON e.variant_id = ev.id
       AND e.page_id = ?
       AND e.occurred_at >= ?
      WHERE ev.experiment_id = ?
        AND ev.is_enabled = 1
      GROUP BY ev.id, ev.name
    ),
    spend_stats AS (
      SELECT variant_id, SUM(amount) AS spend
      FROM ad_spend_entries
      WHERE page_id = ?
        AND date(spend_date) >= date(?)
        AND variant_id IS NOT NULL
      GROUP BY variant_id
    )
    SELECT
      e.variant_id,
      e.variant_name,
      COALESCE(e.page_views, 0) AS page_views,
      COALESCE(e.clicks, 0) AS clicks,
      COALESCE(s.spend, 0) AS spend
    FROM event_stats e
    LEFT JOIN spend_stats s ON s.variant_id = e.variant_id
    ORDER BY clicks DESC, page_views DESC, variant_name ASC
  `).bind(access.pageId, since, experiment.id, access.pageId, since).all<VariantStatsRow>();

  const variants = (statsRes.results ?? []).map((row) => ({
    variantId: row.variant_id,
    variantName: row.variant_name,
    pageViews: Number(row.page_views ?? 0),
    clicks: Number(row.clicks ?? 0),
    ctr: Number(row.page_views ?? 0) > 0 ? Number(row.clicks ?? 0) / Number(row.page_views ?? 0) : 0,
    spend: Number(row.spend ?? 0),
    cpcProxy: Number(row.clicks ?? 0) > 0 ? Number(row.spend ?? 0) / Number(row.clicks ?? 0) : 0
  })).sort((a, b) => (b.ctr - a.ctr) || (b.clicks - a.clicks) || (b.pageViews - a.pageViews) || a.variantName.localeCompare(b.variantName));

  const recommendation = buildRecommendation(experiment, variants);
  return json({ ok: true, since, recommendation });
};

function buildRecommendation(experiment: ExperimentRow, variants: Array<{ variantId: string; variantName: string; pageViews: number; clicks: number; ctr: number; spend: number; cpcProxy: number; }>) {
  if (!variants.length) {
    return {
      experimentId: experiment.id,
      experimentName: experiment.name,
      confidence: 'observe',
      reason: 'no_data',
      summary: 'No variant traffic has been recorded in the selected window yet.',
      recommendedVariantId: null,
      recommendedVariantName: null,
      variants
    };
  }

  const best = variants[0];
  const runner = variants[1] || null;
  let confidence: 'observe' | 'medium' | 'high' = 'observe';
  let reason = 'low_sample';
  let recommendedVariantId: string | null = null;
  let recommendedVariantName: string | null = null;
  let summary = `${best.variantName} currently leads on CTR.`;

  if (!runner) {
    if (best.pageViews >= 75 && best.clicks >= 12) {
      confidence = 'medium';
      reason = 'single_variant_only';
      recommendedVariantId = best.variantId;
      recommendedVariantName = best.variantName;
      summary = `${best.variantName} is the only active measured variant and has enough traffic to consider promoting.`;
    } else {
      summary = `${best.variantName} is the only measured variant, but there is not enough sample yet to call a winner.`;
    }
  } else {
    const ctrLift = runner.ctr > 0 ? (best.ctr - runner.ctr) / runner.ctr : (best.ctr > 0 ? 1 : 0);
    const clickLead = best.clicks - runner.clicks;
    const bothHaveSample = best.pageViews >= 50 && runner.pageViews >= 50 && best.clicks >= 10 && runner.clicks >= 10;
    const cpcAdvantage = (!best.spend && !runner.spend) || best.cpcProxy <= (runner.cpcProxy || Number.POSITIVE_INFINITY) * 1.15;

    if (bothHaveSample && ctrLift >= 0.2 && clickLead >= 5 && cpcAdvantage) {
      confidence = 'high';
      reason = 'clear_ctr_lead';
      recommendedVariantId = best.variantId;
      recommendedVariantName = best.variantName;
    } else if (bothHaveSample && ctrLift >= 0.1 && cpcAdvantage) {
      confidence = 'medium';
      reason = 'moderate_ctr_lead';
      recommendedVariantId = best.variantId;
      recommendedVariantName = best.variantName;
    } else if (bothHaveSample && ctrLift >= 0.15 && !cpcAdvantage) {
      confidence = 'observe';
      reason = 'ctr_up_cpc_weaker';
    } else {
      confidence = 'observe';
      reason = bothHaveSample ? 'too_close_to_call' : 'low_sample';
    }

    summary = `${best.variantName} vs ${runner.variantName}: ${(best.ctr * 100).toFixed(1)}% CTR vs ${(runner.ctr * 100).toFixed(1)}% CTR.`;
    if (recommendedVariantId) {
      summary += ` Recommended winner because the lead is large enough and cost efficiency is not worse.`;
    } else if (reason === 'ctr_up_cpc_weaker') {
      summary += ` CTR is better, but cost per click is weaker, so keep the test running.`;
    } else {
      summary += ` Keep the test running for more signal.`;
    }
  }

  return {
    experimentId: experiment.id,
    experimentName: experiment.name,
    confidence,
    reason,
    summary,
    recommendedVariantId,
    recommendedVariantName,
    variants
  };
}
