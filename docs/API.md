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

## Contract rules
- JSON in, JSON out
- explicit error codes/messages
- admin mutating routes require valid session
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
