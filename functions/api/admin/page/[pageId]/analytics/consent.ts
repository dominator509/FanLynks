import { json } from '../../../../_utils';
import { requirePageAccess } from './_shared';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const access = await requirePageAccess(context as EventContext<Env, string, unknown>);
  if (access instanceof Response) return access;

  const since = new URL(context.request.url).searchParams.get('since') ?? new Date(Date.now() - 30 * 86400_000).toISOString();

  const rows = await context.env.DB.prepare(`
    SELECT
      region_policy,
      COUNT(*) AS records,
      SUM(CASE WHEN analytics_state = 'granted' THEN 1 ELSE 0 END) AS analytics_granted,
      SUM(CASE WHEN ads_state = 'granted' THEN 1 ELSE 0 END) AS ads_granted,
      SUM(CASE WHEN gpc_detected = 1 THEN 1 ELSE 0 END) AS gpc_count
    FROM consent_records
    WHERE page_id = ?
      AND recorded_at >= ?
    GROUP BY region_policy
    ORDER BY records DESC, region_policy ASC
  `).bind(access.pageId, since).all<{ region_policy: string; records: number; analytics_granted: number; ads_granted: number; gpc_count: number }>();

  const consent = (rows.results ?? []).map((row) => ({
    regionPolicy: row.region_policy,
    records: Number(row.records ?? 0),
    analyticsGranted: Number(row.analytics_granted ?? 0),
    adsGranted: Number(row.ads_granted ?? 0),
    gpcCount: Number(row.gpc_count ?? 0),
    analyticsAcceptanceRate: Number(row.records ?? 0) > 0 ? Number(row.analytics_granted ?? 0) / Number(row.records ?? 0) : 0,
    adsAcceptanceRate: Number(row.records ?? 0) > 0 ? Number(row.ads_granted ?? 0) / Number(row.records ?? 0) : 0
  }));

  return json({ ok: true, since, consent });
};
