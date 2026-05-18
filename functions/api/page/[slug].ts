import { errorJson, getCookie, json, makeSessionCookie, makeVisitorCookie, setCookieHeaders } from '../_utils';
import { publishedPageKey } from '../../../src/server/cache/keys';
import { pickWeightedVariant } from '../../../src/server/experiments/assignment';
import type { PublishedPagePayload } from '../../../src/shared/types/page';
import { buildPublishedPagePayloadFromSlug, getActiveAssignment, upsertExperimentAssignment } from '../../../src/server/page/payload';
import { resolveEffectivePrivacyStateForRequest } from '../../../src/server/privacy/state';

interface SnapshotEnvelope {
  payload: PublishedPagePayload;
  pageId: string;
  tenantId: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const slug = context.params.slug as string;
  const visitor = makeVisitorCookie(getCookie(context.request, 'clh_vid'));
  const session = makeSessionCookie(getCookie(context.request, 'clh_sid'));
  const nowIso = new Date().toISOString();

  const cacheKey = publishedPageKey(slug);
  let snapshot = await context.env.PAGE_CACHE.get<SnapshotEnvelope>(cacheKey, 'json');

  if (!snapshot) {
    const built = await buildPublishedPagePayloadFromSlug(context.env.DB, slug, nowIso);
    if (!built) return errorJson('Page not found.', 404);
    snapshot = {
      payload: built.payload,
      pageId: built.pageId,
      tenantId: built.tenantId
    };
    await context.env.PAGE_CACHE.put(cacheKey, JSON.stringify(snapshot));
  }

  const effectivePrivacy = await resolveEffectivePrivacyStateForRequest({
    db: context.env.DB,
    request: context.request,
    pageId: snapshot.pageId,
    visitorKey: visitor.visitorKey
  });

  let assignedVariant: { experimentId: string; variantId: string; variantName: string; weight: number; tokens: Record<string, unknown>; contentOverrides?: Record<string, unknown> | null } | null = null;
  const experiment = snapshot.payload.experiment;
  if (experiment) {
    const activeAssignment = await getActiveAssignment({
      db: context.env.DB,
      pageId: snapshot.pageId,
      experimentId: experiment.id,
      visitorKey: visitor.visitorKey,
      nowIso
    });

    if (activeAssignment) {
      const variant = experiment.variants.find((row) => row.variantId === activeAssignment.variantId);
      if (variant) {
        assignedVariant = {
          experimentId: variant.experimentId,
          variantId: variant.variantId,
          variantName: variant.variantName,
          weight: variant.weight,
          tokens: variant.tokens,
          contentOverrides: variant.contentOverrides ?? null
        };
      }
    }

    if (!assignedVariant && experiment.variants.length > 0) {
      const selectedVariantId = pickWeightedVariant(
        experiment.variants.map((variant) => ({
          variantId: variant.variantId,
          weight: variant.weight
        }))
      ) ?? experiment.variants[0].variantId;

      const variant = experiment.variants.find((row) => row.variantId === selectedVariantId) ?? experiment.variants[0];
      assignedVariant = {
        experimentId: variant.experimentId,
        variantId: variant.variantId,
        variantName: variant.variantName,
        weight: variant.weight,
        tokens: variant.tokens,
        contentOverrides: variant.contentOverrides ?? null
      };

      const persistedAssignment = await upsertExperimentAssignment({
        db: context.env.DB,
        pageId: snapshot.pageId,
        experimentId: experiment.id,
        visitorKey: visitor.visitorKey,
        variantId: variant.variantId,
        ttlDays: experiment.assignmentTtlDays
      });

      if (persistedAssignment.variantId !== variant.variantId) {
        const persistedVariant = experiment.variants.find((row) => row.variantId === persistedAssignment.variantId);
        if (persistedVariant) {
          assignedVariant = {
            experimentId: persistedVariant.experimentId,
            variantId: persistedVariant.variantId,
            variantName: persistedVariant.variantName,
            weight: persistedVariant.weight,
            tokens: persistedVariant.tokens,
            contentOverrides: persistedVariant.contentOverrides ?? null
          };
        }
      }
    }
  }

  return json(
    {
      ok: true,
      slug,
      page: snapshot.payload.page,
      sections: snapshot.payload.sections,
      links: snapshot.payload.links,
      integrations: snapshot.payload.integrations,
      experiment: assignedVariant,
      privacy: effectivePrivacy,
      session: {
        visitorKey: visitor.visitorKey,
        sessionId: session.sessionId
      },
      meta: {
        cached: true,
        generatedAt: snapshot.payload.generatedAt
      }
    },
    200,
    setCookieHeaders(visitor.setCookie, session.setCookie)
  );
};
