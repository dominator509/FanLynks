const encoder = new TextEncoder();

/**
 * Current PBKDF2 work factor for newly created hashes.
 * Raise this over time as hardware improves; existing hashes are
 * transparently upgraded on next successful login via needsRehash().
 */
export const TARGET_PBKDF2_ITERATIONS = 100000;

/** Minimum iteration count still accepted for verification. */
export const MIN_PBKDF2_ITERATIONS = 100000;

function base64ToBytes(value: string): Uint8Array {
  const bin = atob(value);
  return Uint8Array.from(bin, (char) => char.charCodeAt(0));
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

async function verifyPbkdf2Sha256(password: string, iterations: number, salt: string, expectedBase64: string): Promise<boolean> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: encoder.encode(salt),
      iterations
    },
    keyMaterial,
    256
  );

  return constantTimeEqual(new Uint8Array(bits), base64ToBytes(expectedBase64));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function hashPassword(password: string): Promise<string> {
  const iterations = TARGET_PBKDF2_ITERATIONS;
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = base64UrlEncode(saltBytes);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: encoder.encode(salt),
      iterations
    },
    keyMaterial,
    256
  );

  return `pbkdf2_sha256$${iterations}$${salt}$${bytesToBase64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!password || !storedHash) return false;

  const parts = storedHash.split('$');
  if (parts[0] === 'pbkdf2_sha256' && parts.length === 4) {
    const iterations = Number(parts[1]);
    if (!Number.isInteger(iterations) || iterations < MIN_PBKDF2_ITERATIONS) return false;
    try {
      return await verifyPbkdf2Sha256(password, iterations, parts[2], parts[3]);
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Parse the iteration count from a stored hash.
 * Returns null when the hash is not a recognized PBKDF2-SHA256 hash.
 */
export function getPbkdf2Iterations(storedHash: string): number | null {
  const parts = storedHash.split('$');
  if (parts[0] === 'pbkdf2_sha256' && parts.length === 4) {
    const iterations = Number(parts[1]);
    return Number.isInteger(iterations) ? iterations : null;
  }
  return null;
}

/**
 * Whether a stored hash was created with fewer iterations than the current
 * target and should be re-hashed. Call after a successful password
 * verification, when the plaintext password is available.
 */
export function needsRehash(storedHash: string): boolean {
  const iterations = getPbkdf2Iterations(storedHash);
  return iterations !== null && iterations < TARGET_PBKDF2_ITERATIONS;
}
