import { json } from '../../../../_utils';
import { requirePageAccess } from './_shared';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const access = await requirePageAccess(context as EventContext<Env, string, unknown>);
  if (access instanceof Response) return access;

  const since = new URL(context.request.url).searchParams.get('since') ?? new Date(Date.now() - 30 * 86400_000).toISOString();

  const rows = await context.env.DB.prepare(`
    WITH event_stats AS (
      SELECT
        e.variant_id,
        COALESCE(v.name, '(unknown)') AS variant_name,
        SUM(CASE WHEN e.event_name = 'page_view' THEN 1 ELSE 0 END) AS page_views,
        SUM(CASE WHEN e.event_name IN ('link_click','hero_cta_click','social_click','announcement_click') THEN 1 ELSE 0 END) AS clicks
      FROM events e
      LEFT JOIN experiment_variants v ON v.id = e.variant_id
      WHERE e.page_id = ?
        AND e.variant_id IS NOT NULL
        AND e.occurred_at >= ?
      GROUP BY e.variant_id, variant_name
    ),
    spend_stats AS (
      SELECT variant_id, SUM(amount) AS spend
      FROM ad_spend_entries
      WHERE page_id = ?
        AND date(spend_date) >= date(?)
        AND variant_id IS NOT NULL
      GROUP BY variant_id
    )
    SELECT e.variant_id, e.variant_name, e.page_views, e.clicks, COALESCE(s.spend, 0) AS spend
    FROM event_stats e
    LEFT JOIN spend_stats s ON s.variant_id = e.variant_id
    ORDER BY e.clicks DESC, e.page_views DESC
  `).bind(access.pageId, since, access.pageId, since).all<{ variant_id: string; variant_name: string | null; page_views: number; clicks: number; spend: number }>();

  const variants = (rows.results ?? []).map((row) => ({
    variantId: row.variant_id,
    variantName: row.variant_name ?? '(unknown)',
    pageViews: Number(row.page_views ?? 0),
    clicks: Number(row.clicks ?? 0),
    ctr: Number(row.page_views ?? 0) > 0 ? Number(row.clicks ?? 0) / Number(row.page_views ?? 0) : 0,
    spend: Number(row.spend ?? 0),
    cpcProxy: Number(row.clicks ?? 0) > 0 ? Number(row.spend ?? 0) / Number(row.clicks ?? 0) : 0
  }));

  return json({ ok: true, since, variants });
};
