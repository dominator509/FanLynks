# TRACKING.md

## Principle
First-party analytics is the source of truth.
External tools receive filtered copies only when policy allows.

## Core events
- `page_view`
- `announcement_click`
- `hero_cta_click`
- `link_click`
- `social_click`
- `consent_updated`
- `experiment_assigned`
- `admin_login_success`
- `admin_publish`

## Common fields
- `tenant_id`
- `page_id`
- `page_slug`
- `experiment_id`
- `variant_id`
- `event_name`
- `link_id`
- `section_id`
- `row_index`
- `destination_url`
- `destination_domain`
- `referrer`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `country_code`
- `region_policy`
- `consent_analytics`
- `consent_ads`
- `gpc_detected`
- `device_type`
- `user_agent_hash`
- `session_id`
- `occurred_at`

## Forwarding model
Every forwarded third-party event must:
1. originate from a recorded first-party event
2. pass privacy policy gating
3. preserve experiment/variant dimensions where applicable

## Supported integrations
- GA4 direct
- Meta direct
- GTM dataLayer mode
- Cloudflare Web Analytics overlay

## GTM guidance
Push normalized event objects to `dataLayer`.
Keep field names stable.
Do not create variant-specific tracking schemas.

## Naming rules
- event names are snake_case
- dimensions should remain stable across variants
- adding fields is allowed when backward compatible
- renaming/removing fields requires doc updates and migration notes

## Reporting expectations
MVP reporting should answer:
- which rows get clicked
- which traffic sources drive clicks
- which variant performs best
- whether consent gating changes forwarding volume
