declare interface KVNamespace {
  get<T = unknown>(key: string, type?: 'text' | 'json' | 'arrayBuffer' | 'stream'): Promise<T | null>;
  put(key: string, value: string, options?: { expiration?: number; expirationTtl?: number; metadata?: unknown }): Promise<void>;
  delete(key: string): Promise<void>;
}

declare interface D1Result<T = unknown> {
  results?: T[];
  success?: boolean;
  meta?: Record<string, unknown>;
}

declare interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
  raw<T = unknown[]>(): Promise<T[]>;
}

declare interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = D1Result>(statements: D1PreparedStatement[]): Promise<T[]>;
  exec(query: string): Promise<D1Result>;
}

declare type PagesFunction<Env = unknown, Params extends string = string, Data = Record<string, unknown>> = (context: {
  request: Request;
  env: Env;
  params: Record<Params, string> & Record<string, string>;
  data: Data;
  next(input?: Request | string): Promise<Response>;
  waitUntil(promise: Promise<unknown>): void;
}) => Response | Promise<Response>;

declare type EventContext<Env = unknown, Params extends string = string, Data = Record<string, unknown>> = Parameters<PagesFunction<Env, Params, Data>>[0];
