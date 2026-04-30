# AGENTS.md

## Purpose
This repo is optimized for agentic development.
Agents should be able to modify one subsystem with local context and avoid unnecessary cross-repo drift.

## Source of truth order
1. Explicit requirements and locked decisions
2. Current implementation reality
3. docs/ARCHITECTURE.md
4. docs/PRIVACY.md
5. docs/TRACKING.md
6. migrations/
7. API contracts in code
8. generic defaults

## Hard rules
- Preserve one-page public conversion-first UX.
- Preserve first-party analytics as source of truth.
- Preserve centralized privacy gating.
- Preserve one-variant-per-visit experiment behavior.
- Do not introduce arbitrary custom script injection.
- Do not expand into a generic site builder.
- Do not bypass audit logging for admin mutations.

## Preferred change style
- Small patches
- Explicit interfaces
- Minimal hidden coupling
- No sweeping rewrites without strong justification

## When editing public rendering
Do not:
- ship admin code to public bundle
- render multiple variants client-side
- load all fonts/assets for all variants
- let tracking semantics drift by variant

## When editing tracking/privacy
Do not:
- let external tags become the system of record
- duplicate consent logic in multiple modules
- fire marketing tags before policy allows
- silently change event names/fields without updating docs/TRACKING.md

## When editing schema/migrations
- Prefer additive, rollback-aware migrations
- Document new tables/columns in docs/ARCHITECTURE.md or docs/TRACKING.md when relevant
- Keep IDs stable and explicit

## Required validation mindset
For meaningful changes, consider:
- what can break in public rendering
- what can break in admin auth
- whether privacy gates still hold
- whether first-party analytics still captures the event
- whether one-variant-per-visit still holds
- whether cache invalidation remains correct
