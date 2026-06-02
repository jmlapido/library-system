import type { MiddlewareHandler } from 'hono';
import { httpRequestsTotal, httpRequestDurationSeconds } from '../lib/metrics.js';

/**
 * Hono middleware that records HTTP request count and duration for Prometheus.
 * Route is normalized (UUIDs replaced with :id) to avoid high cardinality.
 */
export const metricsMiddleware: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  await next();
  const durationSec = (Date.now() - start) / 1000;

  const method = c.req.method;
  const status = String(c.res.status);
  // Normalize dynamic segments to reduce cardinality
  const route = c.req.path.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':id',
  );

  httpRequestsTotal.inc({ method, route, status });
  httpRequestDurationSeconds.observe({ method, route, status }, durationSec);
};
