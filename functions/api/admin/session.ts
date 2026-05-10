import { json, setCookieHeaders } from '../_utils';
import { createSessionCookie, validateAdminSession } from '../../../src/server/auth/session';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await validateAdminSession({
    request: context.request,
    secret: context.env.SESSION_SECRET,
    db: context.env.DB
  });
  const refresh = new URL(context.request.url).searchParams.get('refresh') === '1';

  const headers = session && refresh
    ? setCookieHeaders(await createSessionCookie({
        userId: session.userId,
        tenantId: session.tenantId,
        email: session.email,
        sessionVersion: session.sessionVersion
      }, context.env.SESSION_SECRET))
    : undefined;

  const expiresInMs = session ? Math.max(0, new Date(session.expiresAt).getTime() - Date.now()) : 0;

  return json({
    ok: true,
    authenticated: Boolean(session),
    refreshed: Boolean(session && refresh),
    user: session
      ? {
          id: session.userId,
          email: session.email,
          tenantId: session.tenantId,
          expiresAt: session.expiresAt,
          expiresInMs
        }
      : null
  }, 200, headers);
};
