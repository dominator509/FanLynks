# ARCHITECTURE.md

## Product frame
Custom Link Hub is a high-conversion, mobile-first link hub with optional creator-growth analytics mode.

It is architected as:
- a very fast public page
- a browser-based admin
- first-party analytics as source of truth
- split-testable visual variants
- privacy-aware third-party tag forwarding
- a clean path from self-hosted single-site mode to multi-tenant SaaS

## Core system boundaries

### 1) Public delivery
Responsible for:
- slug resolution
- privacy policy resolution
- sticky experiment assignment
- published payload retrieval
- public rendering
- click instrumentation hooks

Must remain:
- fast
- low-JS
- one-variant-per-visit
- independent from admin bundle code

### 2) Admin surface
Responsible for:
- auth/session handling
- page editing
- links management
- appearance/theming
- experiments management
- analytics dashboards
- privacy/integrations configuration
- publishing

Must remain:
- authenticated
- auditable
- patch-friendly

### 3) Privacy engine
Responsible for:
- region policy resolution
- GPC handling
- consent state persistence
- allowed/disallowed tag decisions
- privacy UI text versioning inputs

Must remain:
- centralized
- deterministic
- reusable by both public render and event forwarding

### 4) Experiment engine
Responsible for:
- active experiment resolution
- weight-based allocation
- sticky variant assignment
- variant token merge
- winner/pause/freeze behavior

Must remain:
- analytically clean
- one assignment per visitor/page/experiment
- decoupled from visual rendering implementation

### 5) Analytics engine
Responsible for:
- first-party event ingestion
- normalized event schema
- reporting rollups
- third-party forwarding gates

Must remain:
- first-party-first
- privacy-aware
- independent from GA4/Meta/GTM availability

## Data storage split

### D1
System of record for:
- users
- tenants
- pages
- links
- sections
- themes
- experiments
- variants
- assignments
- consent records
- integrations
- audit log
- first-party events

### KV
Fast read/cache adjunct for:
- published page snapshots
- experiment manifests
- ephemeral counters/nonces when useful

## Public request path
1. Resolve slug
2. Determine region policy
3. Read consent state and GPC signal
4. Resolve active experiment
5. Read or assign sticky variant
6. Read published payload from KV
7. Fall back to D1 if snapshot missing
8. Return page payload with effective visual tokens and policy state

## Publish path
1. Validate admin session
2. Persist canonical changes in D1
3. Build normalized published payload
4. Write payload snapshot to KV
5. Write/refresh experiment manifest snapshot
6. Record audit log

## Non-negotiables
- One public page shell
- One consent engine
- One event model
- No arbitrary custom script injection in MVP
- Third-party tags never bypass first-party instrumentation
