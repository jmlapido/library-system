import type { Context } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { pushSubscriptions } from '../db/schema/pushSubscriptions.js';
import { eq, and } from 'drizzle-orm';
import type { AccessTokenPayload } from '../lib/jwt.js';

type Variables = { user: AccessTokenPayload };

const RegisterDeviceSchema = z.object({
  fcmToken: z.string().min(1),
  deviceName: z.string().max(255).optional(),
});

const UnregisterDeviceSchema = z.object({
  fcmToken: z.string().min(1),
});

/** Parse body or return 422 error response. */
async function parseBody<T>(
  c: Context,
  schema: z.ZodType<T>
): Promise<T | null> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    c.res = c.json({ success: false, error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, 422);
    return null;
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    c.res = c.json({ success: false, error: parsed.error.message, code: 'VALIDATION_ERROR' }, 422);
    return null;
  }
  return parsed.data;
}

/**
 * POST /api/v1/push/subscribe
 * Register a FCM device token for the authenticated user.
 * Upserts to avoid duplicate tokens.
 */
export async function registerDevice(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const body = await parseBody(c, RegisterDeviceSchema);
  if (!body) return c.res;

  try {
    await db
      .insert(pushSubscriptions)
      .values({
        userId: user.sub,
        schoolId: user.schoolId,
        fcmToken: body.fcmToken,
        deviceName: body.deviceName ?? null,
      })
      .onConflictDoUpdate({
        target: [pushSubscriptions.userId, pushSubscriptions.fcmToken],
        set: { deviceName: body.deviceName ?? null },
      });

    return c.json({ success: true, message: 'Device registered for push notifications' }, 201);
  } catch (err) {
    console.error('[push] registerDevice error:', (err as Error).message);
    return c.json({ success: false, error: 'Failed to register device', code: 'INTERNAL_ERROR' }, 500);
  }
}

/**
 * DELETE /api/v1/push/subscribe
 * Unregister a FCM device token for the authenticated user.
 */
export async function unregisterDevice(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const body = await parseBody(c, UnregisterDeviceSchema);
  if (!body) return c.res;

  try {
    await db
      .delete(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.userId, user.sub),
        eq(pushSubscriptions.fcmToken, body.fcmToken)
      ));

    return c.json({ success: true, message: 'Device unregistered from push notifications' }, 200);
  } catch (err) {
    console.error('[push] unregisterDevice error:', (err as Error).message);
    return c.json({ success: false, error: 'Failed to unregister device', code: 'INTERNAL_ERROR' }, 500);
  }
}
