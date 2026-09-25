import { errorJson, json, readJson } from '../_utils';
import { validateAdminSession } from '../../../src/server/auth/session';
import { isValidCustomerEmail, makeOpaqueToken, sha256Token, isSameOriginMutation } from '../../../src/server/auth/customer';
import { makeId } from '../../../src/server/db/ids';
import { sha256Hex } from '../../../src/server/security/request';
import { checkRateLimit } from '../../../src/server/security/rateLimit';
import { configuredAppOrigin, sendCustomerEmail } from '../customer/_shared';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const session = await validateAdminSession({ request: context.request, secret: context.env.SESSION_SECRET, db: context.env.DB });
  if (!session) return errorJson('Unauthorized.', 401);
  if (!isSameOriginMutation(context.request)) return errorJson('Invalid request origin.', 403);
  const body = await readJson(context.request, { maxBytes: 4096 }) as { email?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!isValidCustomerEmail(email)) return errorJson('Enter a valid invitation email.', 400);
  const limited = await checkRateLimit({ kv: context.env.PAGE_CACHE, key: `rl:admin:customer-invite:${await sha256Hex(session.userId)}`, limit: 8, windowSeconds: 60 * 60 });
  if (!limited.allowed) return errorJson('Too many invitations. Try again later.', 429, { retryAfterSeconds: limited.retryAfterSeconds });
  const origin = configuredAppOrigin(context.env);
  if (!origin) return errorJson('Customer account origin is not configured.', 503);
  const token = makeOpaqueToken();
  const tokenHash = await sha256Token(token);
  const emailHash = await sha256Hex(email);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const id = makeId('invite');
  await context.env.DB.batch([
    context.env.DB.prepare(`INSERT INTO customer_invites (id, email_hash, token_hash, created_by, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(id, emailHash, tokenHash, session.userId, expiresAt, now),
    context.env.DB.prepare(`INSERT INTO audit_log (id, tenant_id, user_id, action, target_type, target_id, diff_json, created_at) VALUES (?, ?, ?, 'customer_invite_created', 'customer_invite', ?, ?, ?)`)
      .bind(makeId('audit'), session.tenantId, session.userId, id, JSON.stringify({ emailHash, expiresAt }), now)
  ]);
  const inviteUrl = new URL('/signup', origin);
  inviteUrl.hash = new URLSearchParams({ invite: token }).toString();
  const emailSent = await sendCustomerEmail(context.env, { to: email, type: 'invite', url: inviteUrl.toString() });
  return json({ ok: true, inviteUrl: inviteUrl.toString(), expiresAt, emailSent }, 201);
};
