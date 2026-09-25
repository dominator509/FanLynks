import { errorJson, json, setCookieHeaders } from '../_utils';
import { clearCustomerSessionCookie } from '../../../src/server/auth/customer-session';
import { isSameOriginMutation } from '../../../src/server/auth/customer';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!isSameOriginMutation(context.request)) return errorJson('Invalid request origin.', 403);
  return json({ ok: true, loggedOut: true }, 200, setCookieHeaders(clearCustomerSessionCookie()));
};
