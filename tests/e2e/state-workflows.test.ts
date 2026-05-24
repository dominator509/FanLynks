import { describe, expect, it } from 'vitest';
import { collectAndPersistEvent } from '../../src/server/analytics/collector';
import { createExperiment, startExperiment, updateExperiment } from '../../src/server/experiments/service';
import { getActiveAssignment, upsertExperimentAssignment } from '../../src/server/page/payload';
import { makeD1 } from '../helpers/mock-cloudflare';

describe('high-concurrency state workflows', () => {
  it('batches multi-row experiment mutations so lifecycle state cannot be partially applied', async () => {
    const batchSizes: number[] = [];
    const db = makeD1([
      {
        match: (sql, _params, kind) => kind === 'run' && sql.includes('INSERT INTO experiments'),
        handler: () => ({ success: true })
      },
      {
        match: (sql, _params, kind) => kind === 'run' && sql.includes('INSERT INTO experiment_variants'),
        handler: () => ({ success: true })
      },
      {
        match: (sql, _params, kind) => kind === 'run' && sql.includes('UPDATE experiments'),
        handler: () => ({ success: true })
      },
      {
        match: (sql, _params, kind) => kind === 'run' && sql.includes('UPDATE experiment_variants'),
        handler: () => ({ success: true })
      },
      {
        match: (sql, _params, kind) => kind === 'first' && sql.includes('FROM experiments') && sql.includes('WHERE id = ?'),
        first: {
          id: 'exp_1',
          page_id: 'page_demo',
          name: 'CTA order',
          status: 'draft',
          assignment_ttl_days: 30,
          started_at: null,
          ended_at: null,
          winner_variant_id: null,
          created_at: '2026-05-24T00:00:00.000Z',
          updated_at: '2026-05-24T00:00:00.000Z'
        }
      },
      {
        match: (sql, _params, kind) => kind === 'all' && sql.includes('FROM experiment_variants'),
        all: [
          {
            id: 'variant_a',
            experiment_id: 'exp_1',
            name: 'A',
            weight: 50,
            tokens_json: '{}',
            content_overrides_json: null,
            is_enabled: 1,
            created_at: '2026-05-24T00:00:00.000Z',
            updated_at: '2026-05-24T00:00:00.000Z'
          },
          {
            id: 'variant_b',
            experiment_id: 'exp_1',
            name: 'B',
            weight: 50,
            tokens_json: '{}',
            content_overrides_json: null,
            is_enabled: 1,
            created_at: '2026-05-24T00:00:00.000Z',
            updated_at: '2026-05-24T00:00:00.000Z'
          }
        ]
      }
    ]);
    const originalBatch = db.batch.bind(db);
    db.batch = async (statements) => {
      batchSizes.push(statements.length);
      return originalBatch(statements);
    };

    await createExperiment(db, {
      pageId: 'page_demo',
      name: 'CTA order',
      variants: [
        { name: 'A', weight: 50 },
        { name: 'B', weight: 50 }
      ]
    });
    await updateExperiment(db, 'exp_1', {
      variants: [
        { id: 'variant_a', name: 'A', weight: 60 },
        { id: 'variant_b', name: 'B', weight: 40 }
      ]
    });
    await startExperiment(db, 'exp_1');

    expect(batchSizes).toEqual([3, 3, 2]);
  });

  it('keeps one active variant assignment stable across concurrent visitor traffic', async () => {
    const assignments = new Map<string, { variant_id: string; assigned_at: string; expires_at: string }>();
    const db = makeD1([
      {
        match: 'INSERT INTO variant_assignments',
        handler: ({ params }) => {
          const [id, , , , variantId, assignedAt, expiresAt, cutoff] = params as string[];
          const existing = assignments.get(id);
          if (!existing || existing.expires_at <= cutoff) {
            assignments.set(id, { variant_id: variantId, assigned_at: assignedAt, expires_at: expiresAt });
          }
          return { success: true };
        }
      },
      {
        match: 'SELECT variant_id FROM variant_assignments WHERE id = ?',
        handler: ({ params }) => {
          const [id, nowIso] = params as string[];
          const row = assignments.get(id);
          return row && row.expires_at > nowIso ? { variant_id: row.variant_id } : null;
        }
      },
      {
        match: 'SELECT variant_id FROM variant_assignments WHERE page_id = ?',
        handler: ({ params }) => {
          const nowIso = params[3] as string;
          const row = Array.from(assignments.values()).find((candidate) => candidate.expires_at > nowIso);
          return row ? { variant_id: row.variant_id } : null;
        }
      }
    ]);

    const writes = Array.from({ length: 25 }, (_, index) => upsertExperimentAssignment({
      db,
      pageId: 'page_demo',
      experimentId: 'exp_live',
      visitorKey: 'visitor_repeat',
      variantId: index % 2 === 0 ? 'variant_a' : 'variant_b',
      ttlDays: 30
    }));

    const results = await Promise.all(writes);
    const persistedVariant = assignments.values().next().value?.variant_id;
    expect(assignments.size).toBe(1);
    expect(['variant_a', 'variant_b']).toContain(persistedVariant);
    expect(new Set(results.map((result) => result.variantId))).toEqual(new Set([persistedVariant]));
    await expect(getActiveAssignment({
      db,
      pageId: 'page_demo',
      experimentId: 'exp_live',
      visitorKey: 'visitor_repeat',
      nowIso: new Date().toISOString()
    })).resolves.toEqual({ variantId: persistedVariant });
  });

  it('replaces an expired assignment deterministically on the next write', async () => {
    const assignments = new Map<string, { variant_id: string; assigned_at: string; expires_at: string }>();
    const db = makeD1([
      {
        match: 'INSERT INTO variant_assignments',
        handler: ({ params }) => {
          const [id, , , , variantId, assignedAt, expiresAt, cutoff] = params as string[];
          const existing = assignments.get(id);
          if (!existing || existing.expires_at <= cutoff) {
            assignments.set(id, { variant_id: variantId, assigned_at: assignedAt, expires_at: expiresAt });
          }
          return { success: true };
        }
      },
      {
        match: 'SELECT variant_id FROM variant_assignments WHERE id = ?',
        handler: ({ params }) => {
          const [id, nowIso] = params as string[];
          const row = assignments.get(id);
          return row && row.expires_at > nowIso ? { variant_id: row.variant_id } : null;
        }
      }
    ]);

    const first = await upsertExperimentAssignment({
      db,
      pageId: 'page_demo',
      experimentId: 'exp_live',
      visitorKey: 'visitor_expired',
      variantId: 'variant_old',
      ttlDays: -1
    });
    expect(first).toEqual({ variantId: 'variant_old' });

    const second = await upsertExperimentAssignment({
      db,
      pageId: 'page_demo',
      experimentId: 'exp_live',
      visitorKey: 'visitor_expired',
      variantId: 'variant_new',
      ttlDays: 30
    });
    expect(second).toEqual({ variantId: 'variant_new' });
  });

  it('persists a burst of public analytics events without mutating admin event state', async () => {
    const storedEvents: unknown[] = [];
    const db = makeD1([
      { match: 'FROM pages WHERE id = ? AND is_active = 1', first: { id: 'page_demo', tenant_id: 'tenant_1', slug: 'home' } },
      { match: 'FROM page_links', first: { id: 'link_join', section_id: 'section_main', row_order: 1, url: 'https://fanlynks.com/join' } },
      {
        match: 'INSERT INTO events',
        handler: ({ params }) => {
          storedEvents.push(JSON.parse(params[6] as string));
          return { success: true };
        }
      }
    ]);
    const request = new Request('https://fanlynks.test/api/events', {
      headers: {
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        referer: 'https://fanlynks.com/home'
      }
    });

    await expect(Promise.all(Array.from({ length: 40 }, (_, index) => collectAndPersistEvent({
      db,
      body: {
        event_name: 'link_click',
        page_id: 'page_demo',
        link_id: 'link_join',
        destination_url: index % 2 === 0 ? 'javascript:alert(1)' : undefined,
        destination_domain: 'FanLynks.COM',
        row_index: index + 0.9,
        occurred_at: '2026-05-17T00:00:00.000Z'
      },
      countryCode: 'US',
      regionPolicy: 'default_standard',
      analyticsConsent: 'granted',
      adsConsent: 'denied',
      gpcDetected: false,
      sessionId: `session_${index}`,
      request
    })))).resolves.toHaveLength(40);

    expect(storedEvents).toHaveLength(40);
    expect(storedEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event_name: 'link_click',
        page_slug: 'home',
        destination_url: 'https://fanlynks.com/join',
        destination_domain: 'fanlynks.com',
        row_index: 1,
        device_type: 'mobile',
        consent_ads: 'denied'
      })
    ]));

    await expect(collectAndPersistEvent({
      db,
      body: { event_name: 'admin_publish', page_id: 'page_demo' },
      countryCode: null,
      regionPolicy: 'default_standard',
      analyticsConsent: 'unknown',
      adsConsent: 'unknown',
      gpcDetected: false,
      sessionId: 'blocked_admin_event',
      request
    })).rejects.toThrow('Invalid event_name.');
    expect(storedEvents).toHaveLength(40);
  });
});
