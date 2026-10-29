const buckets = new Map();
// Periodically drop expired buckets so this map doesn't grow unbounded on a long-running process.
setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now)
            buckets.delete(key);
    }
}, 60_000).unref();
export function rateLimit({ windowMs, max, message }) {
    return (req, res, next) => {
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
