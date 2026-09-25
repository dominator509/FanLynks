import { errorJson, json, readJson, setCookieHeaders } from '../_utils';
import { hashPassword } from '../../../src/server/auth/password';
import { isSameOriginMutation, sha256Token, validateCustomerPassword } from '../../../src/server/auth/customer';
import { clearCustomerSessionCookie } from '../../../src/server/auth/customer-session';
import { makeId } from '../../../src/server/db/ids';
import { getClientIp, sha256Hex } from '../../../src/server/security/request';
import { rejectIfIpLimited, writeCustomerSecurityEvent } from './_shared';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!isSameOriginMutation(context.request)) return errorJson('Invalid request origin.', 403);
  const body = await readJson(context.request, { maxBytes: 8192 }) as { token?: unknown; password?: unknown } | null;
  const token = typeof body?.token === 'string' ? body.token : '';
  if (token.length < 32 || token.length > 128) return errorJson('This reset link is invalid or expired.', 400);
  const passwordError = validateCustomerPassword(body?.password);
  if (passwordError) return errorJson(passwordError, 400);
  const ip = getClientIp(context.request);
  const limited = await rejectIfIpLimited({ env: context.env, ip, action: 'reset-password', limit: 8, windowSeconds: 60 * 60 });
  if (limited) return limited;
  const tokenHash = await sha256Token(token);
  const now = new Date().toISOString();
  const tokenRow = await context.env.DB.prepare(`
    SELECT u.id, u.email, t.id AS tenant_id FROM customer_account_tokens tok
    JOIN users u ON u.id = tok.user_id JOIN tenants t ON t.owner_user_id = u.id
    WHERE tok.token_hash = ? AND tok.token_type = 'password_reset' AND tok.consumed_at IS NULL AND tok.expires_at > ?
      AND u.account_type = 'customer' AND u.email_verified_at IS NOT NULL AND u.is_active = 1 LIMIT 1
  `).bind(tokenHash, now).first<{ id: string; email: string; tenant_id: string }>();
  if (!tokenRow) return errorJson('This reset link is invalid or expired.', 400);
  const passwordHash = await hashPassword(body?.password as string);
  await context.env.DB.batch([
    context.env.DB.prepare(`
      UPDATE users SET password_hash = ?, password_changed_at = ?, session_version = session_version + 1,
        failed_login_count = 0, locked_until = NULL, updated_at = ?
      WHERE id = ? AND account_type = 'customer' AND EXISTS (SELECT 1 FROM customer_account_tokens WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?)
    `).bind(passwordHash, now, now, tokenRow.id, tokenHash, now),
    context.env.DB.prepare("UPDATE customer_account_tokens SET consumed_at = ? WHERE token_hash = ? AND token_type = 'password_reset' AND consumed_at IS NULL AND expires_at > ?")
      .bind(now, tokenHash, now),
    context.env.DB.prepare(`INSERT INTO security_events (id, tenant_id, user_id, event_type, identifier_hash, ip_hash, user_agent_hash, success, detail_json, created_at) VALUES (?, ?, ?, 'customer_password_reset_completed', ?, ?, NULL, 1, '{}', ?)`)
      .bind(makeId('secevt'), tokenRow.tenant_id, tokenRow.id, await sha256Hex(tokenRow.email), await sha256Hex(ip), now)
  ]);
  const consumed = await context.env.DB.prepare("SELECT consumed_at FROM customer_account_tokens WHERE token_hash = ? AND token_type = 'password_reset'").bind(tokenHash).first<{ consumed_at: string | null }>();
  if (!consumed?.consumed_at) return errorJson('This reset link is invalid or expired.', 400);
  return json({ ok: true, passwordChanged: true, message: 'Password updated. Sign in with your new password.' }, 200, setCookieHeaders(clearCustomerSessionCookie()));
};
