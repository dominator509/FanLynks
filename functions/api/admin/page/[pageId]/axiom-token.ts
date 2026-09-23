import { errorJson, json } from '../../../_utils';
import { validateAdminSession } from '../../../../../src/server/auth/session';
import { createAxiomAnalyticsToken } from '../../../../../src/server/auth/axiom-analytics-token';
import { makeId } from '../../../../../src/server/db/ids';

type Context = EventContext<Env, string, unknown>;
type PageAccess = { pageId: string; tenantId: string; userId: string };

async function requirePageAdmin(context: Context): Promise<PageAccess | Response> {
  const session = await validateAdminSession({
    request: context.request,
    secret: context.env.SESSION_SECRET,
    db: context.env.DB,
  });
  if (!session) return errorJson('Unauthorized.', 401);

  const pageId = context.params.pageId;
  const page = await context.env.DB.prepare(`
    SELECT id, tenant_id FROM pages WHERE id = ? LIMIT 1
  `).bind(pageId).first<{ id: string; tenant_id: string }>();
  if (!page) return errorJson('Page not found.', 404);
  if (page.tenant_id !== session.tenantId) return errorJson('Forbidden.', 403);
  return { pageId, tenantId: page.tenant_id, userId: session.userId };
}

export const onRequestGet: PagesFunction<Env> = async (rawContext) => {
  const context = rawContext as Context;
  const access = await requirePageAdmin(context);
  if (access instanceof Response) return access;

  const token = await context.env.DB.prepare(`
    SELECT token_prefix, created_at, last_used_at
    FROM integration_api_tokens
    WHERE page_id = ? AND tenant_id = ? AND revoked_at IS NULL
    LIMIT 1
  `).bind(access.pageId, access.tenantId).first<{
    token_prefix: string;
    created_at: string;
    last_used_at: string | null;
  }>();

  return json({
    ok: true,
    token: token ? {
      configured: true,
      prefix: token.token_prefix,
      createdAt: token.created_at,
      lastUsedAt: token.last_used_at,
    } : { configured: false, prefix: null, createdAt: null, lastUsedAt: null },
  }, 200, { 'Cache-Control': 'no-store' });
};

export const onRequestPost: PagesFunction<Env> = async (rawContext) => {
  const context = rawContext as Context;
  const access = await requirePageAdmin(context);
  if (access instanceof Response) return access;

  const issuedAt = new Date().toISOString();
  const token = await createAxiomAnalyticsToken();
  const rotated = await context.env.DB.prepare(`
    SELECT id FROM integration_api_tokens
    WHERE page_id = ? AND tenant_id = ? AND revoked_at IS NULL
    LIMIT 1
  `).bind(access.pageId, access.tenantId).first<{ id: string }>();

  await context.env.DB.batch([
    context.env.DB.prepare(`
      UPDATE integration_api_tokens SET revoked_at = ?
      WHERE page_id = ? AND tenant_id = ? AND revoked_at IS NULL
    `).bind(issuedAt, access.pageId, access.tenantId),
    context.env.DB.prepare(`
      INSERT INTO integration_api_tokens
        (id, tenant_id, page_id, created_by, token_hash, token_prefix, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(makeId('integration_token'), access.tenantId, access.pageId, access.userId, token.tokenHash, token.tokenPrefix, issuedAt),
    context.env.DB.prepare(`
      INSERT INTO audit_log (id, tenant_id, user_id, action, target_type, target_id, diff_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      makeId('audit'), access.tenantId, access.userId, 'axiom_analytics_token_rotated', 'page', access.pageId,
      JSON.stringify({ tokenPrefix: token.tokenPrefix, replacedExisting: Boolean(rotated) }), issuedAt,
    ),
  ]);

  return json({
    ok: true,
    token: token.token,
    tokenPrefix: token.tokenPrefix,
    createdAt: issuedAt,
    rotated: Boolean(rotated),
    scope: 'analytics:read',
  }, 201, { 'Cache-Control': 'no-store' });
};

export const onRequestDelete: PagesFunction<Env> = async (rawContext) => {
  const context = rawContext as Context;
  const access = await requirePageAdmin(context);
  if (access instanceof Response) return access;

  const revokedAt = new Date().toISOString();
  const token = await context.env.DB.prepare(`
    SELECT id, token_prefix FROM integration_api_tokens
    WHERE page_id = ? AND tenant_id = ? AND revoked_at IS NULL
    LIMIT 1
  `).bind(access.pageId, access.tenantId).first<{ id: string; token_prefix: string }>();
  if (!token) return errorJson('No active AXIOM analytics token exists for this page.', 404);

  await context.env.DB.batch([
    context.env.DB.prepare(`
      UPDATE integration_api_tokens SET revoked_at = ?
      WHERE id = ? AND page_id = ? AND tenant_id = ? AND revoked_at IS NULL
    `).bind(revokedAt, token.id, access.pageId, access.tenantId),
    context.env.DB.prepare(`
      INSERT INTO audit_log (id, tenant_id, user_id, action, target_type, target_id, diff_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      makeId('audit'), access.tenantId, access.userId, 'axiom_analytics_token_revoked', 'page', access.pageId,
      JSON.stringify({ tokenPrefix: token.token_prefix }), revokedAt,
    ),
  ]);

  return json({ ok: true, revoked: true, revokedAt }, 200, { 'Cache-Control': 'no-store' });
};
