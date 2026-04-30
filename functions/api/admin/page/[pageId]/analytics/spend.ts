import { errorJson, json, readJson } from '../../../../_utils';
import { requirePageAccess } from './_shared';
import { makeId } from '../../../../../../src/server/db/ids';

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeAmount(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const access = await requirePageAccess(context as EventContext<Env, string, unknown>);
  if (access instanceof Response) return access;

  const since = new URL(context.request.url).searchParams.get('since') ?? new Date(Date.now() - 30 * 86400_000).toISOString();

  const [entriesRes, summary] = await Promise.all([
    context.env.DB.prepare(`
      SELECT
        s.id,
        s.spend_date,
        s.source,
        s.medium,
        s.variant_id,
        COALESCE(v.name, '') AS variant_name,
        s.amount,
        s.currency,
        s.note
      FROM ad_spend_entries s
      LEFT JOIN experiment_variants v ON v.id = s.variant_id
      WHERE s.page_id = ?
        AND date(s.spend_date) >= date(?)
      ORDER BY s.spend_date DESC, s.created_at DESC
    `).bind(access.pageId, since).all<{ id: string; spend_date: string; source: string | null; medium: string | null; variant_id: string | null; variant_name: string; amount: number; currency: string; note: string | null }>(),
    context.env.DB.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total_spend
      FROM ad_spend_entries
      WHERE page_id = ?
        AND date(spend_date) >= date(?)
    `).bind(access.pageId, since).first<{ total_spend: number }>()
  ]);

  return json({
    ok: true,
    since,
    summary: { totalSpend: Number(summary?.total_spend ?? 0) },
    entries: (entriesRes.results ?? []).map((row) => ({
      id: row.id,
      spendDate: row.spend_date,
      source: row.source,
      medium: row.medium,
      variantId: row.variant_id,
      variantName: row.variant_name || null,
      amount: Number(row.amount ?? 0),
      currency: row.currency,
      note: row.note
    }))
  });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const access = await requirePageAccess(context as EventContext<Env, string, unknown>);
  if (access instanceof Response) return access;

  const body = await readJson(context.request);
  if (!body || typeof body !== 'object') return errorJson('Invalid request body.', 400);

  const spendDate = normalizeText(body.spendDate);
  const amount = normalizeAmount(body.amount);
  if (!spendDate) return errorJson('spendDate is required.', 400);
  if (amount == null) return errorJson('amount must be a valid non-negative number.', 400);

  const id = normalizeText(body.id) || makeId('spend');
  const now = new Date().toISOString();
  const variantId = normalizeText(body.variantId);

  if (variantId) {
    const variant = await context.env.DB.prepare(`
      SELECT ev.id
      FROM experiment_variants ev
      JOIN experiments e ON e.id = ev.experiment_id
      WHERE ev.id = ? AND e.page_id = ?
      LIMIT 1
    `).bind(variantId, access.pageId).first<{ id: string }>();
    if (!variant) return errorJson('variantId does not belong to this page.', 400);
  }

  const existing = await context.env.DB.prepare(`SELECT id FROM ad_spend_entries WHERE id = ? AND page_id = ? LIMIT 1`).bind(id, access.pageId).first<{ id: string }>();

  if (existing) {
    await context.env.DB.prepare(`
      UPDATE ad_spend_entries
      SET source = ?, medium = ?, variant_id = ?, amount = ?, currency = ?, note = ?, spend_date = ?, updated_at = ?
      WHERE id = ? AND page_id = ?
    `).bind(
      normalizeText(body.source),
      normalizeText(body.medium),
      variantId,
      amount,
      normalizeText(body.currency) || 'USD',
      normalizeText(body.note),
      spendDate,
      now,
      id,
      access.pageId
    ).run();
  } else {
    await context.env.DB.prepare(`
      INSERT INTO ad_spend_entries (id, page_id, source, medium, variant_id, amount, currency, note, spend_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      access.pageId,
      normalizeText(body.source),
      normalizeText(body.medium),
      variantId,
      amount,
      normalizeText(body.currency) || 'USD',
      normalizeText(body.note),
      spendDate,
      now,
      now
    ).run();
  }

  return json({ ok: true, saved: true, id });
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const access = await requirePageAccess(context as EventContext<Env, string, unknown>);
  if (access instanceof Response) return access;

  const requestUrl = new URL(context.request.url);
  const body = await readJson(context.request).catch(() => null);
  const id = normalizeText(requestUrl.searchParams.get('id')) || normalizeText(body?.id);
  if (!id) return errorJson('id is required.', 400);

  await context.env.DB.prepare(`DELETE FROM ad_spend_entries WHERE id = ? AND page_id = ?`).bind(id, access.pageId).run();
  return json({ ok: true, deleted: true, id });
};
