import { json } from '../_utils';
import { isKnownTurnstileTestKey } from '../../../src/server/auth/turnstile';

export const onRequestGet: PagesFunction<Env> = async (context) => json({
  ok: true,
  turnstileSiteKey: isKnownTurnstileTestKey(context.env.TURNSTILE_SITE_KEY) ? null : context.env.TURNSTILE_SITE_KEY || null,
  signupMode: context.env.CUSTOMER_SIGNUP_MODE === 'open' ? 'open' : 'invite_only'
});
