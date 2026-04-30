import { json } from '../../../../_utils';
import { requirePageAccess } from './_shared';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const access = await requirePageAccess(context as EventContext<Env, string, unknown>);
  if (access instanceof Response) return access;

  const since = new URL(context.request.url).searchParams.get('since') ?? new Date(Date.now() - 30 * 86400_000).toISOString();

  const [totals, topRow, topSource, experiment, topDestination, consent, spend] = await Promise.all([
    context.env.DB.prepare(`
      SELECT
        COUNT(*) AS total_events,
        SUM(CASE WHEN event_name = 'page_view' THEN 1 ELSE 0 END) AS page_views,
        SUM(CASE WHEN event_name IN ('link_click','hero_cta_click','social_click','announcement_click') THEN 1 ELSE 0 END) AS clicks
      FROM events
      WHERE page_id = ? AND occurred_at >= ?
    `).bind(access.pageId, since).first<{ total_events: number; page_views: number; clicks: number }>(),
    context.env.DB.prepare(`
      SELECT
        CAST(json_extract(event_payload_json, '$.row_index') AS INTEGER) AS row_index,
        COUNT(*) AS clicks
      FROM events
      WHERE page_id = ?
        AND event_name = 'link_click'
        AND occurred_at >= ?
        AND json_extract(event_payload_json, '$.row_index') IS NOT NULL
      GROUP BY row_index
      ORDER BY clicks DESC, row_index ASC
      LIMIT 1
    `).bind(access.pageId, since).first<{ row_index: number; clicks: number }>(),
    context.env.DB.prepare(`
      SELECT
        COALESCE(NULLIF(json_extract(event_payload_json, '$.utm_source'), ''), '(direct)') AS source,
        COUNT(*) AS clicks
      FROM events
      WHERE page_id = ?
        AND event_name IN ('link_click','hero_cta_click','social_click','announcement_click')
        AND occurred_at >= ?
      GROUP BY source
      ORDER BY clicks DESC, source ASC
      LIMIT 1
    `).bind(access.pageId, since).first<{ source: string; clicks: number }>(),
    context.env.DB.prepare(`
      SELECT
        e.variant_id,
        COALESCE(v.name, e.variant_id) AS variant_name,
        COUNT(*) AS clicks
      FROM events e
      LEFT JOIN experiment_variants v ON v.id = e.variant_id
      WHERE e.page_id = ?
        AND e.variant_id IS NOT NULL
        AND e.event_name IN ('link_click','hero_cta_click','social_click','announcement_click')
        AND e.occurred_at >= ?
      GROUP BY e.variant_id, variant_name
      ORDER BY clicks DESC
      LIMIT 1
    `).bind(access.pageId, since).first<{ variant_id: string; variant_name: string; clicks: number }>(),
    context.env.DB.prepare(`
      SELECT
        COALESCE(NULLIF(json_extract(event_payload_json, '$.destination_domain'), ''), '(none)') AS destination_domain,
        COUNT(*) AS clicks
      FROM events
      WHERE page_id = ?
        AND event_name IN ('link_click','hero_cta_click','social_click','announcement_click')
        AND occurred_at >= ?
      GROUP BY destination_domain
      ORDER BY clicks DESC, destination_domain ASC
      LIMIT 1
    `).bind(access.pageId, since).first<{ destination_domain: string; clicks: number }>(),
    context.env.DB.prepare(`
      SELECT
        COUNT(*) AS records,
        SUM(CASE WHEN analytics_state = 'granted' THEN 1 ELSE 0 END) AS analytics_granted,
        SUM(CASE WHEN ads_state = 'granted' THEN 1 ELSE 0 END) AS ads_granted
      FROM consent_records
      WHERE page_id = ?
        AND recorded_at >= ?
    `).bind(access.pageId, since).first<{ records: number; analytics_granted: number; ads_granted: number }>(),
    context.env.DB.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total_spend
      FROM ad_spend_entries
      WHERE page_id = ?
        AND date(spend_date) >= date(?)
    `).bind(access.pageId, since).first<{ total_spend: number }>()
  ]);

  const pageViews = Number(totals?.page_views ?? 0);
  const clicks = Number(totals?.clicks ?? 0);
  const totalSpend = Number(spend?.total_spend ?? 0);
  const consentRecords = Number(consent?.records ?? 0);
  const analyticsGranted = Number(consent?.analytics_granted ?? 0);
  const adsGranted = Number(consent?.ads_granted ?? 0);

  return json({
    ok: true,
    since,
    summary: {
      totalEvents: Number(totals?.total_events ?? 0),
      pageViews,
      clicks,
      pageCtr: pageViews > 0 ? clicks / pageViews : 0,
      topRow,
      topSource,
      topVariant: experiment ? { variant_id: experiment.variant_id, variant_name: experiment.variant_name, clicks: Number(experiment.clicks ?? 0) } : null,
      topDestination: topDestination ? { destinationDomain: topDestination.destination_domain, clicks: Number(topDestination.clicks ?? 0) } : null,
      totalSpend,
      cpcProxy: clicks > 0 ? totalSpend / clicks : 0,
      analyticsConsentRate: consentRecords > 0 ? analyticsGranted / consentRecords : 0,
      adsConsentRate: consentRecords > 0 ? adsGranted / consentRecords : 0,
      consentRecords
    }
  });
};
