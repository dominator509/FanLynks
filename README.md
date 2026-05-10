# Custom Link Hub v5

Custom Link Hub is a deployed Cloudflare Pages/Functions project for a mobile-first link hub with first-party analytics, privacy-aware tracking, split-test architecture, and admin editing.

Included:
- Cloudflare Pages/Workers-friendly repo structure
- D1 initial migration
- KV-oriented publish/cache notes
- security/privacy/tracking architecture docs
- Pages Functions stubs plus implemented auth/session/page publish path for core public/admin/privacy/event routes
- public page runtime that fetches the live page payload and renders the one-page shell
- client-side tracking dispatcher that only forwards to GA4 / Meta / GTM when the API says it is allowed
- TypeScript/shared type definitions
- Wrangler config for the deployed Cloudflare resources

It is optimized for:
- low drift
- agent-friendly development
- safe incremental buildout
- clear subsystem boundaries

## What is implemented now

- admin login endpoint with Turnstile server-side validation
- signed HTTP-only session cookie creation and parsing
- admin session read endpoint
- admin logout endpoint
- public `GET /api/page/:slug` with KV-first published snapshot resolution
- D1 fallback page snapshot builder
- sticky visitor cookie + session cookie + experiment assignment lookup/create
- effective privacy-state resolution for UK strict mode and GPC-driven ad suppression
- admin `GET/PUT /api/admin/page/:pageId`
- admin `POST /api/admin/page/:pageId/publish` with KV snapshot write + audit log
- `POST /api/events` first-party event ingest with D1 persistence
- centralized privacy-gated forwarding plan builder for GA4 / Meta / GTM / Cloudflare Web Analytics
- `POST /api/privacy/consent` with consent log row + `consent_updated` event row
- `GET /api/privacy/state?page_id=...`
- admin analytics read endpoints:
  - `GET /api/admin/page/:pageId/analytics/summary`
  - `GET /api/admin/page/:pageId/analytics/links`
  - `GET /api/admin/page/:pageId/analytics/experiments`
  - `GET /api/admin/page/:pageId/analytics/sources`
- public `index.html` + `app.js` runtime that:
  - derives slug from the path or `?slug=`
  - fetches `/api/page/:slug`
  - renders the live page shell with variant tokens + content overrides
  - sends `page_view`, `announcement_click`, `hero_cta_click`, and `link_click`
  - consumes the returned forwarding plan so browser tags only fire when policy allows
  - shows a simple privacy banner / privacy choices entry point
- `_redirects` file for SPA-style slug routing back to `index.html`
- admin experiment APIs and lean `admin.html` + `admin.js` surface for:
  - `GET /api/admin/page/:pageId/experiments`
  - `POST /api/admin/page/:pageId/experiments`
  - `GET /api/admin/experiment/:experimentId`
  - `PUT /api/admin/experiment/:experimentId`
  - `POST /api/admin/experiment/:experimentId/start`
  - `POST /api/admin/experiment/:experimentId/pause`
  - `POST /api/admin/experiment/:experimentId/winner`

## Important implementation note

The forwarding layer is **policy-aware and centralized**, but it currently returns a clean **client-side forwarding plan** rather than attempting server-side GA4 Measurement Protocol / Meta CAPI delivery.

That is intentional for this stage because the approved v5 direction is:
- first-party analytics as source of truth
- privacy gating before any third-party send
- direct GA4 / Meta / GTM compatibility on the public page

You can add actual browser tag dispatch hardening or server-side forwarding later without changing the core event model.

## Suggested build order

1. Apply D1 migration
2. Wire local dev with Pages + D1 + KV bindings
3. Seed first admin user + tenant + page data
4. Verify public page render at `/your-slug` or `/?slug=your-slug`
5. Verify `page_view` / click events persist through `POST /api/events`
6. Verify returned forwarding plans gate GA4 / Meta / GTM correctly
7. Replace seed/demo page content with final production copy and destinations
8. Complete any required state-specific privacy UI/legal review
9. Add dashboard rollups + promote-winner-to-base workflow


## Fastest path to first working deploy

1. Install deps and log into Cloudflare.
2. Create the Pages project, D1 database, and KV namespace.
3. Paste the returned IDs into `wrangler.toml`.
4. Set Pages secrets.
5. Apply migrations.
6. Generate a password hash and seed SQL.
7. Execute the seed SQL against D1.
8. Run locally with `npm run dev`.
9. Deploy with `npm run deploy`.
10. Log into `admin.html`, save changes, then click **Publish Live**.

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for the exact command list.

## Helpful scripts

```bash
npm run typecheck
npm run dev
npm run deploy
npm run seed:generate
npm run seed:show
npm run hash:password -- 'replace-with-a-strong-admin-password'
```

## Expected bindings / secrets

- DB
- PAGE_CACHE
- SESSION_SECRET
- TURNSTILE_SECRET_KEY
- TURNSTILE_SITE_KEY

Optional:
- GA4_MEASUREMENT_ID
- META_PIXEL_ID
- GTM_CONTAINER_ID

## Password hash format

The current login implementation expects `users.password_hash` in one of these formats:

- `pbkdf2_sha256$ITERATIONS$SALT$BASE64_HASH`
- `sha256$HEX_DIGEST` (developer fallback only)

Use PBKDF2 for seeded users. The `sha256$...` form exists only to simplify early local scaffolding.

## Notes

- First-party analytics remains the source of truth.
- Third-party tags must never become the primary analytics source.
- Consent logic should remain centralized.
- Public rendering should prefer a normalized published payload from KV first, then fall back to D1 when needed.
- California handling still needs the dedicated user-rights/privacy-UI layer completed; current logic hardens GPC-driven ad suppression and privacy-state resolution, but it does not claim full state-aware compliance by itself.


## v6 additions
- Links + appearance admin surface in `public/admin.html` and `public/admin.js`
- Page baseline theming stored in `pages.page_theme_json` via `migrations/0002_page_theme.sql`
- Admin APIs for CTA row create/update/delete/reorder
- Public page now uses base page theme tokens when no experiment override is active


## v7 additions
- Integrations tab for GA4 / Meta / GTM / Cloudflare Web Analytics settings
- Privacy tab for saved banner copy, labels, banner versioning, and GPC-facing messaging
- `GET/PUT /api/admin/page/:pageId/integrations` endpoint
- public page consumes saved privacy UI copy from page payload


## Dev seed

Generate a starter D1 seed file with:

```bash
npm run seed:generate
```

That writes `seeds/dev_seed.sql` with safe default content, disabled third-party integrations, and a paused experiment.
Set `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` before generation if you need the generated seed to create an active admin user.


## Smoke test

Run the bundled smoke test after local setup or deploy:

```bash
npm run smoke -- --base https://your-project.pages.dev --slug home
```

See `docs/SMOKE_TEST.md` for the manual checklist and expected coverage.
