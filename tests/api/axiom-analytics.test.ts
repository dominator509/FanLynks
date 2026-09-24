import { describe, expect, it } from 'vitest';
import { onRequestGet as tokenStatusGet, onRequestPost as tokenIssuePost } from '../../functions/api/admin/page/[pageId]/axiom-token';
import { onRequestGet as analyticsGet } from '../../functions/api/integrations/axiom/analytics';
import { createAxiomAnalyticsToken, hashAxiomAnalyticsToken } from '../../src/server/auth/axiom-analytics-token';
import { createSessionCookie } from '../../src/server/auth/session';
import { makeD1 } from '../helpers/mock-cloudflare';
import { TEST_SESSION_SECRET } from '../helpers/test-secrets';

function context(request: Request, env: Partial<Env>, params: Record<string, string> = {}): EventContext<Env, string, Record<string, string>> {
  return Object.assign({ request, env: env as Env, params, waitUntil: () => undefined, passThroughOnException: () => undefined, next: () => Promise.resolve(new Response()) }) as unknown as EventContext<Env, string, Record<string, string>>;
}

async function adminCookie(): Promise<string> {
  return createSessionCookie({ userId: 'user_1', tenantId: 'tenant_1', email: 'admin@fanlynks.com', sessionVersion: 1 }, TEST_SESSION_SECRET);
}

function sessionRoute() {
  return { match: 'FROM users u JOIN tenants', first: {
    id: 'user_1', email: 'admin@fanlynks.com', session_version: 1, is_active: 1, tenant_id: 'tenant_1',
  } };
}

describe('AXIOM first-party analytics API', () => {
  it('issues one page-scoped token and stores only its digest', async () => {
    const writes: Array<{ sql: string; params: unknown[] }> = [];
    const db = makeD1([
      sessionRoute(),
      { match: 'SELECT id, tenant_id FROM pages WHERE id = ?', first: { id: 'page_1', tenant_id: 'tenant_1' } },
      { match: 'SELECT id FROM integration_api_tokens', first: null },
      { match: 'UPDATE integration_api_tokens', handler: ({ sql, params }) => { writes.push({ sql, params }); return { success: true }; } },
      { match: 'INSERT INTO integration_api_tokens', handler: ({ sql, params }) => { writes.push({ sql, params }); return { success: true }; } },
      { match: 'INSERT INTO audit_log', handler: ({ sql, params }) => { writes.push({ sql, params }); return { success: true }; } },
    ]);
    const response = await tokenIssuePost(context(new Request('https://fanlynks.test/api/admin/page/page_1/axiom-token', {
      method: 'POST', headers: { cookie: await adminCookie() },
    }), { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }, { pageId: 'page_1' }));

    expect(response.status).toBe(201);
    const body = await response.json() as { token: string; tokenPrefix: string; scope: string };
    expect(body.token).toMatch(/^flx_axm_[A-Za-z0-9_-]{43}$/);
    expect(body.tokenPrefix).toBe(body.token.slice(0, 12));
    expect(body.scope).toBe('analytics:read');
    const insert = writes.find((write) => write.sql.includes('INSERT INTO integration_api_tokens'));
    expect(insert?.params[4]).toBe(await hashAxiomAnalyticsToken(body.token));
    expect(insert?.params).not.toContain(body.token);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('returns status metadata without ever disclosing the active secret', async () => {
    const db = makeD1([
      sessionRoute(),
      { match: 'SELECT id, tenant_id FROM pages WHERE id = ?', first: { id: 'page_1', tenant_id: 'tenant_1' } },
      { match: 'SELECT token_prefix, created_at, last_used_at', first: {
        token_prefix: 'flx_axm_abc', created_at: '2026-09-20T00:00:00.000Z', last_used_at: null,
      } },
    ]);
    const response = await tokenStatusGet(context(new Request('https://fanlynks.test/api/admin/page/page_1/axiom-token', {
      headers: { cookie: await adminCookie() },
    }), { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }, { pageId: 'page_1' }));

    expect(response.status).toBe(200);
    const body = await response.json() as { token: Record<string, unknown> };
    expect(body.token).toMatchObject({ configured: true, prefix: 'flx_axm_abc' });
    expect(body.token).not.toHaveProperty('token');
    expect(body.token).not.toHaveProperty('tokenHash');
  });

  it('requires a valid bearer token before returning bounded page aggregates', async () => {
    const token = await createAxiomAnalyticsToken();
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const until = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const eventDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const db = makeD1([
      { match: 'FROM integration_api_tokens t JOIN pages p', first: {
        id: 'token_1', tenant_id: 'tenant_1', page_id: 'page_1', slug: 'creator',
      } },
      { match: 'FROM events', all: [{
        date: eventDate, source: 'instagram', medium: 'social', page_views: 9, clicks: 3, events: 12,
      }] },
      { match: 'UPDATE integration_api_tokens SET last_used_at', run: { success: true } },
    ]);
    const url = new URL('https://fanlynks.test/api/integrations/axiom/analytics');
    url.searchParams.set('since', since);
    url.searchParams.set('until', until);
    const response = await analyticsGet(context(new Request(url, {
      headers: { authorization: `Bearer ${token.token}` },
    }), { DB: db }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, data: {
      page: { slug: 'creator' },
      summary: { pageViews: 9, clicks: 3, events: 12 },
      sources: [{ date: eventDate, source: 'instagram', medium: 'social', pageViews: 9, clicks: 3 }],
      metricCoverage: { pageViews: true, clicks: true, uniqueVisitors: false, conversions: false },
    } });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('rejects unauthenticated and overlong date-range requests', async () => {
    const unauthenticated = await analyticsGet(context(new Request('https://fanlynks.test/api/integrations/axiom/analytics'), { DB: makeD1([]) }));
    expect(unauthenticated.status).toBe(401);

    const token = await createAxiomAnalyticsToken();
    const db = makeD1([{ match: 'FROM integration_api_tokens t JOIN pages p', first: {
      id: 'token_1', tenant_id: 'tenant_1', page_id: 'page_1', slug: 'creator',
    } }]);
    const since = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    const until = new Date(Date.now() - 1_000).toISOString();
    const url = new URL('https://fanlynks.test/api/integrations/axiom/analytics');
    url.searchParams.set('since', since);
    url.searchParams.set('until', until);
    const response = await analyticsGet(context(new Request(url, {
      headers: { authorization: `Bearer ${token.token}` },
    }), { DB: db }));
    expect(response.status).toBe(400);
  });
});
