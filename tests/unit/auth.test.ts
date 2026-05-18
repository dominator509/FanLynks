import { describe, expect, it, vi } from 'vitest';
import { verifyPassword } from '../../src/server/auth/password';
import { isKnownTurnstileTestKey, verifyTurnstileToken } from '../../src/server/auth/turnstile';

async function pbkdf2Hash(password: string, salt: string, iterations = 100000): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations }, keyMaterial, 256);
  const bytes = new Uint8Array(bits);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `pbkdf2_sha256$${iterations}$${salt}$${btoa(binary)}`;
}

describe('auth primitives', () => {
  it('verifies only supported PBKDF2-SHA256 hashes with exact iteration count', async () => {
    const stored = await pbkdf2Hash('correct horse battery staple', 'unit-salt');
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true);
    expect(await verifyPassword('wrong', stored)).toBe(false);
    expect(await verifyPassword('correct horse battery staple', stored.replace('$100000$', '$99999$'))).toBe(false);
    expect(await verifyPassword('correct horse battery staple', 'sha256$legacy')).toBe(false);
    expect(await verifyPassword('pw', 'pbkdf2_sha256$100000$salt$not-valid-base64')).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
    expect(await verifyPassword('pw', '')).toBe(false);
  });

  it('identifies Turnstile test secrets and rejects missing/test credentials without fetch', async () => {
    expect(isKnownTurnstileTestKey('1x00000000000000000000AA')).toBe(true);
    expect(isKnownTurnstileTestKey('real-secret')).toBe(false);
    expect(await verifyTurnstileToken({ secretKey: '', token: '' })).toEqual({
      ok: false,
      errors: ['missing_turnstile_secret_or_token']
    });
    expect(await verifyTurnstileToken({ secretKey: '1x00000000000000000000AA', token: 'token' })).toEqual({
      ok: false,
      errors: ['turnstile_test_secret_not_allowed']
    });
  });

  it('normalizes Turnstile siteverify success, action mismatch, and HTTP failure', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, action: 'admin_login', hostname: 'fanlynks.test' }), { status: 200 }));
    await expect(verifyTurnstileToken({ secretKey: 'real-secret', token: 'token', ip: '203.0.113.10', expectedAction: 'admin_login' })).resolves.toMatchObject({
      ok: true,
      action: 'admin_login',
      hostname: 'fanlynks.test'
    });

    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, action: 'other', 'error-codes': ['bad-input-response'] }), { status: 200 }));
    await expect(verifyTurnstileToken({ secretKey: 'real-secret', token: 'token', expectedAction: 'admin_login' })).resolves.toEqual({
      ok: false,
      errors: ['bad-input-response', 'action_mismatch'],
      action: 'other',
      cdata: undefined,
      hostname: undefined
    });

    fetchSpy.mockResolvedValueOnce(new Response('nope', { status: 502 }));
    await expect(verifyTurnstileToken({ secretKey: 'real-secret', token: 'token' })).resolves.toEqual({
      ok: false,
      errors: ['siteverify_http_502']
    });
  });
});
