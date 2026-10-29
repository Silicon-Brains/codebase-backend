import type { Request, Response, NextFunction } from "express";

/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Deliberately not a dependency (`express-rate-limit`) — this app runs as a single Node process
 * with no horizontal scaling story yet (architecture.md), so an in-memory map is sufficient and
 * keeps the dependency surface small (rules.md is silent on this but the project has generally
 * favored fewer deps). If the server is ever scaled to multiple instances, swap the store for
 * Redis/Supabase-backed counters — the interface below (`hit(key)`) is the only thing that'd change.
 *
 * Keyed by IP. `req.ip` requires `app.set('trust proxy', ...)` to be configured correctly behind
 * a real proxy/load balancer in production — see apps/server/README or deploy notes.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Periodically drop expired buckets so this map doesn't grow unbounded on a long-running process.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 60_000).unref();

export function rateLimit({ windowMs, max, message }: { windowMs: number; max: number; message?: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= max) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({ error: message ?? "Too many requests — please try again shortly." });
    }

    bucket.count += 1;
    next();
  };
}
