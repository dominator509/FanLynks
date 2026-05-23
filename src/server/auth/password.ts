const encoder = new TextEncoder();

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
  const iterations = 100000;
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
    if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 100000) return false;
    try {
      return await verifyPbkdf2Sha256(password, iterations, parts[2], parts[3]);
    } catch {
      return false;
    }
  }

  return false;
}
