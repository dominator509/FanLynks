import { errorJson, json } from '../../_utils';
import { hashAxiomAnalyticsToken, isAxiomAnalyticsToken } from '../../../../src/server/auth/axiom-analytics-token';

const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000;
const CLICK_EVENTS = ['link_click', 'hero_cta_click', 'social_click', 'announcement_click'] as const;

function parseRange(requestUrl: URL): { since: string; until: string } | Response {
  const now = Date.now();
  const untilText = requestUrl.searchParams.get('until') ?? new Date(now).toISOString();
  const sinceText = requestUrl.searchParams.get('since') ?? new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const since = new Date(sinceText);
  const until = new Date(untilText);
  if (!Number.isFinite(since.getTime()) || !Number.isFinite(until.getTime())
    || since.toISOString() !== sinceText || until.toISOString() !== untilText
    || since.getTime() >= until.getTime() || until.getTime() > now + 60_000
    || until.getTime() - since.getTime() > MAX_RANGE_MS) {
    return errorJson('since and until must be ISO timestamps for a past range no longer than 90 days.', 400);
  }
  return { since: since.toISOString(), until: until.toISOString() };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authorization = context.request.headers.get('authorization') ?? '';
  const match = /^Bearer (\S+)$/.exec(authorization);
  if (!match || !isAxiomAnalyticsToken(match[1])) return errorJson('Unauthorized.', 401);

  const tokenHash = await hashAxiomAnalyticsToken(match[1]);
  const token = await context.env.DB.prepare(`
    SELECT t.id, t.tenant_id, t.page_id, p.slug
    FROM integration_api_tokens t
    JOIN pages p ON p.id = t.page_id AND p.tenant_id = t.tenant_id
    WHERE t.token_hash = ? AND t.revoked_at IS NULL
    LIMIT 1
  `).bind(tokenHash).first<{ id: string; tenant_id: string; page_id: string; slug: string }>();
  if (!token) return errorJson('Unauthorized.', 401);

  const requestUrl = new URL(context.request.url);
  const range = parseRange(requestUrl);
  if (range instanceof Response) return range;

  const rows = await context.env.DB.prepare(`
    SELECT
      substr(occurred_at, 1, 10) AS date,
      COALESCE(NULLIF(json_extract(event_payload_json, '$.utm_source'), ''), '(direct)') AS source,
      COALESCE(NULLIF(json_extract(event_payload_json, '$.utm_medium'), ''), '(none)') AS medium,
      SUM(CASE WHEN event_name = 'page_view' THEN 1 ELSE 0 END) AS page_views,
      SUM(CASE WHEN event_name IN (${CLICK_EVENTS.map(() => '?').join(', ')}) THEN 1 ELSE 0 END) AS clicks,
      COUNT(*) AS events
    FROM events
    WHERE page_id = ? AND occurred_at >= ? AND occurred_at < ?
    GROUP BY date, source, medium
    ORDER BY date ASC, clicks DESC, source ASC, medium ASC
    LIMIT 10001
  `).bind(...CLICK_EVENTS, token.page_id, range.since, range.until).all<{
    date: string;
    source: string;
    medium: string;
    page_views: number;
    clicks: number;
    events: number;
  }>();

  const resultRows = rows.results ?? [];
  if (resultRows.length > 10_000) {
    return errorJson('Analytics range exceeds the supported source-row limit; request a shorter range.', 422);
  }

  const sources = resultRows.map((row) => ({
    date: row.date,
    source: String(row.source).slice(0, 160),
    medium: String(row.medium).slice(0, 160),
    pageViews: Number(row.page_views) || 0,
    clicks: Number(row.clicks) || 0,
    events: Number(row.events) || 0,
  }));
  const summary = sources.reduce((total, row) => ({
    pageViews: total.pageViews + row.pageViews,
    clicks: total.clicks + row.clicks,
    events: total.events + row.events,
  }), { pageViews: 0, clicks: 0, events: 0 });
  const readAt = new Date().toISOString();
  await context.env.DB.prepare(`
    UPDATE integration_api_tokens SET last_used_at = ? WHERE id = ? AND revoked_at IS NULL
  `).bind(readAt, token.id).run();

  return json({
    ok: true,
    data: {
      page: { slug: token.slug },
      range,
      generatedAt: readAt,
      summary,
      sources,
      metricCoverage: { pageViews: true, clicks: true, uniqueVisitors: false, conversions: false },
    },
  }, 200, { 'Cache-Control': 'no-store' });
};
