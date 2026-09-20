import { describe, expect, it } from 'vitest';
import { createSessionCookie, parseSessionCookie } from '../../src/server/auth/session';

// Must satisfy the minimum session-secret length enforced by the
// session module (fail-closed on weak secrets).
const STRONG_SECRET = 'y'.repeat(32);
const OTHER_SECRET = 'z'.repeat(32);

function requestWithToken(token: string): Request {
  return new Request('https://example.com/', {
    headers: { cookie: `clh_admin_session=${token}` }
  });
}

describe('session signature verification', () => {
  it('accepts a valid round-tripped session', async () => {
    const setCookie = await createSessionCookie(
      { userId: 'u1', tenantId: 't1', email: 'admin@example.com', sessionVersion: 1 },
      STRONG_SECRET
    );
    const token = setCookie.split(';')[0].split('=')[1];
    const session = await parseSessionCookie(requestWithToken(token), STRONG_SECRET);
    expect(session?.userId).toBe('u1');
  });

  it('rejects a tampered payload', async () => {
    const setCookie = await createSessionCookie(
      { userId: 'u1', tenantId: 't1', email: 'admin@example.com', sessionVersion: 1 },
      STRONG_SECRET
    );
    const [payload, signature] = setCookie.split(';')[0].split('=')[1].split('.');
    const tamperedPayload = payload.slice(0, -2) + (payload.endsWith('AA') ? 'BB' : 'AA');
    const session = await parseSessionCookie(
      requestWithToken(`${tamperedPayload}.${signature}`),
      STRONG_SECRET
    );
    expect(session).toBeNull();
  });

  it('rejects a tampered signature', async () => {
    const setCookie = await createSessionCookie(
      { userId: 'u1', tenantId: 't1', email: 'admin@example.com', sessionVersion: 1 },
      STRONG_SECRET
    );
    const [payload, signature] = setCookie.split(';')[0].split('=')[1].split('.');
    const tamperedSignature = signature.slice(0, -2) + (signature.endsWith('AA') ? 'BB' : 'AA');
    const session = await parseSessionCookie(
      requestWithToken(`${payload}.${tamperedSignature}`),
      STRONG_SECRET
    );
    expect(session).toBeNull();
  });

  it('rejects sessions signed with a different secret', async () => {
    const setCookie = await createSessionCookie(
      { userId: 'u1', tenantId: 't1', email: 'admin@example.com', sessionVersion: 1 },
      STRONG_SECRET
    );
    const token = setCookie.split(';')[0].split('=')[1];
    const session = await parseSessionCookie(requestWithToken(token), OTHER_SECRET);
    expect(session).toBeNull();
  });

  it('returns null (not throw) for malformed signatures', async () => {
    const session = await parseSessionCookie(
      requestWithToken('abc.!!!not-base64!!!'),
      STRONG_SECRET
    );
    expect(session).toBeNull();
  });
});
