import { collectAndPersistEvent } from '../../../src/server/analytics/collector';
import { forwardEventIfAllowed } from '../../../src/server/analytics/forwarding';
import { resolveEffectivePrivacyStateForRequest } from '../../../src/server/privacy/state';
import { errorJson, getCookie, json, makeSessionCookie, makeVisitorCookie, readJson, setCookieHeaders } from '../_utils';
import type { EventIngestRequest } from '../../../src/shared/types/events';
import { checkRateLimit } from '../../../src/server/security/rateLimit';
import { getClientIp, sha256Hex } from '../../../src/server/security/request';

const PUBLIC_EVENT_NAMES = new Set([
  'page_view',
  'announcement_click',
  'hero_cta_click',
  'link_click',
  'social_click',
  'experiment_assigned'
]);

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = (await readJson(context.request, { maxBytes: 8192 })) as EventIngestRequest | null;
  const visitor = makeVisitorCookie(getCookie(context.request, 'clh_vid'));
  const session = makeSessionCookie(getCookie(context.request, 'clh_sid'));

  if (!body || typeof body !== 'object') return errorJson('Invalid event payload.', 400);
  if (typeof body.event_name !== 'string' || !PUBLIC_EVENT_NAMES.has(body.event_name)) {
    return errorJson('Invalid event_name.', 400);
  }

  const pageId = body?.page_id;
  if (!pageId && !body?.page_slug) {
    return errorJson('Missing page_id or page_slug.', 400);
  }

  try {
    const probePage = pageId
      ? await context.env.DB.prepare(`SELECT id FROM pages WHERE id = ? LIMIT 1`).bind(pageId).first<{ id: string }>()
      : await context.env.DB.prepare(`SELECT id FROM pages WHERE slug = ? LIMIT 1`).bind(body?.page_slug).first<{ id: string }>();

    if (!probePage?.id) return errorJson('Page not found.', 404);

    const ip = getClientIp(context.request);
    const limit = await checkRateLimit({
      kv: context.env.PAGE_CACHE,
      key: `rl:event:${probePage.id}:${await sha256Hex(ip)}:${await sha256Hex(session.sessionId)}`,
      limit: 180,
      windowSeconds: 60
    });
    if (!limit.allowed) {
      return errorJson('Too many events. Try again later.', 429, {
        retryAfterSeconds: limit.retryAfterSeconds
      });
    }

    const privacy = await resolveEffectivePrivacyStateForRequest({
      db: context.env.DB,
      request: context.request,
      pageId: probePage.id,
      visitorKey: visitor.visitorKey
    });

    const stored = await collectAndPersistEvent({
      db: context.env.DB,
      body,
      countryCode: privacy.countryCode,
      regionPolicy: privacy.regionPolicy,
      analyticsConsent: privacy.analyticsConsent,
      adsConsent: privacy.adsConsent,
      gpcDetected: privacy.gpcDetected,
      sessionId: session.sessionId,
      request: context.request
    });

    const forwarding = await forwardEventIfAllowed(context.env, stored.payload);

    return json(
      {
        ok: true,
        stored: true,
        eventId: stored.eventId,
        event: stored.payload,
        forwarding
      },
      202,
      setCookieHeaders(visitor.setCookie, session.setCookie)
    );
  } catch (error) {
    return errorJson(error instanceof Error ? error.message : 'Unable to store event.', 400);
  }
};
