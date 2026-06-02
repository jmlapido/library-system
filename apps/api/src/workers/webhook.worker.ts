import { Worker, Queue } from 'bullmq';
import { redis } from '../lib/redis.js';
import { signPayload } from '../services/webhooks.service.js';
import type { WebhookJob } from '../lib/queue.js';

const RETRY_DELAYS_MS = [60_000, 300_000, 900_000];

/**
 * Starts the BullMQ worker that delivers webhook payloads with HMAC signatures.
 * Retries up to 3 times with exponential back-off on non-2xx responses.
 */
export function startWebhookWorker(): Worker<WebhookJob> {
  const retryQueue = new Queue<WebhookJob>('webhooks', { connection: redis });

  return new Worker<WebhookJob>(
    'webhooks',
    async (job) => {
      const { url, secret, event, payload, attempt } = job.data;
      const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
      const signature = signPayload(secret, body);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-LibraMS-Signature': signature,
          'X-LibraMS-Event': event,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok && attempt < 3) {
        await retryQueue.add(
          'deliver',
          { ...job.data, attempt: attempt + 1 },
          { delay: RETRY_DELAYS_MS[attempt - 1] },
        );
      }
    },
    { connection: redis },
  );
}
