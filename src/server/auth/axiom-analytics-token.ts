const TOKEN_PREFIX = 'flx_axm_';
const TOKEN_PATTERN = /^flx_axm_[A-Za-z0-9_-]{43}$/;
const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function isAxiomAnalyticsToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

export async function hashAxiomAnalyticsToken(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createAxiomAnalyticsToken(): Promise<{
  token: string;
  tokenPrefix: string;
  tokenHash: string;
}> {
  const random = crypto.getRandomValues(new Uint8Array(32));
  const token = `${TOKEN_PREFIX}${base64UrlEncode(random)}`;
  return {
    token,
    tokenPrefix: token.slice(0, 12),
    tokenHash: await hashAxiomAnalyticsToken(token),
  };
}
