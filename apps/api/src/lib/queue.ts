import { Queue } from 'bullmq';
import { redis } from './redis.js';

export type WebhookJob = {
  webhookId: string;
  url: string;
  secret: string;
  event: string;
  payload: Record<string, unknown>;
  attempt: number;
};

/** BullMQ queue for async webhook delivery with retry support. */
export const webhookQueue = new Queue<WebhookJob>('webhooks', { connection: redis });
