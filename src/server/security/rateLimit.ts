interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
}

export async function checkRateLimit(args: {
  kv: KVNamespace;
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const now = Date.now();
  const raw = await args.kv.get<string>(args.key);
  let record: RateLimitRecord | null = null;

  if (raw) {
    try {
      record = JSON.parse(raw) as RateLimitRecord;
    } catch {
      record = null;
    }
  }

  if (!record || !Number.isFinite(record.resetAt) || record.resetAt <= now) {
    record = {
      count: 0,
      resetAt: now + args.windowSeconds * 1000
    };
  }

  record.count += 1;
  const ttl = Math.max(1, Math.ceil((record.resetAt - now) / 1000));

  await args.kv.put(args.key, JSON.stringify(record), {
    expirationTtl: ttl + 30
  });

  const remaining = Math.max(0, args.limit - record.count);
  const retryAfterSeconds = record.count > args.limit ? ttl : 0;

  return {
    allowed: record.count <= args.limit,
    remaining,
    retryAfterSeconds,
    resetAt: record.resetAt
  };
}
