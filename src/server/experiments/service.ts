import { makeId } from '../db/ids';
import {
  normalizeOptionalPublicUrl,
  normalizeOptionalText,
  sanitizeThemeTokens
} from '../security/validation';

export type ExperimentStatus = 'draft' | 'live' | 'paused' | 'winner' | 'archived';

export interface VariantInput {
  id?: string;
  name: string;
  weight: number;
  tokens?: Record<string, unknown>;
  contentOverrides?: Record<string, unknown> | null;
  isEnabled?: boolean;
}

export interface CreateExperimentInput {
  pageId: string;
  name: string;
  assignmentTtlDays?: number;
  variants: VariantInput[];
}

export interface UpdateExperimentInput {
  name?: string;
  assignmentTtlDays?: number;
  status?: ExperimentStatus;
  variants?: VariantInput[];
}

export interface ExperimentWithVariants {
  id: string;
  pageId: string;
  name: string;
  status: ExperimentStatus;
  assignmentTtlDays: number;
  startedAt: string | null;
  endedAt: string | null;
  winnerVariantId: string | null;
  createdAt: string;
  updatedAt: string;
  variants: Array<{
    id: string;
    experimentId: string;
    name: string;
    weight: number;
    tokens: Record<string, unknown>;
    contentOverrides: Record<string, unknown> | null;
    isEnabled: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
}

interface ExperimentRow {
  id: string;
  page_id: string;
  name: string;
  status: ExperimentStatus;
  assignment_ttl_days: number;
  started_at: string | null;
  ended_at: string | null;
  winner_variant_id: string | null;
  created_at: string;
  updated_at: string;
}

interface VariantRow {
  id: string;
  experiment_id: string;
  name: string;
  weight: number;
  tokens_json: string;
  content_overrides_json: string | null;
  is_enabled: number;
  created_at: string;
  updated_at: string;
}

function safeParseObject(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function normalizeWeight(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value as number));
}

function defaultTokens(index: number): Record<string, unknown> {
  const presets = [
    { name: 'midnight_luxe', bg: '#09090b', surface: '#18181b', text: '#fafafa', accent: '#d4af37' },
    { name: 'pink_neon', bg: '#140917', surface: '#2c1233', text: '#fff7fb', accent: '#ff4fd8' },
    { name: 'clean_ice', bg: '#f8fafc', surface: '#ffffff', text: '#0f172a', accent: '#2563eb' },
    { name: 'forest_gold', bg: '#0b1913', surface: '#12241c', text: '#f4f1e8', accent: '#d6b25e' }
  ];
  return presets[index % presets.length];
}

function validateVariants(variants: VariantInput[] | undefined): VariantInput[] {
  if (!Array.isArray(variants) || variants.length === 0) {
    throw new Error('At least one variant is required.');
  }
  if (variants.length > 6) {
    throw new Error('MVP hard cap is 6 active variants per page.');
  }
  const normalized = variants.map((variant, index) => {
    const name = typeof variant.name === 'string' ? variant.name.trim() : '';
    if (!name) throw new Error(`Variant ${index + 1} is missing a name.`);
    return {
      id: variant.id,
      name,
      weight: normalizeWeight(variant.weight, Math.max(1, Math.floor(100 / variants.length))),
      tokens: sanitizeThemeTokens(variant.tokens && typeof variant.tokens === 'object' ? variant.tokens : defaultTokens(index)),
      contentOverrides:
        sanitizeContentOverrides(variant.contentOverrides),
      isEnabled: variant.isEnabled ?? true
    };
  });

  const enabledCount = normalized.filter((variant) => variant.isEnabled).length;
  if (enabledCount === 0) throw new Error('At least one enabled variant is required.');

  return normalized;
}

function sanitizeContentOverrides(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const source = input as Record<string, unknown>;
  const output: Record<string, unknown> = {};

  if (source.page && typeof source.page === 'object' && !Array.isArray(source.page)) {
    const page = source.page as Record<string, unknown>;
    const sanitizedPage: Record<string, unknown> = {};
    const title = normalizeOptionalText(page.title, 120);
    const subtitle = normalizeOptionalText(page.subtitle, 240);
    const announcementText = normalizeOptionalText(page.announcementText, 120);
    const heroCtaLabel = normalizeOptionalText(page.heroCtaLabel, 60);
    const avatarUrl = normalizeOptionalPublicUrl(page.avatarUrl);
    const announcementUrl = normalizeOptionalPublicUrl(page.announcementUrl);
    const heroCtaUrl = normalizeOptionalPublicUrl(page.heroCtaUrl);

    if (title) sanitizedPage.title = title;
    if (subtitle) sanitizedPage.subtitle = subtitle;
    if (announcementText) sanitizedPage.announcementText = announcementText;
    if (heroCtaLabel) sanitizedPage.heroCtaLabel = heroCtaLabel;
    if (avatarUrl) sanitizedPage.avatarUrl = avatarUrl;
    if (announcementUrl) sanitizedPage.announcementUrl = announcementUrl;
    if (heroCtaUrl) sanitizedPage.heroCtaUrl = heroCtaUrl;
    if (Object.keys(sanitizedPage).length) output.page = sanitizedPage;
  }

  if (source.links && typeof source.links === 'object' && !Array.isArray(source.links)) {
    const links: Record<string, unknown> = {};
    for (const [linkId, rawLink] of Object.entries(source.links as Record<string, unknown>)) {
      if (!/^[a-zA-Z0-9_-]{1,120}$/.test(linkId) || !rawLink || typeof rawLink !== 'object' || Array.isArray(rawLink)) continue;
      const link = rawLink as Record<string, unknown>;
      const sanitizedLink: Record<string, unknown> = {};
      const title = normalizeOptionalText(link.title, 120);
      const subtitle = normalizeOptionalText(link.subtitle, 180);
      const badgeText = normalizeOptionalText(link.badgeText, 48);
      const url = normalizeOptionalPublicUrl(link.url);
      if (title) sanitizedLink.title = title;
      if (subtitle) sanitizedLink.subtitle = subtitle;
      if (badgeText) sanitizedLink.badgeText = badgeText;
      if (url) sanitizedLink.url = url;
      if (Object.keys(sanitizedLink).length) links[linkId] = sanitizedLink;
    }
    if (Object.keys(links).length) output.links = links;
  }

  if (Array.isArray(source.linkOrder)) {
    const linkOrder = source.linkOrder
      .filter((value): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value))
      .slice(0, 100);
    if (linkOrder.length) output.linkOrder = linkOrder;
  }

  return Object.keys(output).length ? output : null;
}

export async function listExperiments(db: D1Database, pageId: string): Promise<ExperimentWithVariants[]> {
  const experiments = await db.prepare(`
    SELECT id, page_id, name, status, assignment_ttl_days, started_at, ended_at, winner_variant_id, created_at, updated_at
    FROM experiments
    WHERE page_id = ?
    ORDER BY created_at DESC
  `).bind(pageId).all<ExperimentRow>();

  const rows = experiments.results ?? [];
  if (rows.length === 0) return [];

  const variants = await db.prepare(`
    SELECT id, experiment_id, name, weight, tokens_json, content_overrides_json, is_enabled, created_at, updated_at
    FROM experiment_variants
    WHERE experiment_id IN (${rows.map(() => '?').join(',')})
    ORDER BY created_at ASC
  `).bind(...rows.map((row) => row.id)).all<VariantRow>();

  const byExperiment = new Map<string, VariantRow[]>();
  for (const variant of variants.results ?? []) {
    const arr = byExperiment.get(variant.experiment_id) ?? [];
    arr.push(variant);
    byExperiment.set(variant.experiment_id, arr);
  }

  return rows.map((row) => ({
    id: row.id,
    pageId: row.page_id,
    name: row.name,
    status: row.status,
    assignmentTtlDays: row.assignment_ttl_days,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    winnerVariantId: row.winner_variant_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    variants: (byExperiment.get(row.id) ?? []).map((variant) => ({
      id: variant.id,
      experimentId: variant.experiment_id,
      name: variant.name,
      weight: variant.weight,
      tokens: safeParseObject(variant.tokens_json) ?? {},
      contentOverrides: safeParseObject(variant.content_overrides_json),
      isEnabled: Boolean(variant.is_enabled),
      createdAt: variant.created_at,
      updatedAt: variant.updated_at
    }))
  }));
}

export async function getExperimentById(db: D1Database, experimentId: string): Promise<ExperimentWithVariants | null> {
  const row = await db.prepare(`
    SELECT id, page_id, name, status, assignment_ttl_days, started_at, ended_at, winner_variant_id, created_at, updated_at
    FROM experiments
    WHERE id = ?
    LIMIT 1
  `).bind(experimentId).first<ExperimentRow>();
  if (!row) return null;
  const variants = await db.prepare(`
    SELECT id, experiment_id, name, weight, tokens_json, content_overrides_json, is_enabled, created_at, updated_at
    FROM experiment_variants
    WHERE experiment_id = ?
    ORDER BY created_at ASC
  `).bind(experimentId).all<VariantRow>();

  return {
    id: row.id,
    pageId: row.page_id,
    name: row.name,
    status: row.status,
    assignmentTtlDays: row.assignment_ttl_days,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    winnerVariantId: row.winner_variant_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    variants: (variants.results ?? []).map((variant) => ({
      id: variant.id,
      experimentId: variant.experiment_id,
      name: variant.name,
      weight: variant.weight,
      tokens: safeParseObject(variant.tokens_json) ?? {},
      contentOverrides: safeParseObject(variant.content_overrides_json),
      isEnabled: Boolean(variant.is_enabled),
      createdAt: variant.created_at,
      updatedAt: variant.updated_at
    }))
  };
}

export async function createExperiment(db: D1Database, input: CreateExperimentInput): Promise<ExperimentWithVariants> {
  const now = new Date().toISOString();
  const variants = validateVariants(input.variants);
  const experimentId = makeId('exp');

  await db.prepare(`
    INSERT INTO experiments (
      id, page_id, name, status, assignment_ttl_days, started_at, ended_at, winner_variant_id, created_at, updated_at
    ) VALUES (?, ?, ?, 'draft', ?, NULL, NULL, NULL, ?, ?)
  `).bind(
    experimentId,
    input.pageId,
    input.name.trim(),
    Math.max(1, Math.floor(input.assignmentTtlDays ?? 30)),
    now,
    now
  ).run();

  for (const variant of variants) {
    await db.prepare(`
      INSERT INTO experiment_variants (
        id, experiment_id, name, weight, tokens_json, content_overrides_json, is_enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      variant.id ?? makeId('var'),
      experimentId,
      variant.name,
      variant.weight,
      JSON.stringify(variant.tokens ?? {}),
      variant.contentOverrides ? JSON.stringify(variant.contentOverrides) : null,
      variant.isEnabled ? 1 : 0,
      now,
      now
    ).run();
  }

  const created = await getExperimentById(db, experimentId);
  if (!created) throw new Error('Failed to load created experiment.');
  return created;
}

export async function updateExperiment(db: D1Database, experimentId: string, input: UpdateExperimentInput): Promise<ExperimentWithVariants> {
  const existing = await getExperimentById(db, experimentId);
  if (!existing) throw new Error('Experiment not found.');
  const now = new Date().toISOString();

  await db.prepare(`
    UPDATE experiments
    SET name = ?, assignment_ttl_days = ?, status = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    typeof input.name === 'string' && input.name.trim() ? input.name.trim() : existing.name,
    Math.max(1, Math.floor(input.assignmentTtlDays ?? existing.assignmentTtlDays)),
    input.status ?? existing.status,
    now,
    experimentId
  ).run();

  if (input.variants) {
    const variants = validateVariants(input.variants);
    const existingIds = new Set(existing.variants.map((variant) => variant.id));
    const incomingIds = new Set(variants.map((variant) => variant.id).filter(Boolean) as string[]);

    for (const existingVariantId of existingIds) {
      if (!incomingIds.has(existingVariantId)) {
        await db.prepare(`DELETE FROM experiment_variants WHERE id = ? AND experiment_id = ?`).bind(existingVariantId, experimentId).run();
      }
    }

    for (const variant of variants) {
      const id = variant.id ?? makeId('var');
      if (variant.id && existingIds.has(variant.id)) {
        await db.prepare(`
          UPDATE experiment_variants
          SET name = ?, weight = ?, tokens_json = ?, content_overrides_json = ?, is_enabled = ?, updated_at = ?
          WHERE id = ? AND experiment_id = ?
        `).bind(
          variant.name,
          variant.weight,
          JSON.stringify(variant.tokens ?? {}),
          variant.contentOverrides ? JSON.stringify(variant.contentOverrides) : null,
          variant.isEnabled ? 1 : 0,
          now,
          variant.id,
          experimentId
        ).run();
      } else {
        await db.prepare(`
          INSERT INTO experiment_variants (
            id, experiment_id, name, weight, tokens_json, content_overrides_json, is_enabled, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          id,
          experimentId,
          variant.name,
          variant.weight,
          JSON.stringify(variant.tokens ?? {}),
          variant.contentOverrides ? JSON.stringify(variant.contentOverrides) : null,
          variant.isEnabled ? 1 : 0,
          now,
          now
        ).run();
      }
    }
  }

  const updated = await getExperimentById(db, experimentId);
  if (!updated) throw new Error('Failed to load updated experiment.');
  return updated;
}

export async function startExperiment(db: D1Database, experimentId: string): Promise<ExperimentWithVariants> {
  const experiment = await getExperimentById(db, experimentId);
  if (!experiment) throw new Error('Experiment not found.');
  const now = new Date().toISOString();

  await db.prepare(`
    UPDATE experiments
    SET status = 'paused', updated_at = ?
    WHERE page_id = ? AND status = 'live' AND id <> ?
  `).bind(now, experiment.pageId, experimentId).run();

  await db.prepare(`
    UPDATE experiments
    SET status = 'live', started_at = COALESCE(started_at, ?), ended_at = NULL, winner_variant_id = NULL, updated_at = ?
    WHERE id = ?
  `).bind(now, now, experimentId).run();

  const started = await getExperimentById(db, experimentId);
  if (!started) throw new Error('Failed to load started experiment.');
  return started;
}

export async function pauseExperiment(db: D1Database, experimentId: string): Promise<ExperimentWithVariants> {
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE experiments
    SET status = 'paused', updated_at = ?
    WHERE id = ?
  `).bind(now, experimentId).run();
  const paused = await getExperimentById(db, experimentId);
  if (!paused) throw new Error('Experiment not found.');
  return paused;
}

export async function chooseWinner(db: D1Database, experimentId: string, winnerVariantId: string): Promise<ExperimentWithVariants> {
  const experiment = await getExperimentById(db, experimentId);
  if (!experiment) throw new Error('Experiment not found.');
  const winner = experiment.variants.find((variant) => variant.id === winnerVariantId);
  if (!winner) throw new Error('Winner variant not found in experiment.');
  const now = new Date().toISOString();

  await db.prepare(`
    UPDATE experiments
    SET status = 'winner', winner_variant_id = ?, ended_at = ?, updated_at = ?
    WHERE id = ?
  `).bind(winnerVariantId, now, now, experimentId).run();

  const finished = await getExperimentById(db, experimentId);
  if (!finished) throw new Error('Failed to load winner experiment.');
  return finished;
}

export async function writeAuditLog(args: {
  db: D1Database;
  tenantId: string;
  userId: string;
  action: string;
  targetType: string;
  targetId: string;
  diff?: Record<string, unknown> | null;
}): Promise<void> {
  await args.db.prepare(`
    INSERT INTO audit_log (id, tenant_id, user_id, action, target_type, target_id, diff_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    makeId('audit'),
    args.tenantId,
    args.userId,
    args.action,
    args.targetType,
    args.targetId,
    args.diff ? JSON.stringify(args.diff) : null,
    new Date().toISOString()
  ).run();
}
