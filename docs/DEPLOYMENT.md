# DEPLOYMENT.md

## Launch target
- Cloudflare Pages project
- Pages Functions / Workers runtime
- D1 binding: `DB`
- KV binding: `PAGE_CACHE`
- Pages secrets for session and Turnstile

## Current Cloudflare notes
- `npx wrangler pages project create [PROJECT-NAME]` creates a Pages project.
- `npx wrangler pages secret put [KEY] --project-name [PROJECT-NAME]` creates or updates a Pages secret.
- `npx wrangler d1 migrations apply [DATABASE_NAME]` applies D1 migrations.
- The Wrangler configuration file applies locally when using `wrangler pages dev`.

## Assumptions used below
Replace these names if you want different ones:
- Pages project: `custom-link-hub-v5`
- D1 database: `custom-link-hub`
- KV binding: `PAGE_CACHE`

## 1) Prerequisites
```bash
npm install
npx wrangler login
```

## 2) Create the Pages project
```bash
npx wrangler pages project create custom-link-hub-v5
```

## 3) Create D1
```bash
npx wrangler d1 create custom-link-hub
```
Copy the returned `database_id` into `wrangler.toml` under the `DB` binding.

## 4) Create KV
```bash
npx wrangler kv namespace create PAGE_CACHE
npx wrangler kv namespace create PAGE_CACHE --preview
```
Copy the returned IDs into `wrangler.toml` under `PAGE_CACHE.id` and `PAGE_CACHE.preview_id`.

## 5) Set Pages secrets
Use the Pages-specific secret command, not the generic Worker secret command.
```bash
npx wrangler pages secret put SESSION_SECRET --project-name custom-link-hub-v5
npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name custom-link-hub-v5
npx wrangler pages secret put TURNSTILE_SITE_KEY --project-name custom-link-hub-v5
```
Optional:
```bash
npx wrangler pages secret put GA4_MEASUREMENT_ID --project-name custom-link-hub-v5
npx wrangler pages secret put META_PIXEL_ID --project-name custom-link-hub-v5
npx wrangler pages secret put GTM_CONTAINER_ID --project-name custom-link-hub-v5
```

## 6) Apply database migrations
Remote/prod database:
```bash
npx wrangler d1 migrations apply custom-link-hub --remote
```
Local dev database:
```bash
npx wrangler d1 migrations apply custom-link-hub --local
```

## 7) Generate a password hash for the seeded admin
```bash
npm run hash:password -- 'replace-with-strong-password'
```
Copy the printed hash into the generated seed SQL or your own insert statement.

## 8) Generate and apply seed data
```bash
npm run seed:generate
```
This writes `seeds/dev_seed.sql`. Review it, replace placeholders, then apply it:
```bash
npx wrangler d1 execute custom-link-hub --remote --file=./seeds/dev_seed.sql
```
For local dev instead:
```bash
npx wrangler d1 execute custom-link-hub --local --file=./seeds/dev_seed.sql
```

## 9) Run locally
```bash
npm run dev
```
Open the local Pages URL Wrangler prints.

## 10) Deploy
```bash
npm run deploy
```
If you want to be explicit:
```bash
npx wrangler pages deploy public --project-name custom-link-hub-v5
```

## 11) Post-deploy smoke test
- open `/<your-page-slug>`
- verify the page renders
- verify `admin.html` loads
- log in with the seeded admin
- save a draft change
- click **Publish Live**
- reload the public page and confirm the published version increments
- confirm `page_view` and click events land in D1

## Local development notes
- Keep `.dev.vars` out of source control.
- Use local D1 for schema/seed iteration before touching remote.
- The repo keeps `wrangler.toml` for continuity, even though Cloudflare now recommends `wrangler.jsonc` for new projects.

## Rollback notes
- Re-run a previous published snapshot by publishing older canonical data again.
- D1 migration rollback is manual; do not treat migrations as trivially reversible.
- If a deploy breaks public rendering, the fastest safe rollback is usually to redeploy the last known-good repo state and republish the page snapshot.


## Smoke test

Run the bundled smoke test after local setup or deploy:

```bash
npm run smoke -- --base https://your-project.pages.dev --slug home
```

See `docs/SMOKE_TEST.md` for the manual checklist and expected coverage.
