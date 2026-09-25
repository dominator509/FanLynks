import { assertValidSessionSecret } from '../security/env';

export interface CustomerSession {
  userId: string;
  tenantId: string;
  email: string;
  sessionVersion: number;
  issuedAt: string;
  expiresAt: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const COOKIE_NAME = 'clh_customer_session';
const MAX_AGE_SECONDS = 60 * 60 * 12;

function encode(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function signingKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function readCookie(request: Request): string | null {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE_NAME) return rest.join('=');
  }
  return null;
}

export async function createCustomerSessionCookie(session: Omit<CustomerSession, 'issuedAt' | 'expiresAt'>, secret: string): Promise<string> {
  assertValidSessionSecret(secret);
  const now = new Date();
  const payload: CustomerSession = {
    ...session,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + MAX_AGE_SECONDS * 1000).toISOString()
  };
  const encoded = encode(encoder.encode(JSON.stringify(payload)));
  const signature = encode(new Uint8Array(await crypto.subtle.sign('HMAC', await signingKey(secret), encoder.encode(encoded))));
  return `${COOKIE_NAME}=${encoded}.${signature}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`;
}

export function clearCustomerSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

async function parseCustomerSession(request: Request, secret: string): Promise<CustomerSession | null> {
  assertValidSessionSecret(secret);
  const token = readCookie(request);
  if (!token) return null;
  const [payloadPart, signaturePart] = token.split('.');
  if (!payloadPart || !signaturePart) return null;
  try {
    const signatureBytes = decode(signaturePart);
    const signatureBuffer = new ArrayBuffer(signatureBytes.byteLength);
    new Uint8Array(signatureBuffer).set(signatureBytes);
    const payloadBuffer = new ArrayBuffer(encoder.encode(payloadPart).byteLength);
    new Uint8Array(payloadBuffer).set(encoder.encode(payloadPart));
    const valid = await crypto.subtle.verify('HMAC', await signingKey(secret), signatureBuffer, payloadBuffer);
    if (!valid) return null;
    const payload = JSON.parse(decoder.decode(decode(payloadPart))) as CustomerSession;
    if (!payload.userId || !payload.tenantId || !payload.email || !Number.isInteger(payload.sessionVersion)) return null;
    if (!Number.isFinite(new Date(payload.expiresAt).getTime()) || new Date(payload.expiresAt).getTime() <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function validateCustomerSession(args: { request: Request; secret: string; db: D1Database }): Promise<CustomerSession | null> {
  const session = await parseCustomerSession(args.request, args.secret);
  if (!session) return null;
  const row = await args.db.prepare(`
    SELECT u.id, u.email, u.session_version, u.is_active, u.email_verified_at, t.id AS tenant_id
    FROM users u
    JOIN tenants t ON t.owner_user_id = u.id
    WHERE u.id = ? AND u.account_type = 'customer'
    LIMIT 1
  `).bind(session.userId).first<{
    id: string; email: string; session_version: number; is_active: number; email_verified_at: string | null; tenant_id: string;
  }>();
  if (!row || !row.is_active || !row.email_verified_at) return null;
  if (row.tenant_id !== session.tenantId || row.email.toLowerCase() !== session.email.toLowerCase()) return null;
  if (Number(row.session_version) !== session.sessionVersion) return null;
  return session;
}
