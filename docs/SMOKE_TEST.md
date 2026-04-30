# SMOKE_TEST.md

Use this after local setup or after a Pages deploy to catch the highest-value breakages fast.

## Fast path

Local default:
```bash
npm run smoke
```

Against a deployed URL:
```bash
npm run smoke -- --base https://your-project.pages.dev --slug home
```

Verbose output:
```bash
npm run smoke -- --base https://your-project.pages.dev --slug home --verbose
```

## What the smoke script checks

1. `GET /api/page/:slug`
   - page payload resolves
   - page id exists
   - links array exists
2. `GET /api/privacy/state?page_id=...`
   - privacy state resolves
3. `POST /api/events` with `page_view`
   - first-party event ingest works
4. `POST /api/events` with `link_click`
   - click ingest works when a usable first link exists
5. `POST /api/privacy/consent`
   - consent write path works
6. `GET /api/privacy/state` again
   - consent update is reflected
7. `GET /<slug>`
   - public HTML shell serves
8. `GET /admin.html`
   - admin shell serves

## What it intentionally does not automate

- Turnstile-protected admin login
- draft save + publish actions
- D1 row-by-row content assertions
- third-party GA4 / Meta / GTM live tag behavior

Those should still be checked manually in a launch pass.

## Manual launch checklist

### Public page
- open `/your-slug`
- confirm title/subtitle/avatar/buttons render
- click first CTA row
- verify the button destination opens correctly
- verify privacy banner text matches your configured copy

### Privacy
- choose **Analytics only**
- refresh and confirm the privacy status text persists
- choose **Essential only**
- confirm ad-forwarding stays denied
- in California/GPC testing, confirm the UI acknowledges GPC and suppresses ad-sharing behavior

### Admin
- open `/admin.html`
- log in successfully
- load the page record
- edit a draft field
- save draft
- click **Publish Live**
- reload `/your-slug`
- confirm published version incremented and the public page changed

### Analytics
- reload the public page a few times
- click a few CTA rows
- open admin analytics
- confirm visitors, clicks, top row, and sources update
- if running an experiment, confirm the variant table is populated

### Integrations
- save GA4 / Meta / GTM settings from admin
- confirm the integration values reload correctly after refresh
- confirm privacy gating still blocks third-party forwarding when consent denies it

## Useful companion checks

Check common placeholder mistakes before production deploy:
```bash
npm run deploy:check
```
