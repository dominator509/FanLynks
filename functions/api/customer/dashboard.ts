import { errorJson, json } from '../_utils';
import { configuredAppOrigin, customerSession, getCustomerPage } from './_shared';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await customerSession(context);
  if (!session) return errorJson('Customer session expired. Please sign in again.', 401);
  const [tenant, page] = await Promise.all([
    context.env.DB.prepare('SELECT name, created_at FROM tenants WHERE id = ? AND owner_user_id = ? LIMIT 1').bind(session.tenantId, session.userId).first<{ name: string; created_at: string }>(),
    getCustomerPage(context.env, session.tenantId)
  ]);
  if (!tenant || !page) return errorJson('Customer page not found.', 404);
  const [linksResult, analyticsResult] = await Promise.all([
    context.env.DB.prepare(`SELECT id, title, subtitle, url, row_order FROM page_links WHERE page_id = ? ORDER BY row_order ASC`).bind(page.id).all<{ id: string; title: string; subtitle: string | null; url: string; row_order: number }>(),
    context.env.DB.prepare(`
      SELECT event_name, COUNT(*) AS event_count FROM events
      WHERE tenant_id = ? AND page_id = ? AND occurred_at >= ? AND event_name IN ('page_view', 'link_click')
      GROUP BY event_name
    `).bind(session.tenantId, page.id, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()).all<{ event_name: string; event_count: number }>()
  ]);
  const analytics = { pageViews: 0, linkClicks: 0, since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() };
  for (const row of analyticsResult.results ?? []) {
    if (row.event_name === 'page_view') analytics.pageViews = Number(row.event_count || 0);
    if (row.event_name === 'link_click') analytics.linkClicks = Number(row.event_count || 0);
  }
  return json({
    ok: true,
    tenant: { name: tenant.name, createdAt: tenant.created_at },
    page: { ...page, publicUrl: new URL(`/${encodeURIComponent(page.slug)}`, configuredAppOrigin(context.env) ?? new URL(context.request.url).origin).toString() },
    links: (linksResult.results ?? []).map((link) => ({ id: link.id, title: link.title, subtitle: link.subtitle, url: link.url, rowOrder: link.row_order })),
    analytics
  });
};
