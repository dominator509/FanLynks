import { publishedPageKey, variantManifestKey } from '../cache/keys';
import { buildPublishedPagePayloadById } from './payload';

export async function refreshPublishedPageCache(args: {
  db: D1Database;
  cache: KVNamespace;
  pageId: string;
  nowIso?: string;
}): Promise<{ slug: string; publishedVersion: number; hasExperiment: boolean }> {
  const nowIso = args.nowIso ?? new Date().toISOString();
  try {
    const refreshed = await buildPublishedPagePayloadById(args.db, args.pageId, nowIso);
    if (!refreshed) throw new Error('Unable to rebuild page snapshot.');

    await args.cache.put(
      publishedPageKey(refreshed.payload.page.slug),
      JSON.stringify({
        payload: refreshed.payload,
        pageId: refreshed.pageId,
        tenantId: refreshed.tenantId
      })
    );

    if (refreshed.payload.experiment) {
      await args.cache.put(
        variantManifestKey(args.pageId),
        JSON.stringify({
          experimentId: refreshed.payload.experiment.id,
          variants: refreshed.payload.experiment.variants.map((variant) => ({
            variantId: variant.variantId,
            variantName: variant.variantName
          })),
          generatedAt: nowIso
        })
      );
    } else {
      await args.cache.delete(variantManifestKey(args.pageId));
    }

    return {
      slug: refreshed.payload.page.slug,
      publishedVersion: refreshed.payload.page.publishedVersion,
      hasExperiment: Boolean(refreshed.payload.experiment)
    };
  } catch (error) {
    console.error(JSON.stringify({
      event: 'published_cache_refresh_failed',
      pageId: args.pageId,
      message: error instanceof Error ? error.message : String(error)
    }));
    throw new Error('Published cache refresh failed.');
  }
}
