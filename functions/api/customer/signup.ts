import { errorJson, json, readJson } from '../_utils';
import { verifyTurnstileToken } from '../../../src/server/auth/turnstile';
import { hashPassword } from '../../../src/server/auth/password';
import { makeId } from '../../../src/server/db/ids';
import { getClientIp, sha256Hex } from '../../../src/server/security/request';
import { isValidCustomerEmail, makeOpaqueToken, normalizeCustomerSlug, sha256Token, validateCustomerPassword, isSameOriginMutation } from '../../../src/server/auth/customer';
import { customerActionUrl, rejectIfRateLimited, sendCustomerEmail, writeCustomerSecurityEvent } from './_shared';

interface SignupBody { email?: unknown; password?: unknown; fullName?: unknown; pageSlug?: unknown; inviteToken?: unknown; turnstileToken?: unknown; }
const GENERIC_MESSAGE = 'If the invitation is valid and matches this email, a confirmation message will arrive shortly.';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!isSameOriginMutation(context.request)) return errorJson('Invalid request origin.', 403);
  const body = await readJson(context.request, { maxBytes: 8192 }) as SignupBody | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body?.password;
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : '';
  const slug = normalizeCustomerSlug(body?.pageSlug);
  const inviteToken = typeof body?.inviteToken === 'string' ? body.inviteToken.trim() : '';
  const turnstileToken = typeof body?.turnstileToken === 'string' ? body.turnstileToken : '';
  if (!isValidCustomerEmail(email) || fullName.length < 2 || fullName.length > 80 || !slug) {
    return errorJson('Enter a valid email, profile name, and page address.', 400);
  }
  const passwordError = validateCustomerPassword(password);
  if (passwordError) return errorJson(passwordError, 400);
  const inviteOnly = context.env.CUSTOMER_SIGNUP_MODE !== 'open';
  if (inviteOnly && inviteToken.length < 32) return errorJson('A valid beta invitation is required.', 403);
  if (!turnstileToken) return errorJson('Complete the security check and try again.', 400);

  const ip = getClientIp(context.request);
  const limited = await rejectIfRateLimited({
    env: context.env, ip, identifier: email, action: 'signup', ipLimit: 10, identifierLimit: 4, windowSeconds: 60 * 60
  });
  if (limited) return limited;
  const turnstile = await verifyTurnstileToken({ secretKey: context.env.TURNSTILE_SECRET_KEY, token: turnstileToken, ip, expectedAction: 'customer_signup' });
  if (!turnstile.ok) return errorJson('Security verification failed. Refresh the check and try again.', 403);

  const slugRow = await context.env.DB.prepare(`
    SELECT
      EXISTS(SELECT 1 FROM pages WHERE slug = ?) AS page_taken,
      EXISTS(SELECT 1 FROM tenants WHERE slug = ?) AS tenant_taken
  `).bind(slug, slug).first<{ page_taken: number; tenant_taken: number }>();
  if (slugRow?.page_taken || slugRow?.tenant_taken) return errorJson('That page address is unavailable.', 409);

  const now = new Date().toISOString();
  const userId = makeId('user');
  const tenantId = makeId('tenant');
  const pageId = makeId('page');
  const sectionId = makeId('section');
  const verifyToken = makeOpaqueToken();
  const verifyTokenHash = await sha256Token(verifyToken);
  const inviteTokenHash = inviteOnly ? await sha256Token(inviteToken) : null;
  const emailHash = await sha256Hex(email);
  const passwordHash = await hashPassword(password as string);

  const statements: D1PreparedStatement[] = [];
  if (inviteOnly) {
    // The invite records the new user before the user row is inserted later in this atomic batch.
    statements.push(context.env.DB.prepare('PRAGMA defer_foreign_keys = ON'));
    statements.push(context.env.DB.prepare(`
      UPDATE customer_invites
      SET redeemed_at = ?, redeemed_by = ?
      WHERE token_hash = ? AND email_hash = ? AND redeemed_at IS NULL AND expires_at > ?
    `).bind(now, userId, inviteTokenHash, emailHash, now));
  }
  statements.push(
    context.env.DB.prepare(`
      INSERT INTO users (id, email, password_hash, created_at, updated_at, account_type, email_verified_at)
      SELECT ?, ?, ?, ?, ?, 'customer', NULL
      WHERE ? = 1 AND (? = 1 OR EXISTS (
        SELECT 1 FROM customer_invites WHERE token_hash = ? AND redeemed_by = ? AND redeemed_at = ?
      ))
    `).bind(userId, email, passwordHash, now, now, 1, inviteOnly ? 0 : 1, inviteTokenHash, userId, now),
    context.env.DB.prepare(`
      INSERT INTO tenants (id, owner_user_id, name, slug, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)
    `).bind(tenantId, userId, fullName, slug, now, now, userId),
    context.env.DB.prepare(`
      INSERT INTO pages (id, tenant_id, slug, title, subtitle, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM tenants WHERE id = ?)
    `).bind(pageId, tenantId, slug, fullName, null, now, now, tenantId),
    context.env.DB.prepare(`
      INSERT INTO page_sections (id, page_id, label, section_order, is_enabled)
      SELECT ?, ?, 'Links', 1, 1 WHERE EXISTS (SELECT 1 FROM pages WHERE id = ?)
    `).bind(sectionId, pageId, pageId),
    context.env.DB.prepare(`
      INSERT INTO customer_account_tokens (id, user_id, token_type, token_hash, expires_at, created_at)
      SELECT ?, ?, 'verify_email', ?, ?, ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)
    `).bind(makeId('acctok'), userId, verifyTokenHash, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), now, userId),
    context.env.DB.prepare(`
      INSERT INTO security_events (id, tenant_id, user_id, event_type, identifier_hash, ip_hash, user_agent_hash, success, detail_json, created_at)
      SELECT ?, ?, ?, 'customer_signup', ?, ?, ?, 1, '{}', ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)
    `).bind(makeId('secevt'), tenantId, userId, emailHash, await sha256Hex(ip), context.request.headers.get('user-agent') ? await sha256Hex(context.request.headers.get('user-agent')!) : null, now, userId),
    context.env.DB.prepare(`
      INSERT INTO audit_log (id, tenant_id, user_id, action, target_type, target_id, diff_json, created_at)
      SELECT ?, ?, ?, 'customer_account_created', 'page', ?, '{}', ? WHERE EXISTS (SELECT 1 FROM pages WHERE id = ?)
    `).bind(makeId('audit'), tenantId, userId, pageId, now, pageId)
  );

  try {
    await context.env.DB.batch(statements);
  } catch {
    // A duplicate account or a concurrent page-slug claim has the same public response.
    return json({ ok: true, message: GENERIC_MESSAGE }, 202);
  }

  const created = await context.env.DB.prepare("SELECT id FROM users WHERE id = ? AND account_type = 'customer'").bind(userId).first<{ id: string }>();
  if (created) {
    const url = customerActionUrl(context.env, '/verify-email', verifyToken);
    const delivered = url ? await sendCustomerEmail(context.env, { to: email, type: 'verify_email', url }) : false;
    if (!delivered) {
      await writeCustomerSecurityEvent({ env: context.env, email, ip, userAgent: context.request.headers.get('user-agent') ?? '', eventType: 'customer_verification_email_failed', userId, tenantId });
    }
  }
  return json({ ok: true, message: GENERIC_MESSAGE }, 202);
};
