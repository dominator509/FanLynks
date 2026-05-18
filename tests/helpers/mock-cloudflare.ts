type QueryKind = 'first' | 'all' | 'run';

type QueryRoute = {
  match: RegExp | string | ((sql: string, params: unknown[], kind: QueryKind) => boolean);
  first?: unknown;
  all?: unknown[];
  run?: unknown;
  handler?: (args: { sql: string; params: unknown[]; kind: QueryKind }) => unknown;
};

export function makeD1(routes: QueryRoute[]): D1Database {
  return {
    prepare(sql: string) {
      return makeStatement(sql, routes, []);
    },
    async batch(statements: D1PreparedStatement[]) {
      const results: D1Result[] = [];
      for (const statement of statements) {
        results.push(await statement.run());
      }
      return results;
    }
  } as D1Database;
}

export function makeKV(): KVNamespace & { values: Map<string, string>; deleted: string[] } {
  const values = new Map<string, string>();
  const deleted: string[] = [];

  return {
    values,
    deleted,
    async get(key: string, type?: string) {
      const raw = values.get(key) ?? null;
      if (raw && type === 'json') return JSON.parse(raw);
      return raw;
    },
    async put(key: string, value: string) {
      values.set(key, value);
    },
    async delete(key: string) {
      deleted.push(key);
      values.delete(key);
    }
  } as unknown as KVNamespace & { values: Map<string, string>; deleted: string[] };
}

function makeStatement(sql: string, routes: QueryRoute[], params: unknown[]): D1PreparedStatement {
  return {
    bind(...bound: unknown[]) {
      return makeStatement(sql, routes, bound);
    },
    async first<T>() {
      return resolveRoute(routes, sql, params, 'first') as T | null;
    },
    async all<T>() {
      return { results: (resolveRoute(routes, sql, params, 'all') ?? []) as T[] };
    },
    async run() {
      return (resolveRoute(routes, sql, params, 'run') ?? { success: true }) as D1Result;
    }
  } as unknown as D1PreparedStatement;
}

function resolveRoute(routes: QueryRoute[], sql: string, params: unknown[], kind: QueryKind): unknown {
  const route = routes.find((candidate) => matches(candidate.match, sql, params, kind));
  if (!route) throw new Error(`No mock D1 route for ${kind}: ${compactSql(sql)}`);
  if (route.handler) return route.handler({ sql, params, kind });
  if (kind === 'first') return route.first ?? null;
  if (kind === 'all') return route.all ?? [];
  return route.run ?? { success: true };
}

function matches(match: QueryRoute['match'], sql: string, params: unknown[], kind: QueryKind): boolean {
  const compacted = compactSql(sql);
  if (typeof match === 'string') return compacted.includes(match);
  if (match instanceof RegExp) return match.test(compacted);
  return match(sql, params, kind);
}

function compactSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}
