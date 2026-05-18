# Behavioral Contract Map

## Runtime Shape

Fan Lynks is a Cloudflare Pages + Functions application. Static browser shells live in `public/`, API boundaries live in `functions/`, core server logic lives in `src/server/`, and D1 is the durable source of truth. KV is an adjunct cache for published public page snapshots, experiment manifests, and rate-limit counters.

## Core Workflows

### Public Page Load
- Input: slug, request headers, visitor cookie, session cookie.
- Reads: KV `page:published:<slug>`, D1 fallback page graph, D1 consent records, active experiment assignment rows.
- Mutates: visitor/session cookies; variant assignment row only when no active assignment exists.
- Output: normalized page payload, links, privacy state, optional assigned variant, and session identifiers.
- Invariant: public payload shape remains stable and one visitor receives one active variant per page/experiment.

### Admin Authentication
- Input: email, password, Turnstile token, IP, user agent.
- Reads: users, tenants, Turnstile siteverify result, KV rate counters.
- Mutates: rate-limit KV keys, user failed-login/lockout fields, security_events, last_login_at.
- Output: signed HTTP-only session cookie or structured JSON error.
- Invariant: active user, tenant relationship, and session_version must still match on every admin route.

### Admin Editing And Publishing
- Input: authenticated admin session plus page/link/theme/privacy/integration/experiment payloads.
- Reads: tenant ownership, existing D1 page graph.
- Mutates: pages, page_links, integrations, experiments, experiment_variants, audit_log.
- Output: JSON save/publish result.
- Invariant: canonical data stays in D1; published snapshots must be refreshed in KV whenever public-visible state changes.

### Experiment Lifecycle
- Input: experiment create/update/start/pause/winner requests.
- Reads: page ownership, existing variants, active experiments.
- Mutates: experiments, variants, audit_log, KV published page snapshot.
- Output: experiment JSON plus refreshed published cache state.
- Invariant: lifecycle endpoints own status transitions; generic update cannot bypass one-live-experiment behavior.

### Privacy And Consent
- Input: page_id, consent choices, banner version, request headers.
- Reads: page existence, latest consent record, GPC header, country header.
- Mutates: consent_records and first-party consent_updated events.
- Output: effective analytics/advertising consent state.
- Invariant: server-side privacy state is authoritative; localStorage is only a UI acknowledgement convenience.

### Analytics And Forwarding
- Input: public event payload.
- Reads: page/link existence, page tracking mode, integrations, privacy state.
- Mutates: events table and session/visitor cookies.
- Output: stored event payload and privacy-gated client forwarding plan.
- Invariant: first-party event write precedes all third-party forwarding decisions.

## External Boundaries To Mock
- D1 database API.
- KV namespace API.
- Turnstile `siteverify`.
- Cloudflare request headers (`CF-IPCountry`, `CF-Connecting-IP`, `Sec-GPC`).
- Browser `localStorage`, script injection, and third-party tag globals.

## Database State Surfaces
- Identity: `users`, `tenants`, `security_events`.
- Public page graph: `pages`, `page_sections`, `page_links`.
- Testing: `experiments`, `experiment_variants`, `variant_assignments`.
- Privacy and analytics: `consent_records`, `events`, `integrations`, `ad_spend_entries`.
- Observability: `audit_log`.
