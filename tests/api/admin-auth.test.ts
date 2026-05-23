import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost as loginPost } from '../../functions/api/admin/login';
import { onRequestPost as passwordPost } from '../../functions/api/admin/password';
import { onRequestGet as sessionGet } from '../../functions/api/admin/session';
import { createSessionCookie } from '../../src/server/auth/session';
import { verifyPassword } from '../../src/server/auth/password';
import { makeD1, makeKV } from '../helpers/mock-cloudflare';

async function pbkdf2Hash(password: string, salt: string, iterations = 100000): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations }, keyMaterial, 256);
  const bytes = new Uint8Array(bits);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `pbkdf2_sha256$${iterations}$${salt}$${btoa(binary)}`;
}

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

describe('admin authentication API handlers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('verifies Turnstile and password, writes success audit rows, and returns a secure admin session cookie', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: true, action: 'admin_login' }), { status: 200 }));
    const securityEvents: unknown[][] = [];
    const userUpdates: unknown[][] = [];
    const passwordHash = await pbkdf2Hash('correct-password', 'login-salt');
    const db = makeD1([
      {
        match: 'FROM users u JOIN tenants',
        first: {
          id: 'user_1',
          email: 'admin@fanlynks.com',
          password_hash: passwordHash,
          tenant_id: 'tenant_1',
          session_version: 3,
          failed_login_count: 2,
          locked_until: null
        }
      },
      { match: 'UPDATE users SET last_login_at', handler: ({ params }) => { userUpdates.push(params); return { success: true }; } },
      { match: 'INSERT INTO security_events', handler: ({ params }) => { securityEvents.push(params); return { success: true }; } }
    ]);

    const response = await loginPost(context(new Request('https://fanlynks.test/api/admin/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'CF-Connecting-IP': '203.0.113.10',
        'user-agent': 'Vitest'
      },
      body: JSON.stringify({
        email: 'ADMIN@FanLynks.com ',
        password: 'correct-password',
        turnstileToken: 'turnstile-token'
      })
    }), {
      DB: db,
      PAGE_CACHE: makeKV(),
      SESSION_SECRET: 'unit-session-secret',
      TURNSTILE_SECRET_KEY: 'real-turnstile-secret'
    }));

    expect(response.status).toBe(200);
    await expect(jsonBody(response)).resolves.toMatchObject({
      ok: true,
      authenticated: true,
      user: {
        id: 'user_1',
        email: 'admin@fanlynks.com',
        tenantId: 'tenant_1'
      }
    });
    expect(response.headers.get('set-cookie')).toContain('clh_admin_session=');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('Secure');
    expect(userUpdates).toHaveLength(1);
    expect(securityEvents).toHaveLength(1);
    expect(securityEvents[0][3]).toBe('admin_login_success');
    expect(securityEvents[0][7]).toBe(1);
  });

  it('increments failed login state, locks the account on threshold, and records an audit row', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: true, action: 'admin_login' }), { status: 200 }));
    const userUpdates: unknown[][] = [];
    const securityEvents: unknown[][] = [];
    const passwordHash = await pbkdf2Hash('correct-password', 'login-salt');
    const db = makeD1([
      {
        match: 'FROM users u JOIN tenants',
        first: {
          id: 'user_1',
          email: 'admin@fanlynks.com',
          password_hash: passwordHash,
          tenant_id: 'tenant_1',
          session_version: 1,
          failed_login_count: 4,
          locked_until: null
        }
      },
      { match: 'UPDATE users SET failed_login_count', handler: ({ params }) => { userUpdates.push(params); return { success: true }; } },
      { match: 'INSERT INTO security_events', handler: ({ params }) => { securityEvents.push(params); return { success: true }; } }
    ]);

    const response = await loginPost(context(new Request('https://fanlynks.test/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '203.0.113.10' },
      body: JSON.stringify({
        email: 'admin@fanlynks.com',
        password: 'wrong-password',
        turnstileToken: 'turnstile-token'
      })
    }), {
      DB: db,
      PAGE_CACHE: makeKV(),
      SESSION_SECRET: 'unit-session-secret',
      TURNSTILE_SECRET_KEY: 'real-turnstile-secret'
    }));

    expect(response.status).toBe(401);
    await expect(jsonBody(response)).resolves.toMatchObject({ ok: false, error: 'Invalid credentials.' });
    expect(userUpdates[0][0]).toBe(5);
    expect(typeof userUpdates[0][1]).toBe('string');
    expect(securityEvents[0][3]).toBe('admin_login_failed');
    expect(JSON.parse(securityEvents[0][8] as string)).toMatchObject({ reason: 'bad_password' });
  });

  it('rate limits repeated login attempts before password verification', async () => {
    const securityEvents: unknown[][] = [];
    const db = makeD1([
      { match: 'FROM users u JOIN tenants', first: null },
      { match: 'INSERT INTO security_events', handler: ({ params }) => { securityEvents.push(params); return { success: true }; } }
    ]);
    const kv = makeKV();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => (
      new Response(JSON.stringify({ success: true, action: 'admin_login' }), { status: 200 })
    ));

    let lastResponse: Response | null = null;
    for (let index = 0; index < 11; index += 1) {
      lastResponse = await loginPost(context(new Request('https://fanlynks.test/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '203.0.113.10' },
        body: JSON.stringify({
          email: 'limited@fanlynks.com',
          password: 'whatever',
          turnstileToken: 'turnstile-token'
        })
      }), {
        DB: db,
        PAGE_CACHE: kv,
        SESSION_SECRET: 'unit-session-secret',
        TURNSTILE_SECRET_KEY: 'real-turnstile-secret'
      }));
    }

    expect(lastResponse?.status).toBe(429);
    expect(fetchSpy).toHaveBeenCalledTimes(10);
    expect(securityEvents.at(-1)?.[3]).toBe('admin_login_rate_limited');
  });

  it('refreshes a valid session cookie and rejects revoked session versions', async () => {
    const validCookie = await createSessionCookie({
      userId: 'user_1',
      tenantId: 'tenant_1',
      email: 'admin@fanlynks.com',
      sessionVersion: 2
    }, 'unit-session-secret');

    const validDb = makeD1([{
      match: 'FROM users u JOIN tenants',
      first: { id: 'user_1', email: 'admin@fanlynks.com', session_version: 2, is_active: 1, tenant_id: 'tenant_1' }
    }]);
    const validResponse = await sessionGet(context(new Request('https://fanlynks.test/api/admin/session?refresh=1', {
      headers: { cookie: validCookie }
    }), {
      DB: validDb,
      SESSION_SECRET: 'unit-session-secret'
    }));

    expect(validResponse.status).toBe(200);
    expect(validResponse.headers.get('set-cookie')).toContain('clh_admin_session=');
    await expect(jsonBody(validResponse)).resolves.toMatchObject({
      ok: true,
      authenticated: true,
      refreshed: true
    });

    const revokedDb = makeD1([{
      match: 'FROM users u JOIN tenants',
      first: { id: 'user_1', email: 'admin@fanlynks.com', session_version: 3, is_active: 1, tenant_id: 'tenant_1' }
    }]);
    const revokedResponse = await sessionGet(context(new Request('https://fanlynks.test/api/admin/session?refresh=1', {
      headers: { cookie: validCookie }
    }), {
      DB: revokedDb,
      SESSION_SECRET: 'unit-session-secret'
    }));

    expect(revokedResponse.headers.get('set-cookie')).toBeNull();
    await expect(jsonBody(revokedResponse)).resolves.toMatchObject({
      ok: true,
      authenticated: false,
      refreshed: false,
      user: null
    });
  });

  it('changes an authenticated admin password, bumps session version, clears lockout state, audits, and clears the cookie', async () => {
    const sessionCookie = await createSessionCookie({
      userId: 'user_1',
      tenantId: 'tenant_1',
      email: 'admin@fanlynks.com',
      sessionVersion: 4
    }, 'unit-session-secret');
    const currentHash = await pbkdf2Hash('old-password-1A', 'password-salt');
    const updates: unknown[][] = [];
    const auditRows: unknown[][] = [];
    const db = makeD1([
      {
        match: (sql, _params, kind) => kind === 'first' && sql.includes('u.session_version'),
        first: { id: 'user_1', email: 'admin@fanlynks.com', session_version: 4, is_active: 1, tenant_id: 'tenant_1' }
      },
      {
        match: (sql, _params, kind) => kind === 'first' && sql.includes('u.password_hash'),
        first: { id: 'user_1', email: 'admin@fanlynks.com', password_hash: currentHash, tenant_id: 'tenant_1' }
      },
      { match: 'UPDATE users SET password_hash', handler: ({ params }) => { updates.push(params); return { success: true }; } },
      { match: 'INSERT INTO security_events', handler: ({ params }) => { auditRows.push(params); return { success: true }; } }
    ]);

    const response = await passwordPost(context(new Request('https://fanlynks.test/api/admin/password', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: sessionCookie,
        'CF-Connecting-IP': '203.0.113.44',
        'user-agent': 'Vitest'
      },
      body: JSON.stringify({
        currentPassword: 'old-password-1A',
        newPassword: 'new-password-2B',
        confirmPassword: 'new-password-2B'
      })
    }), {
      DB: db,
      SESSION_SECRET: 'unit-session-secret'
    }));

    expect(response.status).toBe(200);
    await expect(jsonBody(response)).resolves.toMatchObject({
      ok: true,
      passwordChanged: true,
      requiresLogin: true
    });
    expect(response.headers.get('set-cookie')).toContain('clh_admin_session=');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(updates).toHaveLength(1);
    expect(await verifyPassword('new-password-2B', updates[0][0] as string)).toBe(true);
    expect(updates[0][3]).toBe('user_1');
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0][3]).toBe('admin_password_changed');
    expect(auditRows[0][7]).toBe(1);
    expect(JSON.parse(auditRows[0][8] as string)).toMatchObject({ sessionRevoked: true });
  });

  it('rejects password changes when the current password is wrong and records a failed audit row', async () => {
    const sessionCookie = await createSessionCookie({
      userId: 'user_1',
      tenantId: 'tenant_1',
      email: 'admin@fanlynks.com',
      sessionVersion: 4
    }, 'unit-session-secret');
    const currentHash = await pbkdf2Hash('old-password-1A', 'password-salt');
    const updates: unknown[][] = [];
    const auditRows: unknown[][] = [];
    const db = makeD1([
      {
        match: (sql, _params, kind) => kind === 'first' && sql.includes('u.session_version'),
        first: { id: 'user_1', email: 'admin@fanlynks.com', session_version: 4, is_active: 1, tenant_id: 'tenant_1' }
      },
      {
        match: (sql, _params, kind) => kind === 'first' && sql.includes('u.password_hash'),
        first: { id: 'user_1', email: 'admin@fanlynks.com', password_hash: currentHash, tenant_id: 'tenant_1' }
      },
      { match: 'UPDATE users SET password_hash', handler: ({ params }) => { updates.push(params); return { success: true }; } },
      { match: 'INSERT INTO security_events', handler: ({ params }) => { auditRows.push(params); return { success: true }; } }
    ]);

    const response = await passwordPost(context(new Request('https://fanlynks.test/api/admin/password', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: sessionCookie,
        'CF-Connecting-IP': '203.0.113.44'
      },
      body: JSON.stringify({
        currentPassword: 'wrong-password-1A',
        newPassword: 'new-password-2B',
        confirmPassword: 'new-password-2B'
      })
    }), {
      DB: db,
      SESSION_SECRET: 'unit-session-secret'
    }));

    expect(response.status).toBe(401);
    await expect(jsonBody(response)).resolves.toMatchObject({ ok: false, error: 'Current password is incorrect.' });
    expect(updates).toHaveLength(0);
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0][3]).toBe('admin_password_changed');
    expect(auditRows[0][7]).toBe(0);
    expect(JSON.parse(auditRows[0][8] as string)).toMatchObject({ reason: 'bad_current_password' });
  });
});
