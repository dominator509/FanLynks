import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost as signupPost } from '../../functions/api/customer/signup';
import { onRequestPost as verifyEmailPost } from '../../functions/api/customer/verify-email';
import { onRequestPost as loginPost } from '../../functions/api/customer/login';
import { onRequestGet as customerSessionGet } from '../../functions/api/customer/session';
import { onRequestPost as logoutPost } from '../../functions/api/customer/logout';
import { onRequestPost as forgotPasswordPost } from '../../functions/api/customer/forgot-password';
import { onRequestPost as resetPasswordPost } from '../../functions/api/customer/reset-password';
import { onRequestPost as resendVerificationPost } from '../../functions/api/customer/resend-verification';
import { onRequestPut as updatePagePut } from '../../functions/api/customer/page';
import { onRequestPut as updateLinkPut } from '../../functions/api/customer/links/[linkId]';
import { createCustomerSessionCookie } from '../../src/server/auth/customer-session';
import { makeD1, makeKV } from '../helpers/mock-cloudflare';
import { TEST_SESSION_SECRET } from '../helpers/test-secrets';

vi.mock('../../src/server/page/cache', () => ({
  refreshPublishedPageCache: vi.fn(async () => ({ slug: 'creator-page', publishedVersion: 1, hasExperiment: false }))
}));

import { refreshPublishedPageCache } from '../../src/server/page/cache';

const secret = TEST_SESSION_SECRET;
const origin = 'https://fanlynks.test';

function context(request: Request, env: Partial<Env>, params: Record<string, string> = {}): EventContext<Env, string, Record<string, string>> {
  return { request, env: env as Env, params, waitUntil: vi.fn(), passThroughOnException: vi.fn(), next: vi.fn() } as unknown as EventContext<Env, string, Record<string, string>>;
}

function jsonRequest(path: string, body: unknown, cookie?: string): Request {
  const headers = new Headers({ origin, 'content-type': 'application/json', 'CF-Connecting-IP': '203.0.113.44', 'user-agent': 'customer-auth-test' });
  if (cookie) headers.set('cookie', cookie);
  return new Request(new URL(path, origin), { method: 'POST', headers, body: JSON.stringify(body) });
}

function passwordRequest(path: string, method: string, body: unknown, cookie?: string): Request {
  const headers = new Headers({ origin, 'content-type': 'application/json', 'CF-Connecting-IP': '203.0.113.44' });
  if (cookie) headers.set('cookie', cookie);
  return new Request(new URL(path, origin), { method, headers, body: JSON.stringify(body) });
}

function mailer(messages: Array<Record<string, unknown>> = []): Env['MAILER'] {
  return {
    fetch: vi.fn(async (request: Request) => {
      messages.push(await request.json() as Record<string, unknown>);
      return new Response(null, { status: 204 });
    })
  } as unknown as Env['MAILER'];
}

async function pbkdf2Hash(password: string, salt: string, iterations = 100000): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations }, keyMaterial, 256);
  const bytes = new Uint8Array(bits);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return 'pbkdf2_sha256$' + iterations + '$' + salt + '$' + btoa(binary);
}

function turnstileResponse(action: string): Response {
  return new Response(JSON.stringify({ success: true, action, hostname: 'fanlynks.test' }), { status: 200 });
}

describe('customer account API', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps signup invitation-only unless open registration is explicitly configured', async () => {
    const siteverify = vi.spyOn(globalThis, 'fetch').mockResolvedValue(turnstileResponse('customer_signup'));
    const response = await signupPost(context(jsonRequest('/api/customer/signup', {
      email: 'creator@example.com',
      fullName: 'Creator',
      pageSlug: 'creator-page',
      password: 'LongEnoughPassword2',
      turnstileToken: 'token'
    }), {
      DB: makeD1([]),
      PAGE_CACHE: makeKV(),
      SESSION_SECRET: secret,
      TURNSTILE_SECRET_KEY: 'real-turnstile-secret'
    }));
    expect(response.status).toBe(403);
    expect(siteverify).not.toHaveBeenCalled();
  });

  it('creates a customer workspace, verifies its email, signs in, refreshes the session and signs out', async () => {
    const siteverify = vi.spyOn(globalThis, 'fetch');
    siteverify.mockResolvedValueOnce(turnstileResponse('customer_signup'));
    const writes: Array<{ table: string; params: unknown[]; sql: string }> = [];
    const messages: Array<Record<string, unknown>> = [];
    const db = makeD1([
      { match: (sql, _params, kind) => kind === 'first' && sql.includes('EXISTS(SELECT 1 FROM pages'), first: { page_taken: 0, tenant_taken: 0 } },
      { match: (sql, _params, kind) => kind === 'first' && sql.includes("account_type = 'customer'"), first: { id: 'customer_created' } },
      ...['users', 'tenants', 'pages', 'page_sections', 'customer_account_tokens', 'security_events', 'audit_log'].map((table) => ({
        match: (sql: string, _params: unknown[], kind: string) => kind === 'run' && sql.includes('INSERT INTO ' + table),
        handler: ({ sql, params }: { sql: string; params: unknown[] }) => {
          writes.push({ table, params, sql });
          return { success: true };
        }
      }))
    ]);
    const mail = mailer(messages);
    const signup = await signupPost(context(jsonRequest('/api/customer/signup', {
      email: 'Creator@Example.com',
      fullName: 'Creator Name',
      pageSlug: 'creator-page',
      password: 'LongEnoughPassword2',
      turnstileToken: 'turnstile'
    }), {
      DB: db,
      PAGE_CACHE: makeKV(),
      SESSION_SECRET: secret,
      TURNSTILE_SECRET_KEY: 'real-turnstile-secret',
      CUSTOMER_SIGNUP_MODE: 'open',
      APP_ORIGIN: 'https://fanlynks.com',
      MAILER: mail
    }));
    expect(signup.status).toBe(202);
    const signupBody = await signup.json() as Record<string, unknown>;
    expect(signupBody.message).toContain('invitation is valid');
    expect(JSON.stringify(signupBody)).not.toContain('token=');
    expect(writes.map((write) => write.table)).toEqual([
      'users', 'tenants', 'pages', 'page_sections', 'customer_account_tokens', 'security_events', 'audit_log'
    ]);
    expect(writes[0].params[1]).toBe('creator@example.com');
    expect(writes[0].sql).toContain("'customer'");
    expect(writes[1].params[1]).toBe(writes[0].params[0]);
    expect(writes[2].params[1]).toBe(writes[1].params[0]);
    expect(writes[3].params[1]).toBe(writes[2].params[0]);
    expect(mail.fetch).toHaveBeenCalledOnce();
    const verificationUrl = new URL(String(messages[0].url));
    expect(verificationUrl.search).toBe('');
    const verificationToken = new URLSearchParams(verificationUrl.hash.slice(1)).get('token');
    expect(verificationToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(writes[4].params[2]).toMatch(/^[a-f0-9]{64}$/);
    expect(writes[4].params[2]).not.toBe(verificationToken);

    const verifyWrites: string[] = [];
    const verifyDb = makeD1([
      { match: (sql, _params, kind) => kind === 'first' && sql.includes('FROM customer_account_tokens tok'), first: { id: 'customer_created', email: 'creator@example.com', tenant_id: 'tenant_created' } },
      { match: (sql, _params, kind) => kind === 'first' && sql.includes('SELECT email_verified_at'), first: { email_verified_at: new Date().toISOString() } },
      ...['customer_account_tokens', 'users', 'security_events'].map((table) => ({
        match: (sql: string, _params: unknown[], kind: string) => kind === 'run' && (sql.includes('UPDATE ' + table) || sql.includes('INSERT INTO ' + table)),
        handler: ({ sql }: { sql: string }) => { verifyWrites.push(sql); return { success: true }; }
      }))
    ]);
    const verified = await verifyEmailPost(context(jsonRequest('/api/customer/verify-email', { token: verificationToken }), {
      DB: verifyDb, PAGE_CACHE: makeKV(), SESSION_SECRET: secret
    }));
    expect(verified.status).toBe(200);
    expect(verifyWrites.some((sql) => sql.includes('consumed_at = ?'))).toBe(true);
    expect(verifyWrites.some((sql) => sql.includes('email_verified_at = ?'))).toBe(true);

    siteverify.mockResolvedValueOnce(turnstileResponse('customer_login'));
    const loginDb = makeD1([
      {
        match: (sql, _params, kind) => kind === 'first' && sql.includes('FROM users u JOIN tenants t'),
        first: {
          id: 'customer_created', email: 'creator@example.com', password_hash: await pbkdf2Hash('LongEnoughPassword2', 'account-salt'),
          tenant_id: 'tenant_created', session_version: 1, failed_login_count: 0, locked_until: null
        }
      },
      { match: 'UPDATE users SET last_login_at', run: { success: true } },
      { match: 'INSERT INTO security_events', run: { success: true } }
    ]);
    const login = await loginPost(context(jsonRequest('/api/customer/login', {
      email: 'creator@example.com', password: 'LongEnoughPassword2', turnstileToken: 'turnstile'
    }), { DB: loginDb, PAGE_CACHE: makeKV(), SESSION_SECRET: secret, TURNSTILE_SECRET_KEY: 'real-turnstile-secret' }));
    expect(login.status).toBe(200);
    const cookie = login.headers.get('set-cookie');
    expect(cookie).toContain('clh_customer_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    await expect(login.json()).resolves.toMatchObject({ ok: true, authenticated: true });

    const sessionDb = makeD1([{
      match: (sql, _params, kind) => kind === 'first' && sql.includes("u.account_type = 'customer'"),
      first: {
        id: 'customer_created', email: 'creator@example.com', session_version: 1, is_active: 1,
        email_verified_at: new Date().toISOString(), tenant_id: 'tenant_created'
      }
    }]);
    const session = await customerSessionGet(context(new Request('https://fanlynks.test/api/customer/session', { headers: { cookie } }), {
      DB: sessionDb, SESSION_SECRET: secret
    }));
    expect(session.status).toBe(200);
    expect(session.headers.get('set-cookie')).toContain('clh_customer_session=');

    const logout = await logoutPost(context(new Request('https://fanlynks.test/api/customer/logout', {
      method: 'POST', headers: { origin, cookie }
    }), {}));
    expect(logout.status).toBe(200);
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('does not reveal whether a link belongs to a different customer tenant', async () => {
    const cookie = await createCustomerSessionCookie({
      userId: 'customer_1', tenantId: 'tenant_1', email: 'creator@example.com', sessionVersion: 1
    }, secret);
    const updates: unknown[][] = [];
    const db = makeD1([
      {
        match: (sql, _params, kind) => kind === 'first' && sql.includes("u.account_type = 'customer'"),
        first: { id: 'customer_1', email: 'creator@example.com', session_version: 1, is_active: 1, email_verified_at: 'now', tenant_id: 'tenant_1' }
      },
      {
        match: (sql, params, kind) => kind === 'first' && sql.includes('JOIN pages p ON p.id = l.page_id'),
        handler: ({ sql, params }) => {
          expect(sql).toContain('p.tenant_id = ?');
          expect(params).toEqual(['foreign-link', 'tenant_1']);
          return null;
        }
      },
      { match: 'UPDATE page_links', handler: ({ params }) => { updates.push(params); return { success: true }; } }
    ]);
    const response = await updateLinkPut(context(passwordRequest('/api/customer/links/foreign-link', 'PUT', {
      title: 'Changed', url: 'https://example.com'
    }, cookie), { DB: db, SESSION_SECRET: secret }, { linkId: 'foreign-link' }));
    expect(response.status).toBe(404);
    expect(updates).toHaveLength(0);
  });

  it('locks repeated incorrect passwords and rate limits the full login flow', async () => {
    const siteverify = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => turnstileResponse('customer_login'));
    let failedCount = 0;
    let lockedUntil: string | null = null;
    const failedUpdates: unknown[][] = [];
    const securityEvents: unknown[][] = [];
    const db = makeD1([
      {
        match: (sql, _params, kind) => kind === 'first' && sql.includes('FROM users u JOIN tenants t'),
        handler: () => ({ id: 'customer_1', email: 'creator@example.com', password_hash: 'invalid-hash', tenant_id: 'tenant_1', session_version: 1, failed_login_count: failedCount, locked_until: lockedUntil })
      },
      {
        match: (sql, _params, kind) => kind === 'run' && sql.includes('UPDATE users SET failed_login_count'),
        handler: ({ params }) => {
          failedCount = Number(params[0]);
          lockedUntil = typeof params[1] === 'string' ? params[1] : null;
          failedUpdates.push(params);
          return { success: true };
        }
      },
      { match: 'INSERT INTO security_events', handler: ({ params }) => { securityEvents.push(params); return { success: true }; } }
    ]);
    const kv = makeKV();
    let last: Response | null = null;

    for (let index = 0; index < 11; index += 1) {
      last = await loginPost(context(jsonRequest('/api/customer/login', {
        email: 'creator@example.com', password: 'incorrect', turnstileToken: 'turnstile'
      }), { DB: db, PAGE_CACHE: kv, SESSION_SECRET: secret, TURNSTILE_SECRET_KEY: 'real-turnstile-secret' }));
      if (index < 10) {
        expect(last.status).toBe(401);
        await expect(last.json()).resolves.toMatchObject({ ok: false, error: 'Invalid email or password.' });
      }
    }

    expect(failedCount).toBe(5);
    expect(lockedUntil).toBeTruthy();
    expect(failedUpdates).toHaveLength(5);
    expect(last?.status).toBe(429);
    expect(siteverify).toHaveBeenCalledTimes(10);
    expect(securityEvents.at(-1)?.[3]).toBe('customer_login_rate_limited');
  });

  it('saves customer page edits only within the authenticated tenant', async () => {
    const cookie = await createCustomerSessionCookie({
      userId: 'customer_1', tenantId: 'tenant_1', email: 'creator@example.com', sessionVersion: 1
    }, secret);
    const pageUpdates: unknown[][] = [];
    const auditRows: unknown[][] = [];
    const db = makeD1([
      {
        match: (sql, _params, kind) => kind === 'first' && sql.includes("u.account_type = 'customer'"),
        first: { id: 'customer_1', email: 'creator@example.com', session_version: 1, is_active: 1, email_verified_at: 'now', tenant_id: 'tenant_1' }
      },
      { match: (sql, _params, kind) => kind === 'first' && sql.includes('FROM pages WHERE tenant_id = ?'), first: { id: 'page_1', slug: 'creator-page', title: 'Old title', subtitle: null } },
      { match: 'UPDATE pages SET title', handler: ({ params }) => { pageUpdates.push(params); return { success: true }; } },
      { match: 'INSERT INTO audit_log', handler: ({ params }) => { auditRows.push(params); return { success: true }; } }
    ]);
    const cacheRefresh = vi.mocked(refreshPublishedPageCache);
    cacheRefresh.mockClear();

    const response = await updatePagePut(context(passwordRequest('/api/customer/page', 'PUT', {
      title: 'A new page title', subtitle: 'A short introduction'
    }, cookie), { DB: db, PAGE_CACHE: makeKV(), SESSION_SECRET: secret }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, saved: true });
    expect(pageUpdates).toHaveLength(1);
    expect(pageUpdates[0]).toEqual(['A new page title', 'A short introduction', expect.any(String), 'page_1', 'tenant_1']);
    expect(auditRows[0]?.[3]).toBe('customer_page_updated');
    expect(cacheRefresh).toHaveBeenCalledWith(expect.objectContaining({ pageId: 'page_1' }));
  });

  it('uses a generic recovery response and stores a hashed, short-lived password reset token', async () => {
    const siteverify = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => turnstileResponse('customer_forgot_password'));
    const missingDb = makeD1([{
      match: (sql, _params, kind) => kind === 'first' && sql.includes('FROM users u JOIN tenants t'),
      first: null
    }]);
    const missing = await forgotPasswordPost(context(jsonRequest('/api/customer/forgot-password', {
      email: 'missing@example.com', turnstileToken: 'turnstile'
    }), { DB: missingDb, PAGE_CACHE: makeKV(), TURNSTILE_SECRET_KEY: 'real-turnstile-secret' }));

    const writes: unknown[][] = [];
    const messages: Array<Record<string, unknown>> = [];
    const existingDb = makeD1([
      {
        match: (sql, _params, kind) => kind === 'first' && sql.includes('FROM users u JOIN tenants t'),
        first: { id: 'customer_1', tenant_id: 'tenant_1' }
      },
      { match: 'UPDATE customer_account_tokens', run: { success: true } },
      { match: 'INSERT INTO customer_account_tokens', handler: ({ params }) => { writes.push(params); return { success: true }; } },
      { match: 'INSERT INTO security_events', run: { success: true } }
    ]);
    const resetMailer = mailer(messages);
    const existing = await forgotPasswordPost(context(jsonRequest('/api/customer/forgot-password', {
      email: 'creator@example.com', turnstileToken: 'turnstile'
    }), {
      DB: existingDb, PAGE_CACHE: makeKV(), TURNSTILE_SECRET_KEY: 'real-turnstile-secret',
      APP_ORIGIN: 'https://fanlynks.com', MAILER: resetMailer
    }));
    expect(missing.status).toBe(202);
    expect(existing.status).toBe(202);
    expect(await missing.json()).toEqual(await existing.json());
    expect(siteverify).toHaveBeenCalledTimes(2);
    const resetUrl = new URL(String(messages[0].url));
    const token = new URLSearchParams(resetUrl.hash.slice(1)).get('token');
    expect(resetUrl.search).toBe('');
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(writes[0][2]).toMatch(/^[a-f0-9]{64}$/);
    expect(writes[0][2]).not.toBe(token);

    const resetWrites: string[] = [];
    const resetDb = makeD1([
      { match: (sql, _params, kind) => kind === 'first' && sql.includes('tok.token_hash = ?'), first: { id: 'customer_1', email: 'creator@example.com', tenant_id: 'tenant_1' } },
      { match: (sql, _params, kind) => kind === 'first' && sql.includes('SELECT consumed_at'), first: { consumed_at: new Date().toISOString() } },
      ...['UPDATE users SET password_hash', 'UPDATE customer_account_tokens', 'INSERT INTO security_events'].map((needle) => ({
        match: (sql: string, _params: unknown[], kind: string) => kind === 'run' && sql.includes(needle),
        handler: ({ sql }: { sql: string }) => { resetWrites.push(sql); return { success: true }; }
      }))
    ]);
    const reset = await resetPasswordPost(context(jsonRequest('/api/customer/reset-password', {
      token, password: 'ReplacementPassword3'
    }), { DB: resetDb, PAGE_CACHE: makeKV() }));
    expect(reset.status).toBe(200);
    expect(reset.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(resetWrites.some((sql) => sql.includes('session_version = session_version + 1'))).toBe(true);
    expect(resetWrites.some((sql) => sql.includes('consumed_at = ?'))).toBe(true);
  });

  it('rejects verification and resend requests without a same-origin header', async () => {
    const db = makeD1([]);
    const requestWithoutOrigin = (path: string) => new Request(new URL(path, origin), {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: 'x'.repeat(43), email: 'creator@example.com' })
    });
    const verify = await verifyEmailPost(context(requestWithoutOrigin('/api/customer/verify-email'), { DB: db, PAGE_CACHE: makeKV() }));
    const resend = await resendVerificationPost(context(requestWithoutOrigin('/api/customer/resend-verification'), { DB: db, PAGE_CACHE: makeKV() }));
    expect(verify.status).toBe(403);
    expect(resend.status).toBe(403);
    await expect(verify.json()).resolves.toMatchObject({ ok: false, error: 'Invalid request origin.' });
    await expect(resend.json()).resolves.toMatchObject({ ok: false, error: 'Invalid request origin.' });
  });
});
