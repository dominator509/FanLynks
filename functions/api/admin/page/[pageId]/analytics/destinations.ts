import { json } from '../../../../_utils';
import { requirePageAccess } from './_shared';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const access = await requirePageAccess(context as EventContext<Env, string, unknown>);
  if (access instanceof Response) return access;

  const since = new URL(context.request.url).searchParams.get('since') ?? new Date(Date.now() - 30 * 86400_000).toISOString();

  const rows = await context.env.DB.prepare(`
    SELECT
      COALESCE(NULLIF(json_extract(event_payload_json, '$.destination_domain'), ''), '(none)') AS destination_domain,
      COUNT(*) AS clicks
    FROM events
    WHERE page_id = ?
      AND event_name IN ('link_click','hero_cta_click','social_click','announcement_click')
      AND occurred_at >= ?
    GROUP BY destination_domain
    ORDER BY clicks DESC, destination_domain ASC
  `).bind(access.pageId, since).all<{ destination_domain: string; clicks: number }>();

  return json({ ok: true, since, destinations: (rows.results ?? []).map((row) => ({ destinationDomain: row.destination_domain, clicks: Number(row.clicks ?? 0) })) });
};
