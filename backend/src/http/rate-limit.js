// Request limits (README §11): a small fixed-window counter kept in memory, enough for the single API process
// this portal runs. Like Better Auth's sign-in limits, it is active in production only, so development and the
// end-to-end tests are not throttled; tests turn it on explicitly.

/**
 * Express middleware refusing a client's requests beyond `max` per `windowMs` (429, the usual JSON shape).
 * @param {object} options
 * @param {number} options.windowMs
 * @param {number} options.max
 * @param {(req: import("express").Request) => string | null} [options.key]  null = not limited (e.g. not a PDF)
 * @param {string} [options.message]
 * @param {boolean} [options.enabled]  default: NODE_ENV is production
 */
export function rateLimit({
  windowMs,
  max,
  key = (req) => req.ip,
  message = "Too many requests. Please wait a minute and try again.",
  enabled = process.env.NODE_ENV === "production",
}) {
  const hits = new Map(); // key → { count, resetAt }
  let nextSweep = Date.now() + windowMs;
  return function limit(req, res, next) {
    if (!enabled) return next();
    const k = key(req);
    if (k == null) return next();
    const now = Date.now();
    if (now > nextSweep) {
      for (const [entryKey, entry] of hits) if (entry.resetAt <= now) hits.delete(entryKey);
      nextSweep = now + windowMs;
    }
    let entry = hits.get(k);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(k, entry);
    }
    entry.count++;
    if (entry.count > max) {
      res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ ok: false, error: message, code: "RATE_LIMITED" });
    }
    next();
  };
}

/** The signed-in user's id, else the client address (for limits per person). */
export const userOrIp = (req) => req.user?.id ?? req.ip;
