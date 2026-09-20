import { assertValidSessionSecret } from '../security/env';

export interface AdminSession {
  userId: string;
  tenantId: string;
  email: string;
  sessionVersion: number;
  issuedAt: string;
  expiresAt: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const SESSION_COOKIE = 'clh_admin_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function signValue(secret: string, payload: string): Promise<string> {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return base64UrlEncode(new Uint8Array(signature));
}

async function verifySignature(secret: string, encodedPayload: string, signature: string): Promise<boolean> {
  const key = await importHmacKey(secret);
  let signatureBytes: Uint8Array;
  try {
    signatureBytes = base64UrlDecode(signature);
  } catch {
    return false;
  }
  // crypto.subtle.verify runs in constant time inside the WebCrypto
  // implementation, unlike a string comparison of re-computed signatures.
  // The copy narrows the type to Uint8Array<ArrayBuffer> for BufferSource.
  return crypto.subtle.verify('HMAC', key, new Uint8Array(signatureBytes), encoder.encode(encodedPayload));
}

function parseCookieValue(request: Request, name: string): string | null {
  const raw = request.headers.get('cookie');
  if (!raw) return null;

  for (const part of raw.split(';')) {
    const [cookieName, ...rest] = part.trim().split('=');
    if (cookieName === name) return rest.join('=');
  }
  return null;
}

export async function createSessionCookie(session: Omit<AdminSession, 'issuedAt' | 'expiresAt'>, secret: string): Promise<string> {
  assertValidSessionSecret(secret);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
  const payload: AdminSession = {
    ...session,
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  };

  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await signValue(secret, encodedPayload);
  const token = `${encodedPayload}.${signature}`;

  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

export function createClearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export async function parseSessionCookie(request: Request, secret: string): Promise<AdminSession | null> {
  assertValidSessionSecret(secret);
  const token = parseCookieValue(request, SESSION_COOKIE);
  if (!token) return null;

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  if (!(await verifySignature(secret, encodedPayload, signature))) return null;

  try {
    const payload = JSON.parse(decoder.decode(base64UrlDecode(encodedPayload))) as AdminSession;
    if (!payload.userId || !payload.tenantId || !payload.email || !payload.expiresAt) return null;
    if (!Number.isInteger(payload.sessionVersion) || payload.sessionVersion < 1) return null;
    if (new Date(payload.expiresAt).getTime() <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function validateAdminSession(args: {
  request: Request;
  secret: string;
  db: D1Database;
}): Promise<AdminSession | null> {
  const session = await parseSessionCookie(args.request, args.secret);
  if (!session) return null;

  const row = await args.db.prepare(`
    SELECT u.id, u.email, u.session_version, u.is_active, t.id AS tenant_id
    FROM users u
    JOIN tenants t ON t.owner_user_id = u.id
    WHERE u.id = ?
    LIMIT 1
  `)
    .bind(session.userId)
    .first<{ id: string; email: string; session_version: number; is_active: number; tenant_id: string }>();

  if (!row || !row.is_active) return null;
  if (row.tenant_id !== session.tenantId) return null;
  if (row.email.toLowerCase() !== session.email.toLowerCase()) return null;
  if (Number(row.session_version) !== session.sessionVersion) return null;

  return session;
}
