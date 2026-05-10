import { makeId } from '../../../src/server/db/ids';
import { resolveEffectivePrivacyStateForRequest } from '../../../src/server/privacy/state';
import { errorJson, getCookie, json, makeSessionCookie, makeVisitorCookie, readJson, setCookieHeaders } from '../_utils';
import { checkRateLimit } from '../../../src/server/security/rateLimit';
import { getClientIp, sha256Hex } from '../../../src/server/security/request';

interface ConsentBody {
  page_id?: string;
  analytics?: 'unknown' | 'granted' | 'denied';
  advertising?: 'unknown' | 'granted' | 'denied';
  banner_version?: string;
}

const ALLOWED = new Set(['unknown', 'granted', 'denied']);

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = (await readJson(context.request, { maxBytes: 4096 })) as ConsentBody | null;
  if (!body || typeof body !== 'object') return errorJson('Invalid consent payload.', 400);

  const pageId = body?.page_id;
  if (!pageId || typeof pageId !== 'string' || pageId.length > 120) return errorJson('Missing page_id.', 400);

  const page = await context.env.DB.prepare(`SELECT id, tenant_id, slug FROM pages WHERE id = ? LIMIT 1`).bind(pageId).first<{ id: string; tenant_id: string; slug: string }>();
  if (!page?.id) return errorJson('Page not found.', 404);

  const analytics = ALLOWED.has(body?.analytics ?? '') ? (body?.analytics as 'unknown' | 'granted' | 'denied') : 'unknown';
  const advertising = ALLOWED.has(body?.advertising ?? '') ? (body?.advertising as 'unknown' | 'granted' | 'denied') : 'unknown';
  const bannerVersion = typeof body?.banner_version === 'string'
    ? body.banner_version.trim().slice(0, 32) || 'v1'
    : 'v1';

  const visitor = makeVisitorCookie(getCookie(context.request, 'clh_vid'));
  const session = makeSessionCookie(getCookie(context.request, 'clh_sid'));

  const limit = await checkRateLimit({
    kv: context.env.PAGE_CACHE,
    key: `rl:consent:${pageId}:${await sha256Hex(getClientIp(context.request))}:${await sha256Hex(visitor.visitorKey)}`,
    limit: 30,
    windowSeconds: 15 * 60
  });
  if (!limit.allowed) {
    return errorJson('Too many consent updates. Try again later.', 429, {
      retryAfterSeconds: limit.retryAfterSeconds
    });
  }

  const privacy = await resolveEffectivePrivacyStateForRequest({
    db: context.env.DB,
    request: context.request,
    pageId,
    visitorKey: visitor.visitorKey
  });
  const nowIso = new Date().toISOString();

  await context.env.DB.batch([
    context.env.DB.prepare(`
      INSERT INTO consent_records (
        id, page_id, visitor_key, country_code, region_policy, gpc_detected,
        analytics_state, ads_state, banner_version, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      makeId('consent'),
      pageId,
      visitor.visitorKey,
      privacy.countryCode,
      privacy.regionPolicy,
      privacy.gpcDetected ? 1 : 0,
      analytics,
      advertising,
      bannerVersion,
      nowIso
    ),
    context.env.DB.prepare(`
      INSERT INTO events (
        id, tenant_id, page_id, experiment_id, variant_id, event_name, event_payload_json, occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      makeId('evt'),
      page.tenant_id,
      pageId,
      null,
      null,
      'consent_updated',
      JSON.stringify({
        tenant_id: page.tenant_id,
        page_id: pageId,
        page_slug: page.slug,
        event_name: 'consent_updated',
        country_code: privacy.countryCode,
        region_policy: privacy.regionPolicy,
        consent_analytics: analytics,
        consent_ads: advertising,
        gpc_detected: privacy.gpcDetected,
        session_id: session.sessionId,
        occurred_at: nowIso,
        banner_version: bannerVersion
      }),
      nowIso
    )
  ]);

  return json(
    {
      ok: true,
      saved: true,
      consent: {
        analytics,
        advertising
      }
    },
    200,
    setCookieHeaders(visitor.setCookie, session.setCookie)
  );
};
