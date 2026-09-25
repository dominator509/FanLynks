interface EmailRequest {
  to?: unknown;
  type?: unknown;
  url?: unknown;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character] ?? character));
}

function validEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function validActionUrl(value: unknown, origin: string): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === origin && !url.username && !url.password;
  } catch {
    return false;
  }
}

function mailContent(type: 'invite' | 'verify_email' | 'password_reset', url: string) {
  const title = type === 'invite' ? 'Your Fan Lynks beta invitation' : type === 'verify_email' ? 'Confirm your Fan Lynks email' : 'Reset your Fan Lynks password';
  const action = type === 'invite' ? 'Accept invitation' : type === 'verify_email' ? 'Confirm email' : 'Reset password';
  const purpose = type === 'invite'
    ? 'You have been invited to create a Fan Lynks customer account. This invitation is valid for seven days and is tied to your email address.'
    : type === 'verify_email'
      ? 'Confirm this email address to activate your Fan Lynks customer account.'
      : 'Use this one-time link to choose a new password for your Fan Lynks customer account.';
  const safeUrl = escapeHtml(url);
  return {
    subject: title,
    text: `${purpose}\n\n${action}: ${url}\n\nIf you did not request this, you can ignore this message.`,
    html: `<!doctype html><html lang="en"><body style="margin:0;background:#050505;color:#f7f4ee;font-family:Arial,sans-serif;padding:32px"><main style="max-width:560px;margin:auto;background:#111;border:1px solid #302819;border-radius:14px;padding:32px"><p style="color:#cfa029;font-weight:bold;letter-spacing:.08em;text-transform:uppercase">Fan Lynks</p><h1 style="font-size:24px">${title}</h1><p style="color:#c8c2b5;line-height:1.6">${purpose}</p><p><a href="${safeUrl}" style="display:inline-block;background:#cfa029;color:#050505;padding:13px 18px;border-radius:8px;text-decoration:none;font-weight:bold">${action}</a></p><p style="color:#c8c2b5;line-height:1.6">If you did not request this, you can ignore this message.</p><p style="color:#82796d;font-size:12px;word-break:break-all">${safeUrl}</p></main></body></html>`
  };
}

export interface Env {
  EMAIL: SendEmail;
  EMAIL_SENDER: string;
  APP_ORIGIN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/send') return new Response('Not found.', { status: 404 });
    let body: EmailRequest;
    try {
      body = await request.json() as EmailRequest;
    } catch {
      return new Response('Invalid request.', { status: 400 });
    }
    if (!validEmail(body.to) || (body.type !== 'invite' && body.type !== 'verify_email' && body.type !== 'password_reset') || !validActionUrl(body.url, env.APP_ORIGIN)) {
      return new Response('Invalid email request.', { status: 400 });
    }
    try {
      const content = mailContent(body.type, body.url);
      await env.EMAIL.send({
        to: body.to,
        from: { email: env.EMAIL_SENDER, name: 'Fan Lynks' },
        subject: content.subject,
        text: content.text,
        html: content.html
      });
      return new Response(null, { status: 204 });
    } catch {
      return new Response('Email delivery is unavailable.', { status: 503 });
    }
  }
};
