import { json } from '../../../../_utils';
import { requirePageAccess } from './_shared';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const access = await requirePageAccess(context as EventContext<Env, string, unknown>);
  if (access instanceof Response) return access;

  const since = new URL(context.request.url).searchParams.get('since') ?? new Date(Date.now() - 30 * 86400_000).toISOString();

  const rows = await context.env.DB.prepare(`
    SELECT
      COALESCE(l.id, json_extract(e.event_payload_json, '$.link_id')) AS link_id,
      COALESCE(l.title, '(unknown)') AS title,
      CAST(COALESCE(json_extract(e.event_payload_json, '$.row_index'), l.row_order) AS INTEGER) AS row_index,
      COUNT(*) AS clicks,
      COALESCE(json_extract(e.event_payload_json, '$.destination_domain'), '') AS destination_domain
    FROM events e
    LEFT JOIN page_links l ON l.id = json_extract(e.event_payload_json, '$.link_id')
    WHERE e.page_id = ?
      AND e.event_name = 'link_click'
      AND e.occurred_at >= ?
    GROUP BY link_id, title, row_index, destination_domain
    ORDER BY clicks DESC, row_index ASC
  `).bind(access.pageId, since).all();

  return json({ ok: true, since, links: rows.results ?? [] });
};
