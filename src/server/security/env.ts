/**
 * Fail-closed environment validation for security-critical secrets.
 *
 * Cloudflare Pages Functions have no single startup entrypoint, so every
 * security-sensitive code path must validate its secrets before use.
 * These helpers throw on misconfiguration, which surfaces as a 500 and
 * refuses to operate rather than silently running with weak secrets.
 */

export const MIN_SESSION_SECRET_LENGTH = 32;

/**
 * Assert that the session HMAC secret is present and long enough to be safe.
 * Throws when the secret is missing or too short.
 */
export function assertValidSessionSecret(
  secret: string | null | undefined
): asserts secret is string {
  if (!secret || secret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error(
      `SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters. ` +
        'Refusing to issue or validate sessions with a weak or missing secret.'
    );
  }
}
