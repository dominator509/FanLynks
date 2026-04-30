import { errorJson, getCookie, json, makeVisitorCookie, setCookieHeaders } from '../_utils';
import { resolveEffectivePrivacyStateForRequest } from '../../../src/server/privacy/state';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const pageId = new URL(context.request.url).searchParams.get('page_id');
  if (!pageId) return errorJson('Missing page_id.', 400);

  const page = await context.env.DB.prepare(`SELECT id FROM pages WHERE id = ? LIMIT 1`).bind(pageId).first<{ id: string }>();
  if (!page?.id) return errorJson('Page not found.', 404);

  const visitor = makeVisitorCookie(getCookie(context.request, 'clh_vid'));
  const privacy = await resolveEffectivePrivacyStateForRequest({
    db: context.env.DB,
    request: context.request,
    pageId,
    visitorKey: visitor.visitorKey
  });

  return json(
    {
      ok: true,
      regionPolicy: privacy.regionPolicy,
      countryCode: privacy.countryCode,
      gpcDetected: privacy.gpcDetected,
      consent: {
        analytics: privacy.analyticsConsent,
        advertising: privacy.adsConsent
      }
    },
    200,
    setCookieHeaders(visitor.setCookie)
  );
};
