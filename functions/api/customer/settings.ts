import { errorJson, json, readJson } from '../_utils';
import { normalizeText } from '../../../src/server/security/validation';
import { isSameOriginMutation } from '../../../src/server/auth/customer';
import { customerSession, writeCustomerAudit } from './_shared';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await customerSession(context);
  if (!session) return errorJson('Customer session expired. Please sign in again.', 401);
  const settings = await context.env.DB.prepare(`
    SELECT u.email, u.created_at AS account_created_at, t.name AS profile_name
    FROM users u JOIN tenants t ON t.owner_user_id = u.id
    WHERE u.id = ? AND u.account_type = 'customer' AND t.id = ? LIMIT 1
  `).bind(session.userId, session.tenantId).first<{ email: string; account_created_at: string; profile_name: string }>();
  if (!settings) return errorJson('Customer settings not found.', 404);
  return json({ ok: true, settings });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const session = await customerSession(context);
  if (!session) return errorJson('Customer session expired. Please sign in again.', 401);
  if (!isSameOriginMutation(context.request)) return errorJson('Invalid request origin.', 403);
  const body = await readJson(context.request, { maxBytes: 4096 });
  const profileName = normalizeText(body?.profileName, 80);
  if (!profileName || profileName.length < 2) return errorJson('Profile name must be between 2 and 80 characters.', 400);
  const result = await context.env.DB.prepare('UPDATE tenants SET name = ?, updated_at = ? WHERE id = ? AND owner_user_id = ?')
    .bind(profileName, new Date().toISOString(), session.tenantId, session.userId).run();
  if (!result.success) return errorJson('Could not save settings.', 500);
  await writeCustomerAudit({ env: context.env, session, action: 'customer_profile_updated', targetType: 'tenant', targetId: session.tenantId, diff: { profileName } });
  return json({ ok: true, saved: true });
};
