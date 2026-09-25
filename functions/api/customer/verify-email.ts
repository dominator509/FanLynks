import { errorJson, json, readJson } from '../_utils';
import { isSameOriginMutation, sha256Token } from '../../../src/server/auth/customer';
import { makeId } from '../../../src/server/db/ids';
import { getClientIp, sha256Hex } from '../../../src/server/security/request';
import { rejectIfIpLimited, writeCustomerSecurityEvent } from './_shared';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!isSameOriginMutation(context.request)) return errorJson('Invalid request origin.', 403);
  const body = await readJson(context.request, { maxBytes: 4096 }) as { token?: unknown } | null;
  const token = typeof body?.token === 'string' ? body.token : '';
  if (token.length < 32 || token.length > 128) return errorJson('This confirmation link is invalid or expired.', 400);
  const ip = getClientIp(context.request);
  const limited = await rejectIfIpLimited({ env: context.env, ip, action: 'verify-email', limit: 10, windowSeconds: 60 * 60 });
  if (limited) return limited;
  const tokenHash = await sha256Token(token);
  const now = new Date().toISOString();
  const account = await context.env.DB.prepare(`
    SELECT u.id, u.email, t.id AS tenant_id
    FROM customer_account_tokens tok
    JOIN users u ON u.id = tok.user_id
    JOIN tenants t ON t.owner_user_id = u.id
    WHERE tok.token_hash = ? AND tok.token_type = 'verify_email' AND tok.consumed_at IS NULL AND tok.expires_at > ?
      AND u.account_type = 'customer' AND u.email_verified_at IS NULL AND u.is_active = 1
    LIMIT 1
  `).bind(tokenHash, now).first<{ id: string; email: string; tenant_id: string }>();
  if (!account) return errorJson('This confirmation link is invalid or expired.', 400);

  await context.env.DB.batch([
    context.env.DB.prepare(`UPDATE customer_account_tokens SET consumed_at = ? WHERE token_hash = ? AND token_type = 'verify_email' AND consumed_at IS NULL AND expires_at > ?`).bind(now, tokenHash, now),
    context.env.DB.prepare(`UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ? AND account_type = 'customer' AND email_verified_at IS NULL AND EXISTS (SELECT 1 FROM customer_account_tokens WHERE token_hash = ? AND consumed_at = ?)`)
      .bind(now, now, account.id, tokenHash, now),
    context.env.DB.prepare(`INSERT INTO security_events (id, tenant_id, user_id, event_type, identifier_hash, ip_hash, user_agent_hash, success, detail_json, created_at) VALUES (?, ?, ?, 'customer_email_verified', ?, ?, NULL, 1, '{}', ?)`)
      .bind(makeId('secevt'), account.tenant_id, account.id, await sha256Hex(account.email), await sha256Hex(ip), now)
  ]);
  const verified = await context.env.DB.prepare('SELECT email_verified_at FROM users WHERE id = ?').bind(account.id).first<{ email_verified_at: string | null }>();
  if (!verified?.email_verified_at) return errorJson('This confirmation link is invalid or expired.', 400);
  return json({ ok: true, emailVerified: true, message: 'Email confirmed. You can now sign in.' });
};
