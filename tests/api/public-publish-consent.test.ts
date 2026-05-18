import { describe, expect, it, vi } from 'vitest';
import { onRequestPost as publishPost } from '../../functions/api/admin/page/[pageId]/publish';
import { onRequestGet as pageGet } from '../../functions/api/page/[slug]';
import { onRequestPost as consentPost } from '../../functions/api/privacy/consent';
import { publishedPageKey, variantManifestKey } from '../../src/server/cache/keys';
import { createSessionCookie } from '../../src/server/auth/session';
import { makeD1, makeKV } from '../helpers/mock-cloudflare';

function context(request: Request, env: Partial<Env>, params: Record<string, string> = {}): EventContext<Env, string, Record<string, string>> {
  return {
    request,
    env: env as Env,
    params,
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    next: vi.fn()
  } as unknown as EventContext<Env, string, Record<string, string>>;
}

async function jsonBody(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

function pageRow(version: number) {
  return {
    id: 'page_demo',
    tenant_id: 'tenant_1',
    slug: 'home',
    title: 'Fan Lynks',
    subtitle: 'Creator funnels',
    avatar_url: null,
    announcement_enabled: 0,
    announcement_text: null,
    announcement_url: null,
    hero_cta_label: 'Join',
    hero_cta_url: 'https://fanlynks.com/join',
    tracking_mode: 'none',
    privacy_mode: 'default_standard',
    published_version: version,
    page_theme_json: '{}',
    page_privacy_json: '{}'
  };
}

describe('public page, publish, and consent API handlers', () => {
  it('publishes an owned page, increments version, writes audit state, and refreshes KV cache', async () => {
    let publishedVersion = 4;
    const batchWrites: unknown[][] = [];
    const db = makeD1([
      {
        match: 'FROM users u JOIN tenants',
        first: { id: 'user_1', email: 'admin@fanlynks.com', session_version: 1, is_active: 1, tenant_id: 'tenant_1' }
      },
      { match: 'FROM pages WHERE id = ? AND is_active = 1', handler: () => pageRow(publishedVersion) },
      { match: 'FROM page_sections', all: [] },
      { match: 'FROM page_links', all: [] },
      { match: 'FROM integrations', all: [] },
      { match: "FROM experiments WHERE page_id = ? AND status = 'live'", first: null },
      {
        match: 'UPDATE pages SET published_version',
        handler: ({ params }) => {
          publishedVersion = params[0] as number;
          batchWrites.push(params);
          return { success: true };
        }
      },
      { match: 'INSERT INTO audit_log', handler: ({ params }) => { batchWrites.push(params); return { success: true }; } }
    ]);
    const kv = makeKV();
    await kv.put(variantManifestKey('page_demo'), '{"stale":true}');
    const cookie = await createSessionCookie({
      userId: 'user_1',
      tenantId: 'tenant_1',
      email: 'admin@fanlynks.com',
      sessionVersion: 1
    }, 'unit-session-secret');

    const response = await publishPost(context(new Request('https://fanlynks.test/api/admin/page/page_demo/publish', {
      method: 'POST',
      headers: { cookie }
    }), {
      DB: db,
      PAGE_CACHE: kv,
      SESSION_SECRET: 'unit-session-secret'
    }, { pageId: 'page_demo' }));

    expect(response.status).toBe(200);
    await expect(jsonBody(response)).resolves.toMatchObject({
      ok: true,
      published: true,
      pageId: 'page_demo',
      slug: 'home',
      publishedVersion: 5,
      cacheRefreshed: true
    });
    expect(batchWrites).toHaveLength(2);
    expect(kv.values.has(publishedPageKey('home'))).toBe(true);
    expect(kv.values.has(variantManifestKey('page_demo'))).toBe(false);
  });

  it('stores consent and emits a consent_updated event with visitor/session cookies', async () => {
    const writes: unknown[][] = [];
    const db = makeD1([
      { match: 'SELECT id, tenant_id, slug FROM pages', first: { id: 'page_demo', tenant_id: 'tenant_1', slug: 'home' } },
      { match: 'SELECT page_privacy_json FROM pages', first: { page_privacy_json: JSON.stringify({ honorGpc: true }) } },
      { match: 'FROM consent_records', first: null },
      { match: 'INSERT INTO consent_records', handler: ({ params }) => { writes.push(params); return { success: true }; } },
      { match: 'INSERT INTO events', handler: ({ params }) => { writes.push(params); return { success: true }; } }
    ]);

    const response = await consentPost(context(new Request('https://fanlynks.test/api/privacy/consent', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'CF-Connecting-IP': '203.0.113.25',
        'CF-IPCountry': 'GB',
        'Sec-GPC': '1'
      },
      body: JSON.stringify({
        page_id: 'page_demo',
        analytics: 'granted',
        advertising: 'denied',
        banner_version: ' production-v1 '
      })
    }), {
      DB: db,
      PAGE_CACHE: makeKV()
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('clh_vid=');
    expect(response.headers.get('set-cookie')).toContain('clh_sid=');
    await expect(jsonBody(response)).resolves.toMatchObject({
      ok: true,
      saved: true,
      consent: { analytics: 'granted', advertising: 'denied' }
    });
    expect(writes).toHaveLength(2);
    expect(writes[0][3]).toBe('GB');
    expect(writes[0][4]).toBe('uk_strict');
    expect(writes[0][6]).toBe('granted');
    expect(writes[0][7]).toBe('denied');
    expect(JSON.parse(writes[1][6] as string)).toMatchObject({
      event_name: 'consent_updated',
      consent_analytics: 'granted',
      consent_ads: 'denied',
      gpc_detected: true
    });
  });

  it('serves public page data from KV when cached and falls back to D1 when missing', async () => {
    const cachedSnapshot = {
      pageId: 'page_demo',
      tenantId: 'tenant_1',
      payload: {
        page: {
          id: 'page_demo',
          tenantId: 'tenant_1',
          slug: 'home',
          title: 'Fan Lynks',
          subtitle: 'Creator funnels',
          avatarUrl: null,
          announcementEnabled: false,
          announcementText: null,
          announcementUrl: null,
          heroCtaLabel: 'Join',
          heroCtaUrl: 'https://fanlynks.com/join',
          trackingMode: 'none',
          privacyMode: 'default_standard',
          publishedVersion: 5,
          themeTokens: {},
          privacyUi: {}
        },
        sections: [],
        links: [],
        integrations: [],
        experiment: null,
        generatedAt: '2026-05-18T00:00:00.000Z'
      }
    };
    const kv = makeKV();
    await kv.put(publishedPageKey('home'), JSON.stringify(cachedSnapshot));
    const privacyRoutes = [
      { match: 'SELECT page_privacy_json FROM pages', first: { page_privacy_json: '{}' } },
      { match: 'FROM consent_records', first: null }
    ];
    const cachedResponse = await pageGet(context(new Request('https://fanlynks.test/api/page/home'), {
      DB: makeD1(privacyRoutes),
      PAGE_CACHE: kv
    }, { slug: 'home' }));

    expect(cachedResponse.status).toBe(200);
    await expect(jsonBody(cachedResponse)).resolves.toMatchObject({
      ok: true,
      slug: 'home',
      page: { title: 'Fan Lynks', publishedVersion: 5 },
      meta: { cached: true, generatedAt: '2026-05-18T00:00:00.000Z' }
    });

    const fallbackKv = makeKV();
    const fallbackDb = makeD1([
      { match: 'FROM pages WHERE slug = ? AND is_active = 1', first: pageRow(6) },
      { match: 'FROM page_sections', all: [] },
      { match: 'FROM page_links', all: [] },
      { match: 'FROM integrations', all: [] },
      { match: "FROM experiments WHERE page_id = ? AND status = 'live'", first: null },
      ...privacyRoutes
    ]);
    const fallbackResponse = await pageGet(context(new Request('https://fanlynks.test/api/page/home'), {
      DB: fallbackDb,
      PAGE_CACHE: fallbackKv
    }, { slug: 'home' }));

    expect(fallbackResponse.status).toBe(200);
    await expect(jsonBody(fallbackResponse)).resolves.toMatchObject({
      ok: true,
      page: { publishedVersion: 6 }
    });
    expect(fallbackKv.values.has(publishedPageKey('home'))).toBe(true);
  });
});
