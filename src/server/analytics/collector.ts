import type { CoreEventName, CoreEventPayload, EventIngestRequest } from '../../shared/types/events';
import { makeId } from '../db/ids';
import { normalizeOptionalPublicUrl } from '../security/validation';

interface PageLookupRow {
  id: string;
  tenant_id: string;
  slug: string;
}

interface LinkLookupRow {
  id: string;
  section_id: string | null;
  row_order: number;
  url: string;
}

const ALLOWED_EVENT_NAMES = new Set<CoreEventName>([
  'page_view',
  'announcement_click',
  'hero_cta_click',
  'link_click',
  'social_click',
  'experiment_assigned'
]);

export interface CollectEventInput {
  db: D1Database;
  body: EventIngestRequest | null;
  countryCode: string | null;
  regionPolicy: string;
  analyticsConsent: 'unknown' | 'granted' | 'denied';
  adsConsent: 'unknown' | 'granted' | 'denied';
  gpcDetected: boolean;
  sessionId: string;
  request: Request;
}

export interface StoredEventResult {
  eventId: string;
  payload: CoreEventPayload;
}

export async function collectAndPersistEvent(args: CollectEventInput): Promise<StoredEventResult> {
  const body = args.body ?? {};
  const eventName = normalizeEventName(body.event_name);
  if (!eventName) throw new Error('Invalid event_name.');

  const page = await lookupPage(args.db, body.page_id, body.page_slug);
  if (!page) throw new Error('Page not found.');

  const link = body.link_id ? await lookupLink(args.db, page.id, body.link_id) : null;
  const destinationUrl = normalizeOptionalPublicUrl(body.destination_url) ?? normalizeOptionalPublicUrl(link?.url) ?? null;
  const destinationDomain = normalizeDomain(body.destination_domain) || getDomain(destinationUrl);
  const occurredAt = normalizeOccurredAt(body.occurred_at);
  const userAgent = args.request.headers.get('user-agent') ?? '';

  const payload: CoreEventPayload = {
    tenant_id: page.tenant_id,
    page_id: page.id,
    page_slug: page.slug,
    experiment_id: normalizeNullableString(body.experiment_id),
    variant_id: normalizeNullableString(body.variant_id),
    event_name: eventName,
    link_id: body.link_id ?? link?.id ?? null,
    section_id: normalizeNullableString(body.section_id) ?? link?.section_id ?? null,
    row_index: normalizeInteger(body.row_index) ?? link?.row_order ?? null,
    destination_url: destinationUrl,
    destination_domain: destinationDomain,
    referrer: normalizeReferrer(body.referrer) || normalizeReferrer(args.request.headers.get('referer')) || null,
    utm_source: normalizeNullableString(body.utm_source),
    utm_medium: normalizeNullableString(body.utm_medium),
    utm_campaign: normalizeNullableString(body.utm_campaign),
    utm_content: normalizeNullableString(body.utm_content),
    utm_term: normalizeNullableString(body.utm_term),
    country_code: args.countryCode,
    region_policy: args.regionPolicy,
    consent_analytics: args.analyticsConsent,
    consent_ads: args.adsConsent,
    gpc_detected: args.gpcDetected,
    device_type: detectDeviceType(userAgent),
    user_agent_hash: userAgent ? await sha256Hex(userAgent) : null,
    session_id: args.sessionId,
    occurred_at: occurredAt
  };

  const eventId = makeId('evt');
  await args.db
    .prepare(`
      INSERT INTO events (
        id,
        tenant_id,
        page_id,
        experiment_id,
        variant_id,
        event_name,
        event_payload_json,
        occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      eventId,
      payload.tenant_id,
      payload.page_id,
      payload.experiment_id,
      payload.variant_id,
      payload.event_name,
      JSON.stringify(payload),
      payload.occurred_at
    )
    .run();

  return { eventId, payload };
}

async function lookupPage(db: D1Database, pageId?: string, pageSlug?: string): Promise<PageLookupRow | null> {
  if (pageId) {
    const page = await db
      .prepare(`
        SELECT id, tenant_id, slug
        FROM pages
        WHERE id = ? AND is_active = 1
        LIMIT 1
      `)
      .bind(pageId)
      .first<PageLookupRow>();
    if (page) return page;
  }

  if (pageSlug) {
    return db
      .prepare(`
        SELECT id, tenant_id, slug
        FROM pages
        WHERE slug = ? AND is_active = 1
        LIMIT 1
      `)
      .bind(pageSlug)
      .first<PageLookupRow>();
  }

  return null;
}

async function lookupLink(db: D1Database, pageId: string, linkId: string): Promise<LinkLookupRow | null> {
  return db
    .prepare(`
      SELECT id, section_id, row_order, url
      FROM page_links
      WHERE id = ? AND page_id = ?
      LIMIT 1
    `)
    .bind(linkId, pageId)
    .first<LinkLookupRow>();
}

function normalizeEventName(input?: string): CoreEventName | null {
  if (!input) return null;
  return ALLOWED_EVENT_NAMES.has(input as CoreEventName) ? (input as CoreEventName) : null;
}

function normalizeNullableString(input?: string | null): string | null {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  return value && value.length <= 160 ? value : null;
}

function normalizeInteger(input?: number | null): number | null {
  if (typeof input !== 'number' || !Number.isFinite(input)) return null;
  return Math.trunc(input);
}

function normalizeOccurredAt(input?: string | null): string {
  if (!input) return new Date().toISOString();
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  const now = Date.now();
  const time = date.getTime();
  if (time < now - 24 * 60 * 60 * 1000 || time > now + 5 * 60 * 1000) return new Date().toISOString();
  return date.toISOString();
}

function getDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function normalizeDomain(input?: string | null): string | null {
  if (typeof input !== 'string') return null;
  const value = input.trim().toLowerCase();
  return /^[a-z0-9.-]{1,253}$/.test(value) ? value : null;
}

function normalizeReferrer(input?: string | null): string | null {
  return normalizeOptionalPublicUrl(input);
}

function detectDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return 'tablet';
  if (/mobi|iphone|android/.test(ua)) return 'mobile';
  return 'desktop';
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const bytes = new Uint8Array(digest);
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
