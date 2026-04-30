import { json, setCookieHeaders } from '../_utils';
import { createClearedSessionCookie } from '../../../src/server/auth/session';

export const onRequestPost: PagesFunction = async () => {
  return json({ ok: true, loggedOut: true }, 200, setCookieHeaders(createClearedSessionCookie()));
};
