function applySecurityHeaders(request: Request, response: Response): Response {
  const url = new URL(request.url);
  const headers = new Headers(response.headers);
  const isPrivate = url.pathname === '/admin.html'
    || url.pathname.startsWith('/api/admin/')
    || url.pathname.startsWith('/api/customer/')
    || ['/login', '/signup', '/dashboard', '/verify-email', '/forgot-password', '/reset-password', '/resend-verification'].includes(url.pathname);

  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' https: data:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' https://www.googletagmanager.com https://connect.facebook.net https://challenges.cloudflare.com https://static.cloudflareinsights.com",
    "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com https://connect.facebook.net https://challenges.cloudflare.com https://static.cloudflareinsights.com",
    "frame-src https://challenges.cloudflare.com",
    "upgrade-insecure-requests"
  ].join('; '));

  if (isPrivate) {
    headers.set('Cache-Control', 'no-store');
    headers.set('Pragma', 'no-cache');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function canonicalRedirect(request: Request): Response | null {
  const url = new URL(request.url);
  const isFanLynksHost = url.hostname === 'fanlynks.com' || url.hostname === 'www.fanlynks.com';
  if (!isFanLynksHost) return null;

  const shouldUseApex = url.hostname === 'www.fanlynks.com';
  const shouldUseRoot = url.pathname === '/home' || url.pathname === '/index.html';
  if (!shouldUseApex && !shouldUseRoot) return null;

  if (shouldUseApex) url.hostname = 'fanlynks.com';
  if (shouldUseRoot) url.pathname = '/';

  return new Response(null, {
    status: 301,
    headers: {
      location: url.toString()
    }
  });
}

export const onRequest: PagesFunction = async (context) => {
  try {
    const redirect = canonicalRedirect(context.request);
    if (redirect) return applySecurityHeaders(context.request, redirect);

    const response = await context.next();
    return applySecurityHeaders(context.request, response);
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number'
      ? (error as { status: number }).status
      : 500;
    const message = error instanceof Error && status < 500 ? error.message : 'Request failed.';

    return applySecurityHeaders(
      context.request,
      new Response(JSON.stringify({ ok: false, error: message }), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' }
      })
    );
  }
};
