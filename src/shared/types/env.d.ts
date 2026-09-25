interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  PAGE_CACHE: KVNamespace;
  SESSION_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  TURNSTILE_SITE_KEY: string;
  MAILER?: Fetcher;
  APP_NAME?: string;
  APP_ORIGIN?: string;
  CUSTOMER_SIGNUP_MODE?: 'invite_only' | 'open';
  GA4_MEASUREMENT_ID?: string;
  META_PIXEL_ID?: string;
  GTM_CONTAINER_ID?: string;
}
