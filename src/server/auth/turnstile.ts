export interface TurnstileVerificationResult {
  ok: boolean;
  errors: string[];
  action?: string;
  cdata?: string;
  hostname?: string;
}

interface TurnstileSiteverifyResponse {
  success: boolean;
  'error-codes'?: string[];
  action?: string;
  cdata?: string;
  hostname?: string;
}

export async function verifyTurnstileToken(args: {
  secretKey: string;
  token: string;
  ip?: string | null;
  expectedAction?: string;
}): Promise<TurnstileVerificationResult> {
  const body = new URLSearchParams();
  body.set('secret', args.secretKey);
  body.set('response', args.token);
  if (args.ip) body.set('remoteip', args.ip);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  if (!response.ok) {
    return {
      ok: false,
      errors: [`siteverify_http_${response.status}`]
    };
  }

  const payload = (await response.json()) as TurnstileSiteverifyResponse;
  const errors = payload['error-codes'] ?? [];
  const actionMismatch = args.expectedAction && payload.action && payload.action !== args.expectedAction;

  return {
    ok: Boolean(payload.success) && !actionMismatch,
    errors: actionMismatch ? [...errors, 'action_mismatch'] : errors,
    action: payload.action,
    cdata: payload.cdata,
    hostname: payload.hostname
  };
}
