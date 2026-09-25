import { errorJson, json, setCookieHeaders } from '../_utils';
import { validateCustomerSession, createCustomerSessionCookie } from '../../../src/server/auth/customer-session';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await validateCustomerSession({ request: context.request, secret: context.env.SESSION_SECRET, db: context.env.DB });
  if (!session) return errorJson('Customer session expired. Please sign in again.', 401);
  const cookie = await createCustomerSessionCookie({ userId: session.userId, tenantId: session.tenantId, email: session.email, sessionVersion: session.sessionVersion }, context.env.SESSION_SECRET);
  return json({
    ok: true,
    authenticated: true,
    user: {
      id: session.userId,
      email: session.email,
      tenantId: session.tenantId,
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    }
  }, 200, setCookieHeaders(cookie));
};
