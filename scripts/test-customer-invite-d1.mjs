import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wrangler = path.join(repoRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const tempParent = os.tmpdir();
const persistTo = await mkdtemp(path.join(tempParent, 'fanlynks-issue30-d1-'));

function executeD1(args) {
  const result = spawnSync(process.execPath, [wrangler, 'd1', 'execute', 'custom-link-hub', '--local', `--persist-to=${persistTo}`, ...args, '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: '1' }
  });
  if (result.status !== 0) {
    throw new Error(`Local D1 command failed (${result.status ?? result.signal}):\n${result.stderr}\n${result.stdout}`);
  }
  return result.stdout;
}

function rowsFrom(stdout) {
  const parsed = JSON.parse(stdout);
  const rows = [];
  const visit = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
    } else if (value && typeof value === 'object') {
      if (Array.isArray(value.results)) rows.push(...value.results);
      else for (const item of Object.values(value)) visit(item);
    }
  };
  visit(parsed);
  return rows;
}

function assertRow(row, label) {
  if (!row) throw new Error(`Local D1 regression failed: ${label}`);
}

try {
  const migrationDir = path.join(repoRoot, 'migrations');
  const migrations = (await readdir(migrationDir))
    .filter((file) => /^\d+_.*\.sql$/.test(file))
    .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));
  if (migrations.length !== 7 || migrations[0] !== '0001_init.sql' || migrations.at(-1) !== '0007_customer_accounts.sql') {
    throw new Error(`Expected migrations 0001 through 0007; found ${migrations.join(', ')}`);
  }
  for (const migration of migrations) {
    executeD1(['--file', path.join(migrationDir, migration)]);
  }

  const seed = `
    INSERT INTO users (id, email, password_hash, created_at, updated_at)
    VALUES ('owner-issue30', 'owner-issue30@example.test', 'test-only', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    INSERT INTO customer_invites (id, email_hash, token_hash, created_by, expires_at, redeemed_at, redeemed_by, created_at)
    VALUES ('invite-issue30', 'email-hash-issue30', 'invite-hash-issue30', 'owner-issue30', '2030-01-01T00:00:00.000Z', NULL, NULL, '2026-01-01T00:00:00.000Z');
  `;
  executeD1(['--command', seed]);

  const signupBatch = ({ userId, tenantId, pageId, sectionId, verifyHash, signupAt }) => `
    PRAGMA defer_foreign_keys = ON;
    UPDATE customer_invites
      SET redeemed_at = '${signupAt}', redeemed_by = '${userId}'
      WHERE token_hash = 'invite-hash-issue30' AND email_hash = 'email-hash-issue30'
        AND redeemed_at IS NULL AND expires_at > '${signupAt}';
    INSERT INTO users (id, email, password_hash, created_at, updated_at, account_type, email_verified_at)
      SELECT '${userId}', 'creator-issue30@example.test', 'test-only', '${signupAt}', '${signupAt}', 'customer', NULL
      WHERE 1 = 1 AND (0 = 1 OR EXISTS (
        SELECT 1 FROM customer_invites WHERE token_hash = 'invite-hash-issue30'
          AND redeemed_by = '${userId}' AND redeemed_at = '${signupAt}'
      ));
    INSERT INTO tenants (id, owner_user_id, name, slug, created_at, updated_at)
      SELECT '${tenantId}', '${userId}', 'Issue 30 Creator', '${userId}-slug', '${signupAt}', '${signupAt}'
      WHERE EXISTS (SELECT 1 FROM users WHERE id = '${userId}');
    INSERT INTO pages (id, tenant_id, slug, title, created_at, updated_at)
      SELECT '${pageId}', '${tenantId}', '${userId}-page', 'Issue 30 Creator', '${signupAt}', '${signupAt}'
      WHERE EXISTS (SELECT 1 FROM tenants WHERE id = '${tenantId}');
    INSERT INTO page_sections (id, page_id, label, section_order, is_enabled)
      SELECT '${sectionId}', '${pageId}', 'Links', 1, 1 WHERE EXISTS (SELECT 1 FROM pages WHERE id = '${pageId}');
    INSERT INTO customer_account_tokens (id, user_id, token_type, token_hash, expires_at, created_at)
      SELECT '${userId}-verify-token', '${userId}', 'verify_email', '${verifyHash}', '2026-01-02T00:00:00.000Z', '${signupAt}'
      WHERE EXISTS (SELECT 1 FROM users WHERE id = '${userId}');
    INSERT INTO security_events (id, tenant_id, user_id, event_type, success, detail_json, created_at)
      SELECT '${userId}-signup-event', '${tenantId}', '${userId}', 'customer_signup', 1, '{}', '${signupAt}'
      WHERE EXISTS (SELECT 1 FROM users WHERE id = '${userId}');
    INSERT INTO audit_log (id, tenant_id, user_id, action, target_type, target_id, diff_json, created_at)
      SELECT '${userId}-signup-audit', '${tenantId}', '${userId}', 'customer_account_created', 'page', '${pageId}', '{}', '${signupAt}'
      WHERE EXISTS (SELECT 1 FROM pages WHERE id = '${pageId}');
  `;

  executeD1(['--command', signupBatch({
    userId: 'customer-issue30', tenantId: 'tenant-issue30', pageId: 'page-issue30', sectionId: 'section-issue30',
    verifyHash: 'verify-hash-issue30', signupAt: '2026-01-01T00:01:00.000Z'
  })]);

  const signupReadback = rowsFrom(executeD1(['--command', `
    SELECT
      (SELECT COUNT(*) FROM users WHERE id = 'customer-issue30' AND account_type = 'customer') AS customer_count,
      (SELECT redeemed_by FROM customer_invites WHERE id = 'invite-issue30') AS redeemed_by,
      (SELECT COUNT(*) FROM tenants WHERE owner_user_id = 'customer-issue30') AS tenant_count,
      (SELECT COUNT(*) FROM customer_account_tokens WHERE token_hash = 'verify-hash-issue30' AND consumed_at IS NULL) AS verify_token_count;
  `]));
  assertRow(signupReadback.find((row) => row.customer_count === 1 && row.redeemed_by === 'customer-issue30' && row.tenant_count === 1 && row.verify_token_count === 1),
    'deferred invite redemption did not atomically create the customer, workspace, and verification token');

  // A second use of the same invitation must not create another customer or change its redemption owner.
  executeD1(['--command', signupBatch({
    userId: 'customer-issue30-replay', tenantId: 'tenant-issue30-replay', pageId: 'page-issue30-replay', sectionId: 'section-issue30-replay',
    verifyHash: 'verify-hash-issue30-replay', signupAt: '2026-01-01T00:02:00.000Z'
  })]);
  const inviteReplay = rowsFrom(executeD1(['--command', `
    SELECT
      (SELECT COUNT(*) FROM users WHERE id LIKE 'customer-issue30%') AS customer_count,
      (SELECT redeemed_by FROM customer_invites WHERE id = 'invite-issue30') AS redeemed_by;
  `]));
  assertRow(inviteReplay.find((row) => row.customer_count === 1 && row.redeemed_by === 'customer-issue30'),
    'replaying the invitation created a second account or changed its original redemption');

  const verifiedAt = '2026-01-01T00:03:00.000Z';
  executeD1(['--command', `
    UPDATE customer_account_tokens SET consumed_at = '${verifiedAt}'
      WHERE token_hash = 'verify-hash-issue30' AND token_type = 'verify_email'
        AND consumed_at IS NULL AND expires_at > '${verifiedAt}';
    UPDATE users SET email_verified_at = '${verifiedAt}', updated_at = '${verifiedAt}'
      WHERE id = 'customer-issue30' AND account_type = 'customer' AND email_verified_at IS NULL
        AND EXISTS (SELECT 1 FROM customer_account_tokens WHERE token_hash = 'verify-hash-issue30' AND consumed_at = '${verifiedAt}');
    INSERT INTO security_events (id, tenant_id, user_id, event_type, success, detail_json, created_at)
      VALUES ('customer-issue30-verified-event', 'tenant-issue30', 'customer-issue30', 'customer_email_verified', 1, '{}', '${verifiedAt}');
  `]);

  const verificationReadback = rowsFrom(executeD1(['--command', `
    SELECT u.email_verified_at, tok.consumed_at
    FROM users u JOIN customer_account_tokens tok ON tok.user_id = u.id
    WHERE u.id = 'customer-issue30' AND tok.token_hash = 'verify-hash-issue30';
  `]));
  assertRow(verificationReadback.find((row) => row.email_verified_at === verifiedAt && row.consumed_at === verifiedAt),
    'verification did not consume the token and confirm the customer');

  const verificationReplay = rowsFrom(executeD1(['--command', `
    SELECT COUNT(*) AS eligible FROM customer_account_tokens
    WHERE token_hash = 'verify-hash-issue30' AND token_type = 'verify_email'
      AND consumed_at IS NULL AND expires_at > '2026-01-01T00:04:00.000Z';
  `]));
  assertRow(verificationReplay.find((row) => row.eligible === 0), 'a consumed verification token remained eligible for replay');

  console.log('customer invite D1 regression: signup, verification, invite replay, and verification replay passed');
} finally {
  if (path.dirname(persistTo) !== tempParent || !path.basename(persistTo).startsWith('fanlynks-issue30-d1-')) {
    throw new Error('Refusing to remove an unexpected local D1 test directory');
  }
  await rm(persistTo, { recursive: true, force: true });
}
