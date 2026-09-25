import { errorJson, json, readJson } from '../../_utils';
import { isSameOriginMutation } from '../../../../src/server/auth/customer';
import { normalizeOptionalText, normalizePublicUrl, normalizeText } from '../../../../src/server/security/validation';
import { customerSession, refreshCustomerPage, writeCustomerAudit } from '../_shared';

interface OwnedLink { id: string; page_id: string; title: string; subtitle: string | null; url: string; }

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const session = await customerSession(context);
  if (!session) return errorJson('Customer session expired. Please sign in again.', 401);
  if (!isSameOriginMutation(context.request)) return errorJson('Invalid request origin.', 403);
  const body = await readJson(context.request, { maxBytes: 4096 });
  const title = normalizeText(body?.title, 120);
  let url: string;
  try { url = normalizePublicUrl(body?.url); } catch (error) { return errorJson(error instanceof Error ? error.message : 'Invalid URL.', 400); }
  if (!title) return errorJson('Link title is required.', 400);
  const link = await context.env.DB.prepare(`SELECT l.id, l.page_id, l.title, l.subtitle, l.url FROM page_links l JOIN pages p ON p.id = l.page_id
    WHERE l.id = ? AND p.tenant_id = ? AND p.is_active = 1 LIMIT 1`).bind(context.params.linkId, session.tenantId).first<OwnedLink>();
  if (!link) return errorJson('Link not found.', 404);
  const subtitle = normalizeOptionalText(body?.subtitle, 180);
  await context.env.DB.prepare('UPDATE page_links SET title = ?, subtitle = ?, url = ?, updated_at = ? WHERE id = ? AND page_id = ?')
    .bind(title, subtitle, url, new Date().toISOString(), link.id, link.page_id).run();
  await writeCustomerAudit({ env: context.env, session, action: 'customer_link_updated', targetType: 'link', targetId: link.id, diff: { title, subtitle, url } });
  await refreshCustomerPage(context.env, link.page_id);
  return json({ ok: true, saved: true });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const session = await customerSession(context);
  if (!session) return errorJson('Customer session expired. Please sign in again.', 401);
  if (!isSameOriginMutation(context.request)) return errorJson('Invalid request origin.', 403);
  const link = await context.env.DB.prepare(`SELECT l.id, l.page_id, l.title, l.url FROM page_links l JOIN pages p ON p.id = l.page_id
    WHERE l.id = ? AND p.tenant_id = ? AND p.is_active = 1 LIMIT 1`).bind(context.params.linkId, session.tenantId).first<{ id: string; page_id: string; title: string; url: string }>();
  if (!link) return errorJson('Link not found.', 404);
  await context.env.DB.prepare('DELETE FROM page_links WHERE id = ? AND page_id = ?').bind(link.id, link.page_id).run();
  await writeCustomerAudit({ env: context.env, session, action: 'customer_link_deleted', targetType: 'link', targetId: link.id, diff: { title: link.title, url: link.url } });
  await refreshCustomerPage(context.env, link.page_id);
  return json({ ok: true, deleted: true });
};
