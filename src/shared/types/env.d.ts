interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  PAGE_CACHE: KVNamespace;
  SESSION_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  TURNSTILE_SITE_KEY: string;
  APP_NAME?: string;
  GA4_MEASUREMENT_ID?: string;
  META_PIXEL_ID?: string;
  GTM_CONTAINER_ID?: string;
}
