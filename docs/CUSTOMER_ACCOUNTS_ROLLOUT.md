# Customer accounts rollout

## Current code boundary

Customer signup defaults to invite-only. Owner invitations are email-bound, expire after seven days, and are consumed during the account-creation transaction. Turning on open registration requires an explicit CUSTOMER_SIGNUP_MODE=open Pages setting.

The customer account routes require Cloudflare Turnstile credentials and use a separate verified-customer session cookie. Account emails go through the private fanlynks-mailer Worker service binding. Customer pages, links, settings, and analytics are scoped to the authenticated tenant. New accounts begin with zero links and zero recorded activity.

## Owner setup and review

1. Confirm the fanlynks.com sending domain is onboarded in Cloudflare Email Service and accounts@fanlynks.com is an approved sender. Configure EMAIL_SENDER and the mailer's APP_ORIGIN as Worker variables. Delivery has not been verified from this checkout because Wrangler has no Cloudflare API token here.
2. Provision the private email Worker with wrangler deploy --config email-worker/wrangler.toml and verify its Email Service binding and sending-domain setup in Cloudflare.
3. Review and apply migrations/0007_customer_accounts.sql to the intended D1 database after migration 0006 and before deploying the Pages code. This migration is additive and must be backed up under the owner's normal D1 release process.
4. Review and deploy the Pages branch with APP_ORIGIN=https://fanlynks.com, CUSTOMER_SIGNUP_MODE=invite_only, real Turnstile site/secret keys, the MAILER service binding, and the existing D1/KV bindings.
5. Sign in as the owner, send a test invitation to an owner-controlled inbox, and verify invitation, email confirmation, login, page/link editing, empty and populated first-party analytics, password recovery, logout, and cross-tenant denial. Check desktop and narrow mobile layouts.
6. Owner reviews the PR and rollout evidence before any production migration or deployment. No migration or deployment was run as part of this change.

## Local visual review

The signup screenshots show the default invite-only state with no invite token. The dashboard screenshots use a disposable customer fixture in Wrangler's local D1, with zero recorded page views and clicks. No account form was submitted and no production data was used. The desktop viewport is 1440 x 1000; the mobile viewport is 390 x 844.

- Signup: [desktop](screenshots/customer-signup-desktop.png), [mobile](screenshots/customer-signup-mobile.png)
- Dashboard: [desktop](screenshots/customer-dashboard-desktop.png), [mobile](screenshots/customer-dashboard-mobile.png)

## Rollback

Roll back the Pages deployment to the previously active build. The migration only adds account columns and tables, so it can remain in place while the earlier Pages code is restored. Disable or retain the private mailer Worker according to the owner's Cloudflare change process.
