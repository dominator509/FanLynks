import { errorJson, json, readJson } from '../../../_utils';
import { parseSessionCookie } from '../../../../../src/server/auth/session';
import { makeId } from '../../../../../src/server/db/ids';

const PROVIDERS = ['ga4', 'meta', 'gtm', 'cfwa'] as const;
type Provider = typeof PROVIDERS[number];

interface IntegrationInput {
  isEnabled?: boolean;
  config?: Record<string, unknown>;
}

function normalizeProviderConfig(provider: Provider, input: Record<string, unknown> | undefined, env: Env): Record<string, unknown> {
  const config = { ...(input || {}) };
  if (provider === 'ga4' && !config.measurementId && env.GA4_MEASUREMENT_ID) config.measurementId = env.GA4_MEASUREMENT_ID;
  if (provider === 'meta' && !config.pixelId && env.META_PIXEL_ID) config.pixelId = env.META_PIXEL_ID;
  if (provider === 'gtm' && !config.containerId && env.GTM_CONTAINER_ID) config.containerId = env.GTM_CONTAINER_ID;
  if (provider === 'cfwa' && config.enabled === undefined) config.enabled = true;
  return config;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const session = await parseSessionCookie(context.request, context.env.SESSION_SECRET);
  if (!session) return errorJson('Unauthorized.', 401);

  const pageId = context.params.pageId as string;
  const page = await context.env.DB.prepare('SELECT tenant_id FROM pages WHERE id = ? LIMIT 1').bind(pageId).first<{ tenant_id: string }>();
  if (!page) return errorJson('Page not found.', 404);
  if (page.tenant_id !== session.tenantId) return errorJson('Forbidden.', 403);

  const rows = await context.env.DB.prepare(`
    SELECT provider, is_enabled, config_json
    FROM integrations
    WHERE page_id = ?
    ORDER BY provider ASC
  `).bind(pageId).all<{ provider: Provider; is_enabled: number; config_json: string }>();

  const integrations: Record<string, { isEnabled: boolean; config: Record<string, unknown> }> = {};
  for (const provider of PROVIDERS) {
    integrations[provider] = {
      isEnabled: false,
      config: normalizeProviderConfig(provider, {}, context.env)
    };
  }

  for (const row of rows.results ?? []) {
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(row.config_json || '{}'); } catch {}
    integrations[row.provider] = {
      isEnabled: Boolean(row.is_enabled),
      config: normalizeProviderConfig(row.provider, parsed, context.env)
    };
  }

  return json({ ok: true, integrations });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const session = await parseSessionCookie(context.request, context.env.SESSION_SECRET);
  if (!session) return errorJson('Unauthorized.', 401);

  const pageId = context.params.pageId as string;
  const page = await context.env.DB.prepare('SELECT tenant_id FROM pages WHERE id = ? LIMIT 1').bind(pageId).first<{ tenant_id: string }>();
  if (!page) return errorJson('Page not found.', 404);
  if (page.tenant_id !== session.tenantId) return errorJson('Forbidden.', 403);

  const body = await readJson(context.request);
  const input = (body?.integrations && typeof body.integrations === 'object') ? body.integrations as Record<string, IntegrationInput> : null;
  if (!input) return errorJson('Missing integrations payload.', 400);

  const nowIso = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  const saved: Record<string, { isEnabled: boolean; config: Record<string, unknown> }> = {};

  for (const provider of PROVIDERS) {
    const providerInput = input[provider] || {};
    const isEnabled = Boolean(providerInput.isEnabled);
    const config = normalizeProviderConfig(provider, providerInput.config, context.env);
    saved[provider] = { isEnabled, config };

    const existing = await context.env.DB.prepare('SELECT id FROM integrations WHERE page_id = ? AND provider = ? LIMIT 1').bind(pageId, provider).first<{ id: string }>();
    if (existing?.id) {
      statements.push(context.env.DB.prepare(`
        UPDATE integrations
        SET is_enabled = ?, config_json = ?, updated_at = ?
        WHERE id = ?
      `).bind(isEnabled ? 1 : 0, JSON.stringify(config), nowIso, existing.id));
    } else {
      statements.push(context.env.DB.prepare(`
        INSERT INTO integrations (id, page_id, provider, config_json, is_enabled, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(makeId('intg'), pageId, provider, JSON.stringify(config), isEnabled ? 1 : 0, nowIso, nowIso));
    }
  }

  statements.push(context.env.DB.prepare(`
    INSERT INTO audit_log (id, tenant_id, user_id, action, target_type, target_id, diff_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    makeId('audit'),
    session.tenantId,
    session.userId,
    'integrations_update',
    'page',
    pageId,
    JSON.stringify(saved),
    nowIso
  ));

  await context.env.DB.batch(statements);
  return json({ ok: true, saved: true, integrations: saved });
};
