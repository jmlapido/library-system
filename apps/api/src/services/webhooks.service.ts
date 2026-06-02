import crypto from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import type { Queue } from 'bullmq';
import { db } from '../db/index.js';
import { webhooks } from '../db/schema/webhooks.js';
import { AppError } from '../utils/errors.js';
import type { WebhookJob } from '../lib/queue.js';
import type { Webhook } from '../db/schema/webhooks.js';

/** Generate a cryptographically random HMAC secret for a new webhook. */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** HMAC-SHA256 sign a payload string with the webhook secret. */
export function signPayload(secret: string, body: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

/** List webhooks for a school. */
export async function listWebhooks(schoolId: string): Promise<Webhook[]> {
  return db.select().from(webhooks).where(eq(webhooks.schoolId, schoolId));
}

/** Create a new webhook subscription. */
export async function createWebhook(
  schoolId: string,
  input: { url: string; events: string[]; description?: string },
): Promise<Webhook> {
  if (input.events.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'At least one event is required');
  }
  const secret = generateWebhookSecret();
  const [webhook] = await db.insert(webhooks).values({
    schoolId,
    url: input.url,
    secret,
    events: input.events as Webhook['events'],
    description: input.description,
  }).returning();
  return webhook!;
}

/** Delete a webhook subscription. */
export async function deleteWebhook(id: string, schoolId: string): Promise<void> {
  const [existing] = await db
    .select({ id: webhooks.id })
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.schoolId, schoolId)));
  if (!existing) throw new AppError('WEBHOOK_NOT_FOUND', 'Webhook not found');
  await db.delete(webhooks).where(eq(webhooks.id, id));
}

/** Toggle a webhook's active status. */
export async function toggleWebhook(id: string, schoolId: string, isActive: boolean): Promise<Webhook> {
  const [existing] = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.schoolId, schoolId)));
  if (!existing) throw new AppError('WEBHOOK_NOT_FOUND', 'Webhook not found');
  const [updated] = await db
    .update(webhooks)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(webhooks.id, id))
    .returning();
  return updated!;
}

/**
 * Dispatch an event to all active webhooks subscribed to it.
 * Fire-and-forget — never throws, never blocks the caller.
 */
export async function dispatchWebhookEvent(
  schoolId: string,
  event: string,
  payload: Record<string, unknown>,
  queue: Queue<WebhookJob>,
): Promise<void> {
  try {
    const subs = await db
      .select()
      .from(webhooks)
      .where(and(eq(webhooks.schoolId, schoolId), eq(webhooks.isActive, true)));
    const matching = subs.filter((w) => (w.events as string[]).includes(event));
    for (const w of matching) {
      await queue.add('deliver', {
        webhookId: w.id,
        url: w.url,
        secret: w.secret,
        event,
        payload,
        attempt: 1,
      });
    }
  } catch {
    // Never propagate — webhook dispatch is best-effort
  }
}
