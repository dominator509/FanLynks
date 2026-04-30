import type { EffectivePrivacyState, PublishedIntegration } from '../../shared/types/page';
import type { CoreEventPayload, ForwardingDestination, ForwardingPlan, ForwardingProvider } from '../../shared/types/events';

interface PageContextRow {
  tracking_mode: string;
}

interface IntegrationRow {
  provider: ForwardingProvider;
  config_json: string;
}

export async function forwardEventIfAllowed(env: Env, event: CoreEventPayload): Promise<ForwardingPlan> {
  const pageContext = await env.DB.prepare(`
    SELECT tracking_mode
    FROM pages
    WHERE id = ?
    LIMIT 1
  `)
    .bind(event.page_id)
    .first<PageContextRow>();

  if (!pageContext || pageContext.tracking_mode === 'none') {
    return {
      analyticsAllowed: false,
      adsAllowed: false,
      destinations: []
    };
  }

  const integrationsRes = await env.DB.prepare(`
    SELECT provider, config_json
    FROM integrations
    WHERE page_id = ? AND is_enabled = 1
    ORDER BY provider ASC
  `)
    .bind(event.page_id)
    .all<IntegrationRow>();

  const effectivePrivacy: EffectivePrivacyState = {
    regionPolicy: event.region_policy ?? 'default_standard',
    countryCode: event.country_code ?? null,
    gpcDetected: Boolean(event.gpc_detected),
    analyticsConsent: event.consent_analytics ?? 'unknown',
    adsConsent: event.consent_ads ?? 'unknown'
  };

  const analyticsAllowed = canForwardAnalytics(effectivePrivacy);
  const adsAllowed = canForwardAds(effectivePrivacy);

  const destinations = (integrationsRes.results ?? []).map((row) => {
    const integration = rowToPublishedIntegration(row, env);
    return buildDestination(integration, analyticsAllowed, adsAllowed);
  });

  return {
    analyticsAllowed,
    adsAllowed,
    destinations
  };
}

function canForwardAnalytics(privacy: EffectivePrivacyState): boolean {
  if (privacy.regionPolicy === 'uk_strict') {
    return privacy.analyticsConsent === 'granted';
  }
  return privacy.analyticsConsent !== 'denied';
}

function canForwardAds(privacy: EffectivePrivacyState): boolean {
  if (privacy.gpcDetected || privacy.regionPolicy === 'ca_optout_gpc') {
    return false;
  }

  if (privacy.regionPolicy === 'uk_strict') {
    return privacy.adsConsent === 'granted';
  }

  return privacy.adsConsent !== 'denied';
}

function rowToPublishedIntegration(row: IntegrationRow, env: Env): PublishedIntegration {
  const config = safeParseJson(row.config_json);

  if (row.provider === 'ga4' && !config.measurementId && env.GA4_MEASUREMENT_ID) {
    config.measurementId = env.GA4_MEASUREMENT_ID;
  }
  if (row.provider === 'meta' && !config.pixelId && env.META_PIXEL_ID) {
    config.pixelId = env.META_PIXEL_ID;
  }
  if (row.provider === 'gtm' && !config.containerId && env.GTM_CONTAINER_ID) {
    config.containerId = env.GTM_CONTAINER_ID;
  }

  return {
    provider: row.provider,
    isEnabled: true,
    config
  };
}

function buildDestination(
  integration: PublishedIntegration,
  analyticsAllowed: boolean,
  adsAllowed: boolean
): ForwardingDestination {
  const provider = integration.provider;
  const publicConfig = sanitizePublicConfig(provider, integration.config);

  if (provider === 'meta') {
    return {
      provider,
      allowed: adsAllowed,
      reason: adsAllowed ? 'ads_allowed' : 'ads_blocked_by_privacy',
      mode: 'client_only',
      publicConfig
    };
  }

  if (provider === 'ga4' || provider === 'cfwa') {
    return {
      provider,
      allowed: analyticsAllowed,
      reason: analyticsAllowed ? 'analytics_allowed' : 'analytics_blocked_by_privacy',
      mode: 'client_only',
      publicConfig
    };
  }

  const hasAdPurpose = Boolean(integration.config.advertisingEnabled);
  const allowed = hasAdPurpose ? adsAllowed : analyticsAllowed;
  return {
    provider,
    allowed,
    reason: allowed
      ? hasAdPurpose ? 'ads_allowed' : 'analytics_allowed'
      : hasAdPurpose ? 'ads_blocked_by_privacy' : 'analytics_blocked_by_privacy',
    mode: 'client_only',
    publicConfig
  };
}

function sanitizePublicConfig(provider: ForwardingProvider, config: Record<string, unknown>): Record<string, unknown> {
  switch (provider) {
    case 'ga4':
      return pick(config, ['measurementId', 'enablePageViews', 'enableClickEvents', 'enableExperimentParameters']);
    case 'meta':
      return pick(config, ['pixelId', 'eventMappings']);
    case 'gtm':
      return pick(config, ['containerId', 'advertisingEnabled']);
    case 'cfwa':
      return pick(config, ['enabled']);
    default:
      return {};
  }
}

function pick(source: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (source[key] !== undefined) result[key] = source[key];
  }
  return result;
}

function safeParseJson(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}
