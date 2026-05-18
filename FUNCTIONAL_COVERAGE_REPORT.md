# Functional Coverage Report

Generated: 2026-05-18

## Verification Summary

- `npm test`: 9 test files passed, 32 tests passed.
- `npm run test:coverage`: passed.
- `npm run typecheck`: passed.
- `npm run deploy:check`: passed.

Coverage snapshot from the final run:

| Metric | Result |
| --- | ---: |
| Statements | 80.48% |
| Branches | 64.88% |
| Functions | 91.66% |
| Lines | 84.85% |

The suite is deterministic and uses in-memory mocks for Cloudflare D1 and KV boundaries. It does not call live Cloudflare, Turnstile, GitHub, analytics providers, or production URLs.

## Phase 1: Behavioral Contract Mapping

The intended behavior is documented in `docs/BEHAVIORAL_CONTRACT_MAP.md`.

Core workflows mapped:

- Admin authentication: Turnstile verification, password verification, session issuance, session revocation checks.
- Published page read path: public slug lookup, D1 fallback, KV published page cache, experiment manifest cache.
- Admin editor publish path: page/link/integration/experiment state mutation and cache refresh.
- Privacy state path: regional policy, stored consent, GPC, effective analytics/ads consent.
- Analytics path: public event validation, first-party D1 persistence, optional client forwarding plan.
- Experiment assignment path: weighted variant selection, stable visitor assignment, TTL-aware replacement.

## Phase 2: Unit and Component Verification

Added unit coverage for:

- URL and theme token validation.
- Privacy policy resolution and GPC detection.
- Weighted variant picking.
- PBKDF2 password verification and Turnstile verification normalization.

Edge cases covered:

- Empty and non-string text values.
- Unsafe URL schemes and URL credentials.
- Malformed URL parsing.
- Unsafe theme tokens and style enum fallback.
- Invalid ISO timestamps.
- Legacy SHA-256 password rejection.
- Malformed PBKDF2 hash rejection.
- Turnstile missing secret/token, test secret rejection, action mismatch, and upstream HTTP failure.
- Zero/negative experiment weights and out-of-range random output fallback.

## Phase 3: Integration and Boundary Validation

Added mocked integration coverage for:

- Published page payload construction from D1 rows.
- KV published page snapshot write.
- KV variant manifest write/delete lifecycle.
- Link, avatar, integration, theme, and experiment override sanitization at publish-cache boundary.
- Stored consent lookup feeding effective privacy state.
- Page-level GPC configuration.
- Forwarding plan generation for GA4, Meta, GTM, and Cloudflare Web Analytics.
- Tracking mode `none` short-circuiting external destinations.

Failure and safety states covered:

- Unsafe stored URLs are removed before public payload emission.
- Stale variant manifest is deleted when no experiment is live.
- Ads forwarding is blocked when consent is denied or GPC applies.
- External integration public configs exclude unapproved fields.

## Phase 4: High-Concurrency and E2E Workflow Validation

Added high-throughput state tests for:

- Concurrent repeat-visitor variant assignment writes.
- Stable single active assignment under parallel traffic.
- Expired assignment replacement.
- Burst persistence of public analytics events.
- Public analytics rejection for admin-only event names.

State invariants verified:

- Concurrent assignment writes leave exactly one active assignment for the visitor/experiment key.
- All concurrent assignment callers converge on the persisted variant.
- Expired assignment rows can be replaced deterministically.
- Analytics event bursts persist all expected events without storing blocked admin event names.
- Unsafe client-supplied event destination URLs fall back to stored link URLs.

## Production API Handler Coverage Added

Added request-level handler coverage for production-critical Cloudflare Pages Functions:

- Admin login success verifies Turnstile, password hash, audit write, user reset, and secure admin session cookie.
- Admin failed password increments failed count, records audit detail, and locks at the configured threshold.
- Admin login rate limiting blocks repeated email attempts before password verification.
- Admin session refresh reissues a cookie only for a valid current session.
- Admin session validation rejects revoked session versions.
- Admin publish requires a valid session, verifies ownership, increments published version, writes audit state, refreshes KV cache, and deletes stale experiment manifests when no experiment is live.
- Privacy consent writes both consent records and first-party analytics events while issuing visitor/session cookies.
- Public page API serves cached KV snapshots and falls back to D1 rebuild when the KV snapshot is missing.

## Known Remaining Coverage Gaps

- Admin editor mutation endpoints beyond publish should receive request-level tests with mocked authenticated sessions.
- Consent endpoint should add malformed payload and repeated-write rate-limit tests.
- Public page API should add missing slug and experiment assignment cookie behavior tests.
- Browser-level tests should still be added for the admin workspace, public CTA flow, privacy modal, and mobile layout.

## Result

The repository now has a repeatable test foundation that validates core logic, Cloudflare boundary handoffs, and high-concurrency state workflows without modifying application behavior or depending on live infrastructure.
