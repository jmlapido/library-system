import { Registry, collectDefaultMetrics, Counter, Histogram } from 'prom-client';

export const registry = new Registry();

// Collect default Node.js metrics (heap, event loop, GC, etc.)
collectDefaultMetrics({ register: registry });

/** Total HTTP requests counter, labeled by method, route, and status code. */
export const httpRequestsTotal = new Counter({
  name: 'librams_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [registry],
});

/** HTTP request duration histogram in seconds. */
export const httpRequestDurationSeconds = new Histogram({
  name: 'librams_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registry],
});

/** Checkout events counter, labeled by action (checkout, return, renew). */
export const checkoutEventsTotal = new Counter({
  name: 'librams_checkout_events_total',
  help: 'Library checkout lifecycle events',
  labelNames: ['action'],
  registers: [registry],
});

/** Import jobs counter, labeled by type (csv_students, csv_books, marc) and result. */
export const importJobsTotal = new Counter({
  name: 'librams_import_jobs_total',
  help: 'Bulk import jobs',
  labelNames: ['type', 'result'],
  registers: [registry],
});
