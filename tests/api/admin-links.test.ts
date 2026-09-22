import { describe, expect, it } from 'vitest';
import { onRequestPut as linkPut } from '../../functions/api/admin/link/[linkId]';
import { onRequestPost as linksPost } from '../../functions/api/admin/page/[pageId]/links';
import { createSessionCookie } from '../../src/server/auth/session';
import { makeD1 } from '../helpers/mock-cloudflare';
import { TEST_SESSION_SECRET } from '../helpers/test-secrets';

function context(request: Request, env: Partial<Env>, params: Record<string, string> = {}): EventContext<Env, string, Record<string, string>> {
  return {
    request,
    env: env as Env,
    params,
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
    next: () => Promise.resolve(new Response())
  } as unknown as EventContext<Env, string, Record<string, string>>;
}

async function adminCookie(): Promise<string> {
  return createSessionCookie({
    userId: 'user_1',
    tenantId: 'tenant_1',
    email: 'admin@fanlynks.com',
    sessionVersion: 1
  }, TEST_SESSION_SECRET);
}

describe('admin link section boundaries', () => {
  it('rejects link creation when sectionId is not owned by the target page', async () => {
    const writes: unknown[][] = [];
    const db = makeD1([
      {
        match: 'FROM users u JOIN tenants',
        first: { id: 'user_1', email: 'admin@fanlynks.com', session_version: 1, is_active: 1, tenant_id: 'tenant_1' }
      },
      { match: 'SELECT tenant_id FROM pages WHERE id = ?', first: { tenant_id: 'tenant_1' } },
      { match: 'FROM page_sections WHERE id = ? AND page_id = ?', first: null },
      { match: 'INSERT INTO page_links', handler: ({ params }) => { writes.push(params); return { success: true }; } }
    ]);

    const response = await linksPost(context(new Request('https://fanlynks.test/api/admin/page/page_demo/links', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: await adminCookie()
      },
      body: JSON.stringify({
        title: 'Cross page section',
        url: 'https://fanlynks.com/join',
        sectionId: 'section_other_page'
      })
    }), {
      DB: db,
      SESSION_SECRET: TEST_SESSION_SECRET
    }, { pageId: 'page_demo' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Section does not belong to this page.'
    });
    expect(writes).toHaveLength(0);
  });

  it('rejects link updates when sectionId is not owned by the link page', async () => {
    const writes: unknown[][] = [];
    const db = makeD1([
      {
        match: 'FROM users u JOIN tenants',
        first: { id: 'user_1', email: 'admin@fanlynks.com', session_version: 1, is_active: 1, tenant_id: 'tenant_1' }
      },
      {
        match: 'FROM page_links l JOIN pages p',
        first: { id: 'link_join', page_id: 'page_demo', tenant_id: 'tenant_1' }
      },
      { match: 'FROM page_sections WHERE id = ? AND page_id = ?', first: null },
      { match: 'UPDATE page_links', handler: ({ params }) => { writes.push(params); return { success: true }; } }
    ]);

    const response = await linkPut(context(new Request('https://fanlynks.test/api/admin/link/link_join', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        cookie: await adminCookie()
      },
      body: JSON.stringify({
        title: 'Updated link',
        url: 'https://fanlynks.com/demo',
        sectionId: 'section_other_page',
        rowOrder: 1
      })
    }), {
      DB: db,
      SESSION_SECRET: TEST_SESSION_SECRET
    }, { linkId: 'link_join' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Section does not belong to this page.'
    });
    expect(writes).toHaveLength(0);
  });
});
