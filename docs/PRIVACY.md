# PRIVACY.md

## Goal
Provide a region-aware consent and tag-gating engine that preserves clean first-party analytics while controlling third-party forwarding according to policy.

## Region policy modes
- `uk_strict`
- `ca_optout_gpc`
- `default_standard`

## Policy model

### Essential
Allowed for:
- rendering
- auth/session security
- rate limiting/abuse prevention
- sticky experiment assignment

### Analytics
Controls:
- optional analytics cookies/storage
- GA4 where configured
- non-essential measurement behavior

### Advertising
Controls:
- Meta Pixel
- ad-personalization forwarding
- ad-sharing behavior
- GTM-fired ad tags when applicable

## Decision flow
1. Determine country from Cloudflare headers
2. Detect GPC signal
3. Load existing consent record
4. Apply regional default policy
5. Resolve final allowed categories
6. Persist consent updates with banner version and metadata

## UK strict mode
- non-essential tags blocked until explicit consent
- ad/analytics forwarding disabled by default
- basic-consent-style behavior

## California mode
- expose `Your Privacy Choices`
- honor GPC for ad-sharing suppression
- persist opt-out choices

## Implementation rules
- Privacy state must be available to both page render and event forwarding
- Keep policy resolution server-driven
- Client-side UI may display/submit choices but not be the sole policy authority
- Consent record changes must be logged as first-party events and consent records

## Storage
Primary record: D1 `consent_records`
Optional convenience cache: KV only if justified

## Banner/versioning
Consent copy should be versioned so consent state can be interpreted against the text shown at the time.

## Guardrails
- No dark patterns
- No hidden opt-out route
- No region-specific logic scattered across unrelated modules
