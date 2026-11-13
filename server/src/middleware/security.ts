import { Request, Response, NextFunction } from 'express';

/** Conservative security headers (a dependency-free subset of what helmet sets). */
export const securityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.removeHeader('X-Powered-By');
  next();
};

/**
 * Fixed-window, in-memory rate limiter. Adequate for a single server instance;
 * a multi-instance deployment would move the counters to Redis.
 */
export const rateLimit = (options: { windowMs: number; max: number; keyFn?: (req: Request) => string }) => {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = options.keyFn ? options.keyFn(req) : req.ip || 'unknown';
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > options.max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        message: `Too many attempts. Please try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
      });
      return;
    }
    next();
  };
};
