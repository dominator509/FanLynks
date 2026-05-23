import { errorJson, json, readJson, setCookieHeaders } from '../_utils';
import { createClearedSessionCookie, validateAdminSession } from '../../../src/server/auth/session';
import { hashPassword, verifyPassword } from '../../../src/server/auth/password';
import { makeId } from '../../../src/server/db/ids';
import { getClientIp, sha256Hex } from '../../../src/server/security/request';

interface PasswordChangeBody {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

interface PasswordUserRow {
  id: string;
  email: string;
  password_hash: string;
  tenant_id: string;
}

const MIN_PASSWORD_LENGTH = 14;

async function auditPasswordChange(args: {
  db: D1Database;
  user: PasswordUserRow | null;
  ip: string;
  userAgent: string;
  success: boolean;
  detail?: Record<string, unknown>;
}): Promise<void> {
  await args.db.prepare(`
    INSERT INTO security_events (
      id, tenant_id, user_id, event_type, identifier_hash, ip_hash, user_agent_hash, success, detail_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    makeId('secevt'),
    args.user?.tenant_id ?? null,
    args.user?.id ?? null,
    'admin_password_changed',
    args.user ? await sha256Hex(args.user.email.toLowerCase()) : null,
    await sha256Hex(args.ip),
    args.userAgent ? await sha256Hex(args.userAgent) : null,
    args.success ? 1 : 0,
    JSON.stringify(args.detail ?? {}),
    new Date().toISOString()
  ).run();
}

function passwordPolicyError(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'New password must include uppercase, lowercase, and a number.';
  }
  return null;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const session = await validateAdminSession({
    request: context.request,
    secret: context.env.SESSION_SECRET,
    db: context.env.DB
  });
  if (!session) return errorJson('Unauthorized.', 401);

  const body = (await readJson(context.request, { maxBytes: 4096 })) as PasswordChangeBody | null;
  const currentPassword = body?.currentPassword ?? '';
  const newPassword = body?.newPassword ?? '';
  const confirmPassword = body?.confirmPassword ?? '';
  const ip = getClientIp(context.request);
  const userAgent = context.request.headers.get('user-agent') ?? '';

  if (!currentPassword || !newPassword || !confirmPassword) {
    return errorJson('Current password, new password, and confirmation are required.', 400);
  }
  if (newPassword !== confirmPassword) return errorJson('New password confirmation does not match.', 400);
  const policyError = passwordPolicyError(newPassword);
  if (policyError) return errorJson(policyError, 400);
  if (currentPassword === newPassword) return errorJson('New password must be different from the current password.', 400);

  const user = await context.env.DB.prepare(`
    SELECT u.id, u.email, u.password_hash, t.id AS tenant_id
    FROM users u
    JOIN tenants t ON t.owner_user_id = u.id
    WHERE u.id = ? AND u.is_active = 1
    LIMIT 1
  `)
    .bind(session.userId)
    .first<PasswordUserRow>();

  if (!user || user.tenant_id !== session.tenantId) {
    return errorJson('Unauthorized.', 401);
  }

  const currentValid = await verifyPassword(currentPassword, user.password_hash);
  if (!currentValid) {
    await auditPasswordChange({
      db: context.env.DB,
      user,
      ip,
      userAgent,
      success: false,
      detail: { reason: 'bad_current_password' }
    });
    return errorJson('Current password is incorrect.', 401);
  }

  const newHash = await hashPassword(newPassword);
  const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare(`
      UPDATE users
      SET password_hash = ?,
          session_version = session_version + 1,
          failed_login_count = 0,
          locked_until = NULL,
          password_changed_at = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(newHash, now, now, user.id),
    context.env.DB.prepare(`
      INSERT INTO security_events (
        id, tenant_id, user_id, event_type, identifier_hash, ip_hash, user_agent_hash, success, detail_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      makeId('secevt'),
      user.tenant_id,
      user.id,
      'admin_password_changed',
      await sha256Hex(user.email.toLowerCase()),
      await sha256Hex(ip),
      userAgent ? await sha256Hex(userAgent) : null,
      1,
      JSON.stringify({ sessionRevoked: true }),
      now
    )
  ]);

  return json(
    { ok: true, passwordChanged: true, requiresLogin: true },
    200,
    setCookieHeaders(createClearedSessionCookie())
  );
};
