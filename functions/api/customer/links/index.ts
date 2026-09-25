import { errorJson, json, readJson } from '../../_utils';
import { isSameOriginMutation } from '../../../../src/server/auth/customer';
import { makeId } from '../../../../src/server/db/ids';
import { normalizeOptionalText, normalizePublicUrl, normalizeText } from '../../../../src/server/security/validation';
import { customerSession, getCustomerPage, refreshCustomerPage, writeCustomerAudit } from '../_shared';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await customerSession(context);
  if (!session) return errorJson('Customer session expired. Please sign in again.', 401);
  const page = await getCustomerPage(context.env, session.tenantId);
  if (!page) return errorJson('Customer page not found.', 404);
  const links = await context.env.DB.prepare('SELECT id, title, subtitle, url, row_order FROM page_links WHERE page_id = ? ORDER BY row_order ASC').bind(page.id).all<{ id: string; title: string; subtitle: string | null; url: string; row_order: number }>();
  return json({ ok: true, links: (links.results ?? []).map((link) => ({ id: link.id, title: link.title, subtitle: link.subtitle, url: link.url, rowOrder: link.row_order })) });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const session = await customerSession(context);
  if (!session) return errorJson('Customer session expired. Please sign in again.', 401);
  if (!isSameOriginMutation(context.request)) return errorJson('Invalid request origin.', 403);
  const body = await readJson(context.request, { maxBytes: 4096 });
  const title = normalizeText(body?.title, 120);
  let url: string;
  try { url = normalizePublicUrl(body?.url); } catch (error) { return errorJson(error instanceof Error ? error.message : 'Invalid URL.', 400); }
  if (!title) return errorJson('Link title is required.', 400);
  const page = await getCustomerPage(context.env, session.tenantId);
  if (!page) return errorJson('Customer page not found.', 404);
  const section = await context.env.DB.prepare('SELECT id FROM page_sections WHERE page_id = ? AND is_enabled = 1 ORDER BY section_order ASC LIMIT 1').bind(page.id).first<{ id: string }>();
  if (!section) return errorJson('Page link section is unavailable.', 409);
  const max = await context.env.DB.prepare('SELECT COALESCE(MAX(row_order), 0) AS max_order FROM page_links WHERE page_id = ?').bind(page.id).first<{ max_order: number }>();
  const id = makeId('link');
  const now = new Date().toISOString();
  await context.env.DB.prepare(`INSERT INTO page_links (id, page_id, section_id, title, subtitle, url, icon_type, icon_value, badge_text, style_role, row_order, is_enabled, start_at, end_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'none', NULL, NULL, 'neutral', ?, 1, NULL, NULL, ?, ?)`)
    .bind(id, page.id, section.id, title, normalizeOptionalText(body?.subtitle, 180), url, Number(max?.max_order || 0) + 1, now, now).run();
  await writeCustomerAudit({ env: context.env, session, action: 'customer_link_created', targetType: 'link', targetId: id, diff: { title, url } });
  await refreshCustomerPage(context.env, page.id);
  return json({ ok: true, linkId: id }, 201);
};
