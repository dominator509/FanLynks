import { describe, expect, it } from 'vitest';
import { forwardEventIfAllowed } from '../../src/server/analytics/forwarding';
import { resolveEffectivePrivacyState, resolveEffectivePrivacyStateForRequest } from '../../src/server/privacy/state';
import { makeD1 } from '../helpers/mock-cloudflare';

describe('privacy and forwarding integration boundary', () => {
  it('resolves consent defaults with UK strict policy and GPC opt-out behavior', async () => {
    const noConsentDb = makeD1([{ match: 'FROM consent_records', first: null }]);

    await expect(resolveEffectivePrivacyState({
      db: noConsentDb,
      pageId: 'page_demo',
      visitorKey: 'visitor_1',
      regionPolicy: 'uk_strict',
      countryCode: 'GB',
      gpcDetected: false
    })).resolves.toMatchObject({
      analyticsConsent: 'denied',
      adsConsent: 'denied'
    });

    const storedConsentDb = makeD1([{ match: 'FROM consent_records', first: { analytics_state: 'granted', ads_state: 'granted' } }]);
    await expect(resolveEffectivePrivacyState({
      db: storedConsentDb,
      pageId: 'page_demo',
      visitorKey: 'visitor_1',
      regionPolicy: 'default_standard',
      countryCode: 'US',
      gpcDetected: true
    })).resolves.toEqual({
      regionPolicy: 'ca_optout_gpc',
      countryCode: 'US',
      gpcDetected: true,
      analyticsConsent: 'granted',
      adsConsent: 'denied'
    });
  });

  it('honors page-level GPC configuration when resolving request privacy state', async () => {
    const db = makeD1([
      { match: 'SELECT page_privacy_json FROM pages', first: { page_privacy_json: JSON.stringify({ honorGpc: false }) } },
      { match: 'FROM consent_records', first: null }
    ]);

    await expect(resolveEffectivePrivacyStateForRequest({
      db,
      request: new Request('https://fanlynks.test/page', { headers: { 'CF-IPCountry': 'US', 'Sec-GPC': '1' } }),
      pageId: 'page_demo',
      visitorKey: 'visitor_1'
    })).resolves.toMatchObject({
      regionPolicy: 'default_standard',
      gpcDetected: false,
      analyticsConsent: 'unknown',
      adsConsent: 'unknown'
    });
  });

  it('builds deterministic client forwarding plans from tracking mode, integrations, and consent', async () => {
    const db = makeD1([
      { match: 'SELECT tracking_mode FROM pages', first: { tracking_mode: 'gtm_meta' } },
      {
        match: 'SELECT provider, config_json FROM integrations',
        all: [
          { provider: 'ga4', config_json: '{}' },
          { provider: 'gtm', config_json: JSON.stringify({ advertisingEnabled: true }) },
          { provider: 'meta', config_json: '{}' },
          { provider: 'cfwa', config_json: JSON.stringify({ enabled: true, privateToken: 'server-only' }) }
        ]
      }
    ]);
    const env = {
      DB: db,
      GA4_MEASUREMENT_ID: 'G-FANLYNKS01',
      GTM_CONTAINER_ID: 'GTM-FAN1234',
      META_PIXEL_ID: '1234567890'
    } as unknown as Env;

    await expect(forwardEventIfAllowed(env, {
      tenant_id: 'tenant_1',
      page_id: 'page_demo',
      event_name: 'page_view',
      region_policy: 'default_standard',
      consent_analytics: 'unknown',
      consent_ads: 'denied',
      occurred_at: '2026-05-17T00:00:00.000Z'
    })).resolves.toEqual({
      analyticsAllowed: true,
      adsAllowed: false,
      destinations: [
        {
          provider: 'ga4',
          allowed: true,
          reason: 'analytics_allowed',
          mode: 'client_only',
          publicConfig: { measurementId: 'G-FANLYNKS01' }
        },
        {
          provider: 'gtm',
          allowed: false,
          reason: 'ads_blocked_by_privacy',
          mode: 'client_only',
          publicConfig: { containerId: 'GTM-FAN1234', advertisingEnabled: true }
        },
        {
          provider: 'meta',
          allowed: false,
          reason: 'ads_blocked_by_privacy',
          mode: 'client_only',
          publicConfig: { pixelId: '1234567890' }
        },
        {
          provider: 'cfwa',
          allowed: true,
          reason: 'analytics_allowed',
          mode: 'client_only',
          publicConfig: { enabled: true }
        }
      ]
    });
  });

  it('short-circuits forwarding when first-party-only tracking disables external destinations', async () => {
    const env = {
      DB: makeD1([{ match: 'SELECT tracking_mode FROM pages', first: { tracking_mode: 'none' } }])
    } as unknown as Env;

    await expect(forwardEventIfAllowed(env, {
      tenant_id: 'tenant_1',
      page_id: 'page_demo',
      event_name: 'page_view',
      occurred_at: '2026-05-17T00:00:00.000Z'
    })).resolves.toEqual({
      analyticsAllowed: false,
      adsAllowed: false,
      destinations: []
    });
  });
});
