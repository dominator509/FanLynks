import { describe, expect, it } from 'vitest';
import { publishedPageKey, variantManifestKey } from '../../src/server/cache/keys';
import { refreshPublishedPageCache } from '../../src/server/page/cache';
import { makeD1, makeKV } from '../helpers/mock-cloudflare';

const pageRow = {
  id: 'page_demo',
  tenant_id: 'tenant_1',
  slug: 'join',
  title: 'Fan Lynks',
  subtitle: 'Cleaner creator funnels',
  avatar_url: 'javascript:alert(1)',
  announcement_enabled: 1,
  announcement_text: 'Creator beta',
  announcement_url: 'https://fanlynks.com/join',
  hero_cta_label: 'Join the Creator Beta',
  hero_cta_url: 'https://fanlynks.com/join',
  tracking_mode: 'first_party',
  privacy_mode: 'default_standard',
  published_version: 7,
  page_theme_json: JSON.stringify({ bg: '#050505', accent: '#D4AF37', surface: 'url(https://bad.test/x)' }),
  page_privacy_json: JSON.stringify({ bannerTitle: 'Privacy choices', honorGpc: true })
};

describe('published page cache integration boundary', () => {
  it('builds a sanitized page payload and writes the variant manifest to KV', async () => {
    const db = makeD1([
      { match: 'FROM pages WHERE id = ? AND is_active = 1', first: pageRow },
      { match: 'FROM page_sections', all: [{ id: 'section_main', label: 'Featured', section_order: 1 }] },
      {
        match: 'FROM page_links',
        all: [
          {
            id: 'link_join',
            section_id: 'section_main',
            title: 'Join the Creator Beta',
            subtitle: null,
            url: 'https://fanlynks.com/join',
            icon_type: 'none',
            icon_value: null,
            badge_text: 'Beta',
            style_role: 'primary',
            row_order: 1
          },
          {
            id: 'link_bad',
            section_id: 'section_main',
            title: 'Unsafe Link',
            subtitle: null,
            url: 'javascript:alert(1)',
            icon_type: 'image',
            icon_value: 'javascript:alert(1)',
            badge_text: null,
            style_role: 'secondary',
            row_order: 2
          }
        ]
      },
      {
        match: 'FROM integrations',
        all: [
          { provider: 'ga4', is_enabled: 1, config_json: JSON.stringify({ measurementId: 'G-ABCDE12345', extraSecret: 'nope' }) },
          { provider: 'gtm', is_enabled: 1, config_json: JSON.stringify({ containerId: 'GTM-ABCD1234', advertisingEnabled: false }) }
        ]
      },
      { match: "FROM experiments WHERE page_id = ? AND status = 'live'", first: { id: 'exp_live', assignment_ttl_days: 30 } },
      {
        match: 'FROM experiment_variants',
        all: [
          {
            id: 'variant_a',
            name: 'A',
            weight: 50,
            tokens_json: JSON.stringify({ accent: '#D4AF37', badColor: '#fff' }),
            content_overrides_json: JSON.stringify({ page: { title: 'A title', heroCtaUrl: 'data:text/html,bad' } })
          },
          {
            id: 'variant_b',
            name: 'B',
            weight: 50,
            tokens_json: '{}',
            content_overrides_json: null
          }
        ]
      }
    ]);
    const kv = makeKV();

    await expect(refreshPublishedPageCache({ db, cache: kv, pageId: 'page_demo', nowIso: '2026-05-17T00:00:00.000Z' })).resolves.toEqual({
      slug: 'join',
      publishedVersion: 7,
      hasExperiment: true
    });

    const cached = JSON.parse(kv.values.get(publishedPageKey('join')) ?? '{}');
    expect(cached.pageId).toBe('page_demo');
    expect(cached.payload.page.avatarUrl).toBeNull();
    expect(cached.payload.page.themeTokens).toEqual({ bg: '#050505', accent: '#D4AF37' });
    expect(cached.payload.links).toHaveLength(1);
    expect(cached.payload.links[0].url).toBe('https://fanlynks.com/join');
    expect(cached.payload.integrations[0].config).toEqual({
      measurementId: 'G-ABCDE12345',
      enablePageViews: true,
      enableClickEvents: true,
      enableExperimentParameters: true
    });
    expect(cached.payload.experiment.variants[0].contentOverrides).toEqual({ page: { title: 'A title' } });

    expect(JSON.parse(kv.values.get(variantManifestKey('page_demo')) ?? '{}')).toEqual({
      experimentId: 'exp_live',
      variants: [
        { variantId: 'variant_a', variantName: 'A' },
        { variantId: 'variant_b', variantName: 'B' }
      ],
      generatedAt: '2026-05-17T00:00:00.000Z'
    });
  });

  it('removes a stale variant manifest when no experiment is live', async () => {
    const db = makeD1([
      { match: 'FROM pages WHERE id = ? AND is_active = 1', first: { ...pageRow, slug: 'demo' } },
      { match: 'FROM page_sections', all: [] },
      { match: 'FROM page_links', all: [] },
      { match: 'FROM integrations', all: [] },
      { match: "FROM experiments WHERE page_id = ? AND status = 'live'", first: null }
    ]);
    const kv = makeKV();
    await kv.put(variantManifestKey('page_demo'), '{"old":true}');

    await expect(refreshPublishedPageCache({ db, cache: kv, pageId: 'page_demo' })).resolves.toMatchObject({
      slug: 'demo',
      hasExperiment: false
    });
    expect(kv.values.has(variantManifestKey('page_demo'))).toBe(false);
    expect(kv.deleted).toContain(variantManifestKey('page_demo'));
  });
});
