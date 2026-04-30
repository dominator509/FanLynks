export type CoreEventName =
  | 'page_view'
  | 'announcement_click'
  | 'hero_cta_click'
  | 'link_click'
  | 'social_click'
  | 'consent_updated'
  | 'experiment_assigned'
  | 'admin_login_success'
  | 'admin_publish';

export type ConsentState = 'unknown' | 'granted' | 'denied';

export interface CoreEventPayload {
  tenant_id: string;
  page_id: string;
  page_slug?: string;
  experiment_id?: string | null;
  variant_id?: string | null;
  event_name: CoreEventName;
  link_id?: string | null;
  section_id?: string | null;
  row_index?: number | null;
  destination_url?: string | null;
  destination_domain?: string | null;
  referrer?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  country_code?: string | null;
  region_policy?: string | null;
  consent_analytics?: ConsentState | null;
  consent_ads?: ConsentState | null;
  gpc_detected?: boolean | null;
  device_type?: string | null;
  user_agent_hash?: string | null;
  session_id?: string | null;
  occurred_at: string;
}

export interface EventIngestRequest {
  event_name?: string;
  page_id?: string;
  page_slug?: string;
  experiment_id?: string | null;
  variant_id?: string | null;
  link_id?: string | null;
  section_id?: string | null;
  row_index?: number | null;
  destination_url?: string | null;
  destination_domain?: string | null;
  referrer?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  session_id?: string | null;
  occurred_at?: string | null;
}

export type ForwardingProvider = 'ga4' | 'meta' | 'gtm' | 'cfwa';

export interface ForwardingDestination {
  provider: ForwardingProvider;
  allowed: boolean;
  reason: string;
  mode: 'client_only';
  publicConfig: Record<string, unknown>;
}

export interface ForwardingPlan {
  analyticsAllowed: boolean;
  adsAllowed: boolean;
  destinations: ForwardingDestination[];
}
