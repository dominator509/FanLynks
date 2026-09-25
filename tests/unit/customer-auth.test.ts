import { describe, expect, it, vi } from 'vitest';
import {
  isSameOriginMutation,
  isValidCustomerEmail,
  makeOpaqueToken,
  normalizeCustomerSlug,
  sha256Token,
  validateCustomerPassword
} from '../../src/server/auth/customer';
import { createCustomerSessionCookie, validateCustomerSession } from '../../src/server/auth/customer-session';
import { validateAdminSession } from '../../src/server/auth/session';
import { makeD1 } from '../helpers/mock-cloudflare';
import { TEST_SESSION_SECRET } from '../helpers/test-secrets';

describe('customer account auth primitives', () => {
  it('validates email, password, and page slugs without silently weakening input', () => {
    expect(isValidCustomerEmail('creator@example.com')).toBe(true);
    expect(isValidCustomerEmail('creator@localhost')).toBe(false);
    expect(validateCustomerPassword('shortA1')).toContain('14 and 128');
    expect(validateCustomerPassword('longbutlowercasepassword')).toContain('uppercase');
    expect(validateCustomerPassword('LongEnoughPassword2')).toBeNull();
    expect(normalizeCustomerSlug('  My-Creator-Page ')).toBe('my-creator-page');
    expect(normalizeCustomerSlug('my--page')).toBeNull();
  });

  it('creates high-entropy opaque tokens and stores only a one-way digest', async () => {
    const first = makeOpaqueToken();
    const second = makeOpaqueToken();
    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const digest = await sha256Token(first);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toBe(first);
  });

  it('requires the request Origin to match the endpoint origin', () => {
    expect(isSameOriginMutation(new Request('https://fanlynks.test/api/customer/page', {
      method: 'PUT', headers: { origin: 'https://fanlynks.test' }
    }))).toBe(true);
    expect(isSameOriginMutation(new Request('https://fanlynks.test/api/customer/page', {
      method: 'PUT', headers: { origin: 'https://attacker.example' }
    }))).toBe(false);
    expect(isSameOriginMutation(new Request('https://fanlynks.test/api/customer/page', { method: 'PUT' }))).toBe(false);
  });

  it('keeps customer cookies separate from owner cookies and checks verified tenant ownership', async () => {
    const cookie = await createCustomerSessionCookie({
      userId: 'customer_1', tenantId: 'tenant_1', email: 'creator@example.com', sessionVersion: 4
    }, TEST_SESSION_SECRET);
    const request = new Request('https://fanlynks.test/api/customer/session', { headers: { cookie } });
    const db = makeD1([{
      match: (sql, _params, kind) => kind === 'first' && sql.includes("u.account_type = 'customer'"),
      first: {
        id: 'customer_1', email: 'creator@example.com', session_version: 4, is_active: 1,
        email_verified_at: '2026-09-25T08:00:00.000Z', tenant_id: 'tenant_1'
      }
    }]);
    await expect(validateCustomerSession({ request, secret: TEST_SESSION_SECRET, db })).resolves.toMatchObject({
      userId: 'customer_1', tenantId: 'tenant_1', email: 'creator@example.com', sessionVersion: 4
    });
    await expect(validateAdminSession({ request, secret: TEST_SESSION_SECRET, db })).resolves.toBeNull();

    const mismatchedTenantDb = makeD1([{
      match: (sql, _params, kind) => kind === 'first' && sql.includes("u.account_type = 'customer'"),
      first: {
        id: 'customer_1', email: 'creator@example.com', session_version: 4, is_active: 1,
        email_verified_at: '2026-09-25T08:00:00.000Z', tenant_id: 'tenant_other'
      }
    }]);
    await expect(validateCustomerSession({ request, secret: TEST_SESSION_SECRET, db: mismatchedTenantDb })).resolves.toBeNull();
  });

  it('rejects expired customer sessions before querying account state', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-09-25T08:00:00.000Z'));
      const cookie = await createCustomerSessionCookie({
        userId: 'customer_1', tenantId: 'tenant_1', email: 'creator@example.com', sessionVersion: 1
      }, TEST_SESSION_SECRET);
      vi.setSystemTime(new Date('2026-09-25T21:00:00.000Z'));
      const db = makeD1([]);
      await expect(validateCustomerSession({
        request: new Request('https://fanlynks.test/api/customer/session', { headers: { cookie } }),
        secret: TEST_SESSION_SECRET,
        db
      })).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
