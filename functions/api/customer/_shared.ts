import { errorJson } from '../_utils';
import { getClientIp, sha256Hex } from '../../../src/server/security/request';
import { checkRateLimit } from '../../../src/server/security/rateLimit';
import { validateCustomerSession } from '../../../src/server/auth/customer-session';
import { makeId } from '../../../src/server/db/ids';
import { refreshPublishedPageCache } from '../../../src/server/page/cache';

export async function rejectIfRateLimited(args: {
  env: Env; ip: string; identifier: string; action: string; ipLimit: number; identifierLimit: number; windowSeconds: number;
}): Promise<Response | null> {
  const [ipResult, identityResult] = await Promise.all([
    checkRateLimit({ kv: args.env.PAGE_CACHE, key: `rl:customer:${args.action}:ip:${await sha256Hex(args.ip)}`, limit: args.ipLimit, windowSeconds: args.windowSeconds }),
    checkRateLimit({ kv: args.env.PAGE_CACHE, key: `rl:customer:${args.action}:identity:${await sha256Hex(args.identifier)}`, limit: args.identifierLimit, windowSeconds: args.windowSeconds })
  ]);
  if (ipResult.allowed && identityResult.allowed) return null;
  return errorJson('Too many requests. Try again later.', 429, {
    retryAfterSeconds: Math.max(ipResult.retryAfterSeconds, identityResult.retryAfterSeconds)
  });
}

export async function rejectIfIpLimited(args: { env: Env; ip: string; action: string; limit: number; windowSeconds: number }): Promise<Response | null> {
  const result = await checkRateLimit({
    kv: args.env.PAGE_CACHE,
    key: `rl:customer:${args.action}:ip:${await sha256Hex(args.ip)}`,
    limit: args.limit,
    windowSeconds: args.windowSeconds
  });
  return result.allowed ? null : errorJson('Too many requests. Try again later.', 429, { retryAfterSeconds: result.retryAfterSeconds });
}

export function requestIp(request: Request): string {
  return getClientIp(request);
}

export function sameOriginRequired(request: Request): Response | null {
  const origin = request.headers.get('origin');
  return origin && origin === new URL(request.url).origin ? null : errorJson('Invalid request origin.', 403);
}

export async function sendCustomerEmail(env: Env, args: { to: string; type: 'invite' | 'verify_email' | 'password_reset'; url: string }): Promise<boolean> {
  if (!env.MAILER || !env.APP_ORIGIN) return false;
  try {
    const response = await env.MAILER.fetch(new Request('https://fanlynks-mailer.internal/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(args)
    }));
    return response.ok;
  } catch {
    return false;
  }
}

export function customerActionUrl(env: Env, path: '/verify-email' | '/reset-password', token: string): string | null {
  const origin = configuredAppOrigin(env);
  if (!origin) return null;
  const url = new URL(path, origin);
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}

export function configuredAppOrigin(env: Env): string | null {
  if (!env.APP_ORIGIN) return null;
  try {
    const url = new URL(env.APP_ORIGIN);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function customerSession(context: { request: Request; env: Env }) {
  return validateCustomerSession({ request: context.request, secret: context.env.SESSION_SECRET, db: context.env.DB });
}

export async function getCustomerPage(env: Env, tenantId: string): Promise<{ id: string; slug: string; title: string; subtitle: string | null } | null> {
  return env.DB.prepare(`SELECT id, slug, title, subtitle FROM pages WHERE tenant_id = ? AND is_active = 1 ORDER BY created_at ASC LIMIT 1`)
    .bind(tenantId).first<{ id: string; slug: string; title: string; subtitle: string | null }>();
}

export async function writeCustomerAudit(args: {
  env: Env; session: { userId: string; tenantId: string }; action: string; targetType: string; targetId: string; diff?: Record<string, unknown>;
}): Promise<void> {
  await args.env.DB.prepare(`
    INSERT INTO audit_log (id, tenant_id, user_id, action, target_type, target_id, diff_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(makeId('audit'), args.session.tenantId, args.session.userId, args.action, args.targetType, args.targetId,
    JSON.stringify(args.diff ?? {}), new Date().toISOString()).run();
}

export async function refreshCustomerPage(env: Env, pageId: string): Promise<void> {
  await refreshPublishedPageCache({ db: env.DB, cache: env.PAGE_CACHE, pageId });
}

export async function writeCustomerSecurityEvent(args: {
  env: Env; email: string; ip: string; userAgent: string; eventType: string; success?: boolean; userId?: string | null; tenantId?: string | null; detail?: Record<string, unknown>;
}): Promise<void> {
  await args.env.DB.prepare(`
    INSERT INTO security_events (
      id, tenant_id, user_id, event_type, identifier_hash, ip_hash, user_agent_hash, success, detail_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    makeId('secevt'), args.tenantId ?? null, args.userId ?? null, args.eventType,
    await sha256Hex(args.email), await sha256Hex(args.ip), args.userAgent ? await sha256Hex(args.userAgent) : null,
    args.success ? 1 : 0, JSON.stringify(args.detail ?? {}), new Date().toISOString()
  ).run();
}
