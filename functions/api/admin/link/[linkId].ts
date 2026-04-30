import { errorJson, json, readJson } from '../../_utils';
import { parseSessionCookie } from '../../../../src/server/auth/session';

async function requireLinkAccess(context: EventContext<Env, string, unknown>): Promise<
  | { ok: true; linkId: string; pageId: string }
  | { ok: false; response: Response }
> {
  const session = await parseSessionCookie(context.request, context.env.SESSION_SECRET);
  if (!session) return { ok: false, response: errorJson('Unauthorized.', 401) };
  const linkId = context.params.linkId as string;
  const row = await context.env.DB.prepare(`
    SELECT l.id, l.page_id, p.tenant_id
    FROM page_links l
    JOIN pages p ON p.id = l.page_id
    WHERE l.id = ?
    LIMIT 1
  `).bind(linkId).first<{ id: string; page_id: string; tenant_id: string }>();
  if (!row) return { ok: false, response: errorJson('Link not found.', 404) };
  if (row.tenant_id !== session.tenantId) return { ok: false, response: errorJson('Forbidden.', 403) };
  return { ok: true, linkId: row.id, pageId: row.page_id };
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const access = await requireLinkAccess(context as EventContext<Env, string, unknown>);
  if (!access.ok) return access.response;

  const body = await readJson(context.request);
  if (!body || typeof body !== 'object') return errorJson('Invalid request body.', 400);

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!title || !url) return errorJson('Title and URL are required.', 400);

  await context.env.DB.prepare(`
    UPDATE page_links
    SET section_id = ?,
        title = ?,
        subtitle = ?,
        url = ?,
        icon_type = ?,
        icon_value = ?,
        badge_text = ?,
        style_role = ?,
        row_order = ?,
        is_enabled = ?,
        start_at = ?,
        end_at = ?,
        updated_at = ?
    WHERE id = ?
  `).bind(
    typeof body.sectionId === 'string' ? body.sectionId : null,
    title,
    typeof body.subtitle === 'string' ? body.subtitle : null,
    url,
    body.iconType === 'emoji' || body.iconType === 'image' ? body.iconType : 'none',
    typeof body.iconValue === 'string' ? body.iconValue : null,
    typeof body.badgeText === 'string' ? body.badgeText : null,
    body.styleRole === 'primary' || body.styleRole === 'secondary' ? body.styleRole : 'neutral',
    Number.isFinite(Number(body.rowOrder)) ? Math.max(1, Math.floor(Number(body.rowOrder))) : 1,
    body.isEnabled === false ? 0 : 1,
    typeof body.startAt === 'string' ? body.startAt : null,
    typeof body.endAt === 'string' ? body.endAt : null,
    new Date().toISOString(),
    access.linkId
  ).run();

  return json({ ok: true, saved: true });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const access = await requireLinkAccess(context as EventContext<Env, string, unknown>);
  if (!access.ok) return access.response;

  await context.env.DB.prepare('DELETE FROM page_links WHERE id = ?').bind(access.linkId).run();
  return json({ ok: true, deleted: true });
};
