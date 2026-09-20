import { describe, expect, it } from 'vitest';
import { assertValidSessionSecret, MIN_SESSION_SECRET_LENGTH } from '../../src/server/security/env';
import { createSessionCookie, parseSessionCookie } from '../../src/server/auth/session';

const STRONG_SECRET = 'x'.repeat(MIN_SESSION_SECRET_LENGTH);

describe('session secret validation', () => {
  it('rejects missing or short secrets', () => {
    expect(() => assertValidSessionSecret('')).toThrow(/SESSION_SECRET/);
    expect(() => assertValidSessionSecret(undefined)).toThrow(/SESSION_SECRET/);
    expect(() => assertValidSessionSecret(null)).toThrow(/SESSION_SECRET/);
    expect(() => assertValidSessionSecret('short-secret')).toThrow(/SESSION_SECRET/);
    expect(() => assertValidSessionSecret('x'.repeat(MIN_SESSION_SECRET_LENGTH - 1))).toThrow(/SESSION_SECRET/);
  });

  it('accepts secrets meeting the minimum length', () => {
    expect(() => assertValidSessionSecret(STRONG_SECRET)).not.toThrow();
    expect(() => assertValidSessionSecret('x'.repeat(64))).not.toThrow();
  });

  it('refuses to create sessions with a weak secret', async () => {
    await expect(
      createSessionCookie(
        { userId: 'u1', tenantId: 't1', email: 'admin@example.com', sessionVersion: 1 },
        'weak'
      )
    ).rejects.toThrow(/SESSION_SECRET/);
  });

  it('refuses to parse sessions with a weak secret', async () => {
    const request = new Request('https://example.com/', {
      headers: { cookie: 'clh_admin_session=abc.def' }
    });
    await expect(parseSessionCookie(request, '')).rejects.toThrow(/SESSION_SECRET/);
  });

  it('round-trips a session with a strong secret', async () => {
    const setCookie = await createSessionCookie(
      { userId: 'u1', tenantId: 't1', email: 'admin@example.com', sessionVersion: 1 },
      STRONG_SECRET
    );
    const token = setCookie.split(';')[0].split('=')[1];
    const request = new Request('https://example.com/', {
      headers: { cookie: `clh_admin_session=${token}` }
    });
    const session = await parseSessionCookie(request, STRONG_SECRET);
    expect(session?.userId).toBe('u1');
    expect(session?.tenantId).toBe('t1');
  });
});
