/**
 * Test-only secrets.
 *
 * TEST_SESSION_SECRET must satisfy MIN_SESSION_SECRET_LENGTH (32), enforced
 * by assertValidSessionSecret in src/server/security/env.ts. It is a fixed,
 * non-secret fixture value for unit/API tests only — never use in production.
 */
export const TEST_SESSION_SECRET = 'test-only-session-secret-0123456789abcd';
