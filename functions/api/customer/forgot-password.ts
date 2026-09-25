import { json, readJson, errorJson } from '../_utils';
import { verifyTurnstileToken } from '../../../src/server/auth/turnstile';
import { makeOpaqueToken, sha256Token, isValidCustomerEmail, isSameOriginMutation } from '../../../src/server/auth/customer';
import { makeId } from '../../../src/server/db/ids';
import { getClientIp, sha256Hex } from '../../../src/server/security/request';
import { customerActionUrl, rejectIfRateLimited, sendCustomerEmail, writeCustomerSecurityEvent } from './_shared';

const GENERIC_MESSAGE = 'If a verified customer account uses that email, a password reset link will arrive shortly.';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!isSameOriginMutation(context.request)) return errorJson('Invalid request origin.', 403);
  const body = await readJson(context.request, { maxBytes: 4096 }) as { email?: unknown; turnstileToken?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const turnstileToken = typeof body?.turnstileToken === 'string' ? body.turnstileToken : '';
  if (!isValidCustomerEmail(email) || !turnstileToken) return errorJson('Enter a valid email and complete the security check.', 400);
  const ip = getClientIp(context.request);
  const limited = await rejectIfRateLimited({ env: context.env, ip, identifier: email, action: 'forgot-password', ipLimit: 8, identifierLimit: 3, windowSeconds: 60 * 60 });
  if (limited) return json({ ok: true, message: GENERIC_MESSAGE }, 202);
  const turnstile = await verifyTurnstileToken({ secretKey: context.env.TURNSTILE_SECRET_KEY, token: turnstileToken, ip, expectedAction: 'customer_forgot_password' });
  if (!turnstile.ok) return errorJson('Security verification failed. Refresh the check and try again.', 403);
  const user = await context.env.DB.prepare(`
    SELECT u.id, t.id AS tenant_id FROM users u JOIN tenants t ON t.owner_user_id = u.id
    WHERE lower(u.email) = ? AND u.account_type = 'customer' AND u.email_verified_at IS NOT NULL AND u.is_active = 1 LIMIT 1
  `).bind(email).first<{ id: string; tenant_id: string }>();
  if (user) {
    const now = new Date().toISOString();
    const token = makeOpaqueToken();
    const tokenHash = await sha256Token(token);
    await context.env.DB.batch([
      context.env.DB.prepare("UPDATE customer_account_tokens SET consumed_at = ? WHERE user_id = ? AND token_type = 'password_reset' AND consumed_at IS NULL").bind(now, user.id),
      context.env.DB.prepare(`INSERT INTO customer_account_tokens (id, user_id, token_type, token_hash, expires_at, created_at) VALUES (?, ?, 'password_reset', ?, ?, ?)`)
        .bind(makeId('acctok'), user.id, tokenHash, new Date(Date.now() + 30 * 60 * 1000).toISOString(), now),
      context.env.DB.prepare(`INSERT INTO security_events (id, tenant_id, user_id, event_type, identifier_hash, ip_hash, user_agent_hash, success, detail_json, created_at) VALUES (?, ?, ?, 'customer_password_reset_requested', ?, ?, NULL, 1, '{}', ?)`)
        .bind(makeId('secevt'), user.tenant_id, user.id, await sha256Hex(email), await sha256Hex(ip), now)
    ]);
    const url = customerActionUrl(context.env, '/reset-password', token);
    const delivered = url ? await sendCustomerEmail(context.env, { to: email, type: 'password_reset', url }) : false;
    if (!delivered) await writeCustomerSecurityEvent({ env: context.env, email, ip, userAgent: context.request.headers.get('user-agent') ?? '', eventType: 'customer_reset_email_failed', userId: user.id, tenantId: user.tenant_id });
  }
  return json({ ok: true, message: GENERIC_MESSAGE }, 202);
};
