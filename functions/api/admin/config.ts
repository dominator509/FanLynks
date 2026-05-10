import { json } from '../_utils';
import { isKnownTurnstileTestKey } from '../../../src/server/auth/turnstile';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  return json({
    ok: true,
    turnstileSiteKey: isKnownTurnstileTestKey(context.env.TURNSTILE_SITE_KEY)
      ? null
      : context.env.TURNSTILE_SITE_KEY || null
  });
};
