# API.md

## Public routes
- `GET /api/page/:slug`
- `POST /api/events`
- `GET /api/privacy/state`
- `POST /api/privacy/consent`

## Admin auth routes
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/session`
- `POST /api/admin/customer-invites` (owner/admin only; creates a seven-day, email-bound beta invitation)

## Customer account routes
- `GET /api/customer/config`
- `POST /api/customer/signup` (invite-only by default; open registration requires an explicit `CUSTOMER_SIGNUP_MODE=open` deployment setting)
- `POST /api/customer/login`
- `GET /api/customer/session`
- `POST /api/customer/logout`
- `POST /api/customer/verify-email`
- `POST /api/customer/resend-verification`
- `POST /api/customer/forgot-password`
- `POST /api/customer/reset-password`
- `GET /api/customer/dashboard` (tenant-scoped page, link, and seven-day first-party analytics data)
- `PUT /api/customer/page`
- `GET` / `POST /api/customer/links`
- `PUT` / `DELETE /api/customer/links/:linkId`
- `GET` / `PUT /api/customer/settings`
- `PUT /api/customer/password`

## Admin page routes
- `GET /api/admin/page/:pageId`
- `PUT /api/admin/page/:pageId`
- `POST /api/admin/page/:pageId/publish`

## Experiments
- `GET /api/admin/page/:pageId/experiments`
- `POST /api/admin/page/:pageId/experiments`
- `PUT /api/admin/experiment/:experimentId`
- `POST /api/admin/experiment/:experimentId/start`
- `POST /api/admin/experiment/:experimentId/pause`
- `POST /api/admin/experiment/:experimentId/winner`

## Analytics
- `GET /api/admin/page/:pageId/analytics/summary`
- `GET /api/admin/page/:pageId/analytics/links`
- `GET /api/admin/page/:pageId/analytics/experiments`
- `GET /api/admin/page/:pageId/analytics/sources`

## AXIOM first-party analytics
- `GET /api/admin/page/:pageId/axiom-token` — read token status; never returns an existing token.
- `POST /api/admin/page/:pageId/axiom-token` — issue or rotate the page-scoped, read-only bearer token; the secret is returned once.
- `DELETE /api/admin/page/:pageId/axiom-token` — revoke the active token.
- `GET /api/integrations/axiom/analytics?since=<ISO>&until=<ISO>` — read only aggregated first-party page views and clicks by date, UTM source and medium. Requires `Authorization: Bearer flx_axm_…`; maximum range is 90 days.
- The AXIOM token is limited to the page selected when it is issued. It cannot read admin configuration, visitor-level events, consent records, or mutate data. It is stored as a SHA-256 digest and may be rotated or revoked from the authenticated admin page.
- The endpoint explicitly reports that unique visitors and conversion counts are not included in the current first-party export.
- Requests that would exceed 10,000 daily source/medium rows fail with HTTP 422; shorten the date range rather than importing partial results.

## Contract rules
- JSON in, JSON out
- explicit error codes/messages
- admin mutating routes require valid session
- customer routes use a separate signed cookie and require a verified `customer` account; admin routes accept only `owner` accounts
- customer queries scope page, link, analytics, and settings access by the session tenant
- customer mutations require a same-origin request and write audit events
- privacy-sensitive routes must resolve effective region policy server-side


## Experiment routes added in v5 starter v5

- `GET /api/admin/page/:pageId/experiments`
- `POST /api/admin/page/:pageId/experiments`
- `GET /api/admin/experiment/:experimentId`
- `PUT /api/admin/experiment/:experimentId`
- `POST /api/admin/experiment/:experimentId/start`
- `POST /api/admin/experiment/:experimentId/pause`
- `POST /api/admin/experiment/:experimentId/winner`


## Added in v7
- `GET /api/admin/page/:pageId/integrations`
- `PUT /api/admin/page/:pageId/integrations`
