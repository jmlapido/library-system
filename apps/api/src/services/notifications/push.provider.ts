import { db } from '../../db/index.js';
import { pushSubscriptions } from '../../db/schema/pushSubscriptions.js';
import { eq, and, inArray } from 'drizzle-orm';

let initialized = false;

/** Lazily initialise Firebase Admin SDK. Returns false if env vars are absent. */
async function ensureFirebaseInit(): Promise<boolean> {
  if (initialized) return true;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) return false;

  try {
    const admin = (await import('firebase-admin')).default;
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
    }
    initialized = true;
    return true;
  } catch (err) {
    console.error('[push] Firebase init error:', (err as Error).message);
    return false;
  }
}

/**
 * Remove stale FCM tokens that are no longer registered on the device.
 */
async function removeStaleTokens(userId: string, tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  try {
    await db
      .delete(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.userId, userId),
        inArray(pushSubscriptions.fcmToken, tokens)
      ));
  } catch {
    console.error(`[push] failed to remove stale tokens for userId=${userId}`);
  }
}

/**
 * Send a push notification to one or more FCM tokens.
 * No-op if FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY not set.
 * @param tokens - FCM registration tokens to target.
 * @param title - Notification title.
 * @param body - Notification body text.
 * @param data - Optional string key-value data payload.
 * @param userId - Used to clean up stale tokens on delivery failure.
 */
export async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
  userId?: string
): Promise<{ sent: number; failed: number }> {
  if (tokens.length === 0) return { sent: 0, failed: 0 };

  const ready = await ensureFirebaseInit();
  if (!ready) return { sent: 0, failed: 0 };

  try {
    const admin = (await import('firebase-admin')).default;
    const multicast = {
      tokens,
      notification: { title, body },
      ...(data !== undefined ? { data } : {}),
    };
    const response = await admin.messaging().sendEachForMulticast(multicast);

    const staleTokens: string[] = [];
    response.responses.forEach((resp, i) => {
      if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
        staleTokens.push(tokens[i]!);
      }
    });

    if (staleTokens.length > 0 && userId) {
      await removeStaleTokens(userId, staleTokens);
    }

    return { sent: response.successCount, failed: response.failureCount };
  } catch (err) {
    console.error('[push] sendEachForMulticast error:', (err as Error).message);
    return { sent: 0, failed: tokens.length };
  }
}
