import { json } from '../../../../_utils';
import { requirePageAccess } from './_shared';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const access = await requirePageAccess(context as EventContext<Env, string, unknown>);
  if (access instanceof Response) return access;

  const since = new URL(context.request.url).searchParams.get('since') ?? new Date(Date.now() - 30 * 86400_000).toISOString();

  const rows = await context.env.DB.prepare(`
    SELECT
      COALESCE(NULLIF(json_extract(e.event_payload_json, '$.utm_source'), ''), '(direct)') AS source,
      COALESCE(NULLIF(json_extract(e.event_payload_json, '$.utm_medium'), ''), '(none)') AS medium,
      e.variant_id,
      COALESCE(v.name, '(unassigned)') AS variant_name,
      SUM(CASE WHEN e.event_name = 'page_view' THEN 1 ELSE 0 END) AS page_views,
      SUM(CASE WHEN e.event_name IN ('link_click','hero_cta_click','social_click','announcement_click') THEN 1 ELSE 0 END) AS clicks
    FROM events e
    LEFT JOIN experiment_variants v ON v.id = e.variant_id
    WHERE e.page_id = ?
      AND e.occurred_at >= ?
    GROUP BY source, medium, e.variant_id, variant_name
    HAVING page_views > 0 OR clicks > 0
    ORDER BY clicks DESC, page_views DESC, source ASC, variant_name ASC
  `).bind(access.pageId, since).all<{ source: string; medium: string; variant_id: string | null; variant_name: string; page_views: number; clicks: number }>();

  const matrix = (rows.results ?? []).map((row) => ({
    source: row.source,
    medium: row.medium,
    variantId: row.variant_id,
    variantName: row.variant_name,
    pageViews: Number(row.page_views ?? 0),
    clicks: Number(row.clicks ?? 0),
    ctr: Number(row.page_views ?? 0) > 0 ? Number(row.clicks ?? 0) / Number(row.page_views ?? 0) : 0
  }));

  return json({ ok: true, since, matrix });
};
