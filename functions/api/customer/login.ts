import { errorJson, json, readJson, setCookieHeaders } from '../_utils';
import { verifyPassword } from '../../../src/server/auth/password';
import { verifyTurnstileToken } from '../../../src/server/auth/turnstile';
import { createCustomerSessionCookie } from '../../../src/server/auth/customer-session';
import { isValidCustomerEmail, isSameOriginMutation } from '../../../src/server/auth/customer';
import { makeId } from '../../../src/server/db/ids';
import { getClientIp, sha256Hex } from '../../../src/server/security/request';
import { rejectIfRateLimited, writeCustomerSecurityEvent } from './_shared';

interface LoginBody { email?: unknown; password?: unknown; turnstileToken?: unknown; }
interface LoginRow { id: string; email: string; password_hash: string; tenant_id: string; session_version: number; failed_login_count: number; locked_until: string | null; }
const LOCK_THRESHOLD = 5;
const LOCK_SECONDS = 15 * 60;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!isSameOriginMutation(context.request)) return errorJson('Invalid request origin.', 403);
  const body = await readJson(context.request, { maxBytes: 4096 }) as LoginBody | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const turnstileToken = typeof body?.turnstileToken === 'string' ? body.turnstileToken : '';
  if (!isValidCustomerEmail(email) || !password || !turnstileToken) return errorJson('Enter your email and password, then complete the security check.', 400);

  const ip = getClientIp(context.request);
  const limited = await rejectIfRateLimited({ env: context.env, ip, identifier: email, action: 'login', ipLimit: 20, identifierLimit: 10, windowSeconds: 15 * 60 });
  if (limited) {
    await writeCustomerSecurityEvent({ env: context.env, email, ip, userAgent: context.request.headers.get('user-agent') ?? '', eventType: 'customer_login_rate_limited' });
    return limited;
  }
  const turnstile = await verifyTurnstileToken({ secretKey: context.env.TURNSTILE_SECRET_KEY, token: turnstileToken, ip, expectedAction: 'customer_login' });
  if (!turnstile.ok) return errorJson('Security verification failed. Refresh the check and try again.', 403);

  const user = await context.env.DB.prepare(`
    SELECT u.id, u.email, u.password_hash, u.session_version, u.failed_login_count, u.locked_until, t.id AS tenant_id
    FROM users u JOIN tenants t ON t.owner_user_id = u.id
    WHERE lower(u.email) = ? AND u.is_active = 1 AND u.account_type = 'customer' AND u.email_verified_at IS NOT NULL
    LIMIT 1
  `).bind(email).first<LoginRow>();

  const genericFailure = async (eventType: string, locked: boolean): Promise<Response> => {
    const now = new Date().toISOString();
    if (user && !locked) {
      const failures = Number(user.failed_login_count || 0) + 1;
      const lockedUntil = failures >= LOCK_THRESHOLD ? new Date(Date.now() + LOCK_SECONDS * 1000).toISOString() : null;
      await context.env.DB.batch([
        context.env.DB.prepare('UPDATE users SET failed_login_count = ?, locked_until = ?, updated_at = ? WHERE id = ?').bind(failures, lockedUntil, now, user.id),
        context.env.DB.prepare(`INSERT INTO security_events (id, tenant_id, user_id, event_type, identifier_hash, ip_hash, user_agent_hash, success, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`)
          .bind(makeId('secevt'), user.tenant_id, user.id, eventType, await sha256Hex(email), await sha256Hex(ip), context.request.headers.get('user-agent') ? await sha256Hex(context.request.headers.get('user-agent')!) : null, JSON.stringify({ lockedUntil }), now)
      ]);
    } else {
      await writeCustomerSecurityEvent({ env: context.env, email, ip, userAgent: context.request.headers.get('user-agent') ?? '', eventType });
    }
    return errorJson('Invalid email or password.', 401);
  };

  if (!user) return genericFailure('customer_login_failed', false);
  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) return genericFailure('customer_login_locked', true);
  if (!await verifyPassword(password, user.password_hash)) return genericFailure('customer_login_failed', false);

  const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare('UPDATE users SET last_login_at = ?, failed_login_count = 0, locked_until = NULL, updated_at = ? WHERE id = ?').bind(now, now, user.id),
    context.env.DB.prepare(`INSERT INTO security_events (id, tenant_id, user_id, event_type, identifier_hash, ip_hash, user_agent_hash, success, detail_json, created_at) VALUES (?, ?, ?, 'customer_login_success', ?, ?, ?, 1, '{}', ?)`)
      .bind(makeId('secevt'), user.tenant_id, user.id, await sha256Hex(email), await sha256Hex(ip), context.request.headers.get('user-agent') ? await sha256Hex(context.request.headers.get('user-agent')!) : null, now)
  ]);
  const cookie = await createCustomerSessionCookie({ userId: user.id, tenantId: user.tenant_id, email: user.email, sessionVersion: Number(user.session_version) }, context.env.SESSION_SECRET);
  return json({ ok: true, authenticated: true, user: { id: user.id, email: user.email, tenantId: user.tenant_id } }, 200, setCookieHeaders(cookie));
};
