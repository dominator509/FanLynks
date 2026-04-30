import { json } from '../../../../_utils';
import { requirePageAccess } from './_shared';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const access = await requirePageAccess(context as EventContext<Env, string, unknown>);
  if (access instanceof Response) return access;

  const since = new URL(context.request.url).searchParams.get('since') ?? new Date(Date.now() - 30 * 86400_000).toISOString();

  const rows = await context.env.DB.prepare(`
    WITH event_stats AS (
      SELECT
        COALESCE(NULLIF(json_extract(event_payload_json, '$.utm_source'), ''), '(direct)') AS source,
        COALESCE(NULLIF(json_extract(event_payload_json, '$.utm_medium'), ''), '(none)') AS medium,
        COUNT(*) AS events,
        SUM(CASE WHEN event_name IN ('link_click','hero_cta_click','social_click','announcement_click') THEN 1 ELSE 0 END) AS clicks,
        SUM(CASE WHEN event_name = 'page_view' THEN 1 ELSE 0 END) AS page_views
      FROM events
      WHERE page_id = ? AND occurred_at >= ?
      GROUP BY source, medium
    ),
    spend_stats AS (
      SELECT
        COALESCE(NULLIF(source, ''), '(direct)') AS source,
        COALESCE(NULLIF(medium, ''), '(none)') AS medium,
        SUM(amount) AS spend
      FROM ad_spend_entries
      WHERE page_id = ?
        AND date(spend_date) >= date(?)
        AND variant_id IS NULL
      GROUP BY source, medium
    )
    SELECT
      e.source,
      e.medium,
      e.events,
      e.clicks,
      e.page_views,
      COALESCE(s.spend, 0) AS spend
    FROM event_stats e
    LEFT JOIN spend_stats s ON s.source = e.source AND s.medium = e.medium
    ORDER BY e.clicks DESC, e.page_views DESC, e.source ASC
  `).bind(access.pageId, since, access.pageId, since).all<{ source: string; medium: string; events: number; clicks: number; page_views: number; spend: number }>();

  const sources = (rows.results ?? []).map((row) => ({
    source: row.source,
    medium: row.medium,
    events: Number(row.events ?? 0),
    clicks: Number(row.clicks ?? 0),
    pageViews: Number(row.page_views ?? 0),
    ctr: Number(row.page_views ?? 0) > 0 ? Number(row.clicks ?? 0) / Number(row.page_views ?? 0) : 0,
    spend: Number(row.spend ?? 0),
    cpcProxy: Number(row.clicks ?? 0) > 0 ? Number(row.spend ?? 0) / Number(row.clicks ?? 0) : 0
  }));

  return json({ ok: true, since, sources });
};
