import { errorJson, json, readJson } from '../_utils';
import { normalizeOptionalText, normalizeText } from '../../../src/server/security/validation';
import { isSameOriginMutation } from '../../../src/server/auth/customer';
import { customerSession, getCustomerPage, refreshCustomerPage, writeCustomerAudit } from './_shared';

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const session = await customerSession(context);
  if (!session) return errorJson('Customer session expired. Please sign in again.', 401);
  if (!isSameOriginMutation(context.request)) return errorJson('Invalid request origin.', 403);
  const body = await readJson(context.request, { maxBytes: 4096 });
  const title = normalizeText(body?.title, 120);
  if (!title) return errorJson('Page title is required.', 400);
  const subtitle = normalizeOptionalText(body?.subtitle, 240);
  const page = await getCustomerPage(context.env, session.tenantId);
  if (!page) return errorJson('Customer page not found.', 404);
  const now = new Date().toISOString();
  await context.env.DB.prepare(`UPDATE pages SET title = ?, subtitle = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`)
    .bind(title, subtitle, now, page.id, session.tenantId).run();
  await writeCustomerAudit({ env: context.env, session, action: 'customer_page_updated', targetType: 'page', targetId: page.id, diff: { title, subtitle } });
  await refreshCustomerPage(context.env, page.id);
  return json({ ok: true, saved: true });
};
