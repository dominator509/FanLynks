import { errorJson, json, readJson, setCookieHeaders } from '../_utils';
import { createSessionCookie } from '../../../src/server/auth/session';
import { verifyPassword } from '../../../src/server/auth/password';
import { verifyTurnstileToken } from '../../../src/server/auth/turnstile';

interface LoginBody {
  email?: string;
  password?: string;
  turnstileToken?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = (await readJson(context.request)) as LoginBody | null;
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password ?? '';
  const turnstileToken = body?.turnstileToken ?? '';

  if (!email || !password || !turnstileToken) {
    return errorJson('Missing email, password, or Turnstile token.', 400);
  }

  const ip = context.request.headers.get('CF-Connecting-IP');
  const turnstile = await verifyTurnstileToken({
    secretKey: context.env.TURNSTILE_SECRET_KEY,
    token: turnstileToken,
    ip,
    expectedAction: 'admin_login'
  });

  if (!turnstile.ok) {
    return errorJson('Turnstile verification failed.', 403, { codes: turnstile.errors });
  }

  const user = await context.env.DB.prepare(`
    SELECT u.id, u.email, u.password_hash, t.id AS tenant_id
    FROM users u
    JOIN tenants t ON t.owner_user_id = u.id
    WHERE lower(u.email) = ? AND u.is_active = 1
    LIMIT 1
  `)
    .bind(email)
    .first<{ id: string; email: string; password_hash: string; tenant_id: string }>();

  if (!user) {
    return errorJson('Invalid credentials.', 401);
  }

  const validPassword = await verifyPassword(password, user.password_hash);
  if (!validPassword) {
    return errorJson('Invalid credentials.', 401);
  }

  await context.env.DB.prepare(`UPDATE users SET last_login_at = ? WHERE id = ?`).bind(new Date().toISOString(), user.id).run();

  const sessionCookie = await createSessionCookie(
    {
      userId: user.id,
      tenantId: user.tenant_id,
      email: user.email
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
