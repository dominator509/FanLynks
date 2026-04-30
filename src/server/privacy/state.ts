import type { EffectivePrivacyState } from '../../shared/types/page';
import { detectGpc, resolveRegionPolicy, type RegionPolicy } from './policy';

interface StoredConsentRecord {
  analytics_state: 'unknown' | 'granted' | 'denied';
  ads_state: 'unknown' | 'granted' | 'denied';
}

export async function getLatestConsentRecord(args: {
  db: D1Database;
  pageId: string;
  visitorKey: string;
}): Promise<StoredConsentRecord | null> {
  return args.db
    .prepare(`
      SELECT analytics_state, ads_state
      FROM consent_records
      WHERE page_id = ? AND visitor_key = ?
      ORDER BY recorded_at DESC
      LIMIT 1
    `)
    .bind(args.pageId, args.visitorKey)
    .first<StoredConsentRecord>();
}

export async function resolveEffectivePrivacyState(args: {
  db: D1Database;
  pageId: string;
  visitorKey: string;
  regionPolicy: RegionPolicy;
  countryCode: string | null;
  gpcDetected: boolean;
}): Promise<EffectivePrivacyState> {
  const consent = await getLatestConsentRecord({
    db: args.db,
    pageId: args.pageId,
    visitorKey: args.visitorKey
  });

  if (args.regionPolicy === 'uk_strict') {
    return {
      regionPolicy: args.regionPolicy,
      countryCode: args.countryCode,
      gpcDetected: args.gpcDetected,
      analyticsConsent: consent?.analytics_state === 'granted' ? 'granted' : 'denied',
      adsConsent: consent?.ads_state === 'granted' ? 'granted' : 'denied'
    };
  }

  if (args.gpcDetected) {
    return {
      regionPolicy: 'ca_optout_gpc',
      countryCode: args.countryCode,
      gpcDetected: true,
      analyticsConsent: consent?.analytics_state ?? 'unknown',
      adsConsent: 'denied'
    };
  }

  return {
    regionPolicy: args.regionPolicy,
    countryCode: args.countryCode,
    gpcDetected: args.gpcDetected,
    analyticsConsent: consent?.analytics_state ?? 'unknown',
    adsConsent: consent?.ads_state ?? 'unknown'
  };
}

async function getPagePrivacyUi(db: D1Database, pageId: string): Promise<Record<string, unknown>> {
  const row = await db.prepare('SELECT page_privacy_json FROM pages WHERE id = ? LIMIT 1').bind(pageId).first<{ page_privacy_json: string | null }>();
  if (!row?.page_privacy_json) return {};
  try { return JSON.parse(row.page_privacy_json) as Record<string, unknown>; } catch { return {}; }
}

export async function resolveEffectivePrivacyStateForRequest(args: {
  db: D1Database;
  request: Request;
  pageId: string;
  visitorKey: string;
}): Promise<EffectivePrivacyState> {
  const region = resolveRegionPolicy(args.request);
  const privacyUi = await getPagePrivacyUi(args.db, args.pageId);
  const honorGpc = privacyUi.honorGpc !== false;
  const gpcDetected = honorGpc && detectGpc(args.request);

  return resolveEffectivePrivacyState({
    db: args.db,
    pageId: args.pageId,
    visitorKey: args.visitorKey,
    regionPolicy: region.regionPolicy,
    countryCode: region.countryCode,
    gpcDetected
  });
}
