import { errorJson, json, readJson, setCookieHeaders } from '../_utils';
import { verifyPassword, hashPassword } from '../../../src/server/auth/password';
import { isSameOriginMutation, validateCustomerPassword } from '../../../src/server/auth/customer';
import { clearCustomerSessionCookie } from '../../../src/server/auth/customer-session';
import { customerSession, writeCustomerAudit } from './_shared';

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const session = await customerSession(context);
  if (!session) return errorJson('Customer session expired. Please sign in again.', 401);
  if (!isSameOriginMutation(context.request)) return errorJson('Invalid request origin.', 403);
  const body = await readJson(context.request, { maxBytes: 8192 }) as { currentPassword?: unknown; newPassword?: unknown } | null;
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
  const passwordError = validateCustomerPassword(body?.newPassword);
  if (!currentPassword) return errorJson('Enter your current password.', 400);
  if (passwordError) return errorJson(passwordError, 400);
  const user = await context.env.DB.prepare(`SELECT password_hash FROM users WHERE id = ? AND account_type = 'customer' AND email_verified_at IS NOT NULL AND is_active = 1 LIMIT 1`)
    .bind(session.userId).first<{ password_hash: string }>();
  if (!user || !await verifyPassword(currentPassword, user.password_hash)) return errorJson('Current password is incorrect.', 401);
  const now = new Date().toISOString();
  const newHash = await hashPassword(body?.newPassword as string);
  await context.env.DB.prepare(`UPDATE users SET password_hash = ?, password_changed_at = ?, session_version = session_version + 1,
    failed_login_count = 0, locked_until = NULL, updated_at = ? WHERE id = ? AND account_type = 'customer'`)
    .bind(newHash, now, now, session.userId).run();
  await writeCustomerAudit({ env: context.env, session, action: 'customer_password_changed', targetType: 'user', targetId: session.userId });
  return json({ ok: true, passwordChanged: true, message: 'Password changed. Sign in again with your new password.' }, 200, setCookieHeaders(clearCustomerSessionCookie()));
};
