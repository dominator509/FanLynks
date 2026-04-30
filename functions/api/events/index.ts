import { collectAndPersistEvent } from '../../../src/server/analytics/collector';
import { forwardEventIfAllowed } from '../../../src/server/analytics/forwarding';
import { resolveEffectivePrivacyStateForRequest } from '../../../src/server/privacy/state';
import { errorJson, getCookie, json, makeSessionCookie, makeVisitorCookie, readJson, setCookieHeaders } from '../_utils';
import type { EventIngestRequest } from '../../../src/shared/types/events';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = (await readJson(context.request)) as EventIngestRequest | null;
  const visitor = makeVisitorCookie(getCookie(context.request, 'clh_vid'));
  const session = makeSessionCookie(getCookie(context.request, 'clh_sid'));

  const pageId = body?.page_id;
  if (!pageId && !body?.page_slug) {
    return errorJson('Missing page_id or page_slug.', 400);
  }

  try {
    const probePage = pageId
      ? await context.env.DB.prepare(`SELECT id FROM pages WHERE id = ? LIMIT 1`).bind(pageId).first<{ id: string }>()
      : await context.env.DB.prepare(`SELECT id FROM pages WHERE slug = ? LIMIT 1`).bind(body?.page_slug).first<{ id: string }>();

    if (!probePage?.id) return errorJson('Page not found.', 404);

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
