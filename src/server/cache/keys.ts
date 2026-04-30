export function publishedPageKey(slug: string): string {
  return `page:published:${slug}`;
}

export function variantManifestKey(pageId: string): string {
  return `page:variant-manifest:${pageId}`;
}
