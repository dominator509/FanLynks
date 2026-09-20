import { errorJson, json, readJson, setCookieHeaders } from '../_utils';
import { createSessionCookie } from '../../../src/server/auth/session';
import { hashPassword, needsRehash, verifyPassword } from '../../../src/server/auth/password';
import { verifyTurnstileToken } from '../../../src/server/auth/turnstile';
import { makeId } from '../../../src/server/db/ids';
import { checkRateLimit } from '../../../src/server/security/rateLimit';
import { getClientIp, sha256Hex } from '../../../src/server/security/request';

interface LoginBody {
  email?: string;
  password?: string;
  turnstileToken?: string;
}

interface LoginUserRow {
  id: string;
  email: string;
  password_hash: string;
  tenant_id: string;
  session_version: number;
  failed_login_count: number;
  locked_until: string | null;
}

const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_IP_LIMIT = 20;
const LOGIN_EMAIL_LIMIT = 10;
const USER_LOCK_FAILURES = 5;
const USER_LOCK_SECONDS = 15 * 60;

async function auditLogin(args: {
  db: D1Database;
  user: LoginUserRow | null;
  email: string;
  ip: string;
  userAgent: string;
  success: boolean;
  eventType: string;
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
    args.eventType,
    await sha256Hex(args.email),
    await sha256Hex(args.ip),
    args.userAgent ? await sha256Hex(args.userAgent) : null,
    args.success ? 1 : 0,
    JSON.stringify(args.detail ?? {}),
    new Date().toISOString()
  ).run();
}

async function recordFailedLogin(args: {
  db: D1Database;
  user: LoginUserRow | null;
  email: string;
  ip: string;
  userAgent: string;
  reason: string;
}): Promise<void> {
  const statements: D1PreparedStatement[] = [];
  let lockedUntil: string | null = null;

  if (args.user) {
    const nextCount = Number(args.user.failed_login_count || 0) + 1;
    lockedUntil = nextCount >= USER_LOCK_FAILURES
      ? new Date(Date.now() + USER_LOCK_SECONDS * 1000).toISOString()
      : null;

    statements.push(args.db.prepare(`
      UPDATE users
      SET failed_login_count = ?,
          locked_until = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(nextCount, lockedUntil, new Date().toISOString(), args.user.id));
  }

  statements.push(args.db.prepare(`
    INSERT INTO security_events (
      id, tenant_id, user_id, event_type, identifier_hash, ip_hash, user_agent_hash, success, detail_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    makeId('secevt'),
    args.user?.tenant_id ?? null,
    args.user?.id ?? null,
    'admin_login_failed',
    await sha256Hex(args.email),
    await sha256Hex(args.ip),
    args.userAgent ? await sha256Hex(args.userAgent) : null,
    0,
    JSON.stringify({ reason: args.reason, lockedUntil }),
    new Date().toISOString()
  ));

  await args.db.batch(statements);
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = (await readJson(context.request, { maxBytes: 4096 })) as LoginBody | null;
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password ?? '';
  const turnstileToken = body?.turnstileToken ?? '';
  const ip = getClientIp(context.request);
  const userAgent = context.request.headers.get('user-agent') ?? '';

  if (!email || !password || !turnstileToken) {
    return errorJson('Missing email, password, or Turnstile token.', 400);
  }

  const [ipLimit, emailLimit] = await Promise.all([
    checkRateLimit({
      kv: context.env.PAGE_CACHE,
      key: `rl:login:ip:${await sha256Hex(ip)}`,
      limit: LOGIN_IP_LIMIT,
      windowSeconds: LOGIN_WINDOW_SECONDS
    }),
    checkRateLimit({
      kv: context.env.PAGE_CACHE,
      key: `rl:login:email:${await sha256Hex(email)}`,
      limit: LOGIN_EMAIL_LIMIT,
      windowSeconds: LOGIN_WINDOW_SECONDS
    })
  ]);

  if (!ipLimit.allowed || !emailLimit.allowed) {
    await auditLogin({
      db: context.env.DB,
      user: null,
      email,
      ip,
      userAgent,
      success: false,
      eventType: 'admin_login_rate_limited',
      detail: {
        ipRetryAfterSeconds: ipLimit.retryAfterSeconds,
        emailRetryAfterSeconds: emailLimit.retryAfterSeconds
      }
    });

    return errorJson('Too many login attempts. Try again later.', 429, {
      retryAfterSeconds: Math.max(ipLimit.retryAfterSeconds, emailLimit.retryAfterSeconds)
    });
  }

  const turnstile = await verifyTurnstileToken({
    secretKey: context.env.TURNSTILE_SECRET_KEY,
    token: turnstileToken,
    ip,
    expectedAction: 'admin_login'
  });

  if (!turnstile.ok) {
    await auditLogin({
      db: context.env.DB,
      user: null,
      email,
      ip,
      userAgent,
      success: false,
      eventType: 'admin_login_turnstile_failed',
      detail: { codes: turnstile.errors }
    });

    return errorJson('Turnstile verification failed.', 403, { codes: turnstile.errors });
  }

  const user = await context.env.DB.prepare(`
    SELECT
      u.id,
      u.email,
      u.password_hash,
      u.session_version,
      u.failed_login_count,
      u.locked_until,
      t.id AS tenant_id
    FROM users u
    JOIN tenants t ON t.owner_user_id = u.id
    WHERE lower(u.email) = ? AND u.is_active = 1
    LIMIT 1
  `)
    .bind(email)
    .first<LoginUserRow>();

  if (!user) {
    await recordFailedLogin({
      db: context.env.DB,
      user: null,
      email,
      ip,
      userAgent,
      reason: 'unknown_user'
    });

    return errorJson('Invalid credentials.', 401);
  }

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    await auditLogin({
      db: context.env.DB,
      user,
      email,
      ip,
      userAgent,
      success: false,
      eventType: 'admin_login_locked',
      detail: { lockedUntil: user.locked_until }
    });

    return errorJson('Account is temporarily locked. Try again later.', 423);
  }

  const validPassword = await verifyPassword(password, user.password_hash);
  if (!validPassword) {
    await recordFailedLogin({
      db: context.env.DB,
      user,
      email,
      ip,
      userAgent,
      reason: 'bad_password'
    });

    return errorJson('Invalid credentials.', 401);
  }

  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    context.env.DB.prepare(`
      UPDATE users
      SET last_login_at = ?,
          failed_login_count = 0,
          locked_until = NULL,
          updated_at = ?
      WHERE id = ?
    `).bind(now, now, user.id),
    context.env.DB.prepare(`
      INSERT INTO security_events (
        id, tenant_id, user_id, event_type, identifier_hash, ip_hash, user_agent_hash, success, detail_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      makeId('secevt'),
      user.tenant_id,
      user.id,
      'admin_login_success',
      await sha256Hex(email),
      await sha256Hex(ip),
      userAgent ? await sha256Hex(userAgent) : null,
      1,
      JSON.stringify({}),
      now
    )
  ];

  // Transparently upgrade hashes created with an older (lower) iteration
  // count now that the plaintext password is available.
  if (needsRehash(user.password_hash)) {
    statements.push(
      context.env.DB.prepare(`
        UPDATE users
        SET password_hash = ?,
            updated_at = ?
        WHERE id = ?
      `).bind(await hashPassword(password), now, user.id)
    );
  }

  await context.env.DB.batch(statements);

  const sessionCookie = await createSessionCookie(
    {
      userId: user.id,
      tenantId: user.tenant_id,
      email: user.email,
      sessionVersion: Number(user.session_version)
    },
    context.env.SESSION_SECRET
  );

  return json(
    {
      ok: true,
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenant_id
      }
    },
    200,
    setCookieHeaders(sessionCookie)
  );
};
