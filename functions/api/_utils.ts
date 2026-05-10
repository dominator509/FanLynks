export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('content-type', 'application/json; charset=utf-8');

  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: responseHeaders
  });
}

export class RequestValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'RequestValidationError';
    this.status = status;
  }
}

export async function readJson(request: Request, options: { maxBytes?: number } = {}): Promise<any> {
  const maxBytes = options.maxBytes ?? 64 * 1024;
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;

  const contentLength = request.headers.get('content-length');
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new RequestValidationError('Request body is too large.', 413);
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new RequestValidationError('Request body is too large.', 413);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new RequestValidationError('Invalid JSON body.', 400);
  }
}

export function errorJson(message: string, status = 400, extra?: Record<string, unknown>): Response {
  return json({ ok: false, error: message, ...extra }, status);
}

export function getCookie(request: Request, name: string): string | null {
  const raw = request.headers.get('cookie');
  if (!raw) return null;
  for (const entry of raw.split(';')) {
    const [cookieName, ...rest] = entry.trim().split('=');
    if (cookieName === name) return rest.join('=');
  }
  return null;
}

export function setCookieHeaders(...cookies: Array<string | null | undefined>): Headers {
  const headers = new Headers();
  for (const cookie of cookies) {
    if (cookie) headers.append('Set-Cookie', cookie);
  }
  return headers;
}

export function makeVisitorCookie(existing: string | null): { visitorKey: string; setCookie: string | null } {
  if (existing) return { visitorKey: existing, setCookie: null };
  const visitorKey = crypto.randomUUID();
  return {
    visitorKey,
    setCookie: `clh_vid=${visitorKey}; Path=/; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`
  };
}

export function makeSessionCookie(existing: string | null): { sessionId: string; setCookie: string } {
  const sessionId = existing || crypto.randomUUID();
  return {
    sessionId,
    setCookie: `clh_sid=${sessionId}; Path=/; Secure; SameSite=Lax; Max-Age=${60 * 30}`
  };
}
