import { useState, useEffect, useCallback } from 'react';
import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app';
import { getMessaging, getToken, deleteToken, type GetTokenOptions } from 'firebase/messaging';
import { useAuthStore } from '../stores/auth';

const STORAGE_KEY = 'librams-push-subscribed';
const VAPID_KEY = (import.meta.env.VITE_FIREBASE_VAPID_KEY as string) || '';

const firebaseConfig: FirebaseOptions = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || '',
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || '',
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || '',
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || '',
};

/** Returns true when the browser and env vars support push notifications. */
function checkSupport(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    Boolean(firebaseConfig.apiKey) &&
    Boolean(VAPID_KEY)
  );
}

/** Initialise Firebase app singleton and return messaging instance. */
function getFirebaseMessaging() {
  const app = getApps().length > 0
    ? getApps()[0]!
    : initializeApp(firebaseConfig);
  return getMessaging(app);
}

/** Build GetTokenOptions with the VAPID key if available. */
function buildTokenOptions(registration?: ServiceWorkerRegistration): GetTokenOptions {
  const opts: GetTokenOptions = {};
  if (VAPID_KEY) opts.vapidKey = VAPID_KEY;
  if (registration) opts.serviceWorkerRegistration = registration;
  return opts;
}

/** Send Firebase config to the service worker so it can init itself. */
async function notifyServiceWorker(registration: ServiceWorkerRegistration): Promise<void> {
  registration.active?.postMessage({
    type: 'FIREBASE_CONFIG',
    config: firebaseConfig,
  });
}

/**
 * Request push notification permission and register FCM token with the API.
 * Returns helpers to subscribe/unsubscribe plus current state.
 */
export function usePushNotifications() {
  const { accessToken } = useAuthStore();
  const isSupported = checkSupport();
  const [isSubscribed, setIsSubscribed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === 'true'
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isSupported) return;
    const stored = localStorage.getItem(STORAGE_KEY) === 'true';
    if (stored !== isSubscribed) setIsSubscribed(stored);
  }, [isSupported, isSubscribed]);

  const subscribe = useCallback(async (): Promise<void> => {
    if (!isSupported || !accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Notification permission denied. Enable it in browser settings.');
        return;
      }
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      await notifyServiceWorker(registration);
      const messaging = getFirebaseMessaging();
      const token = await getToken(messaging, buildTokenOptions(registration));
      await fetch('/api/v1/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          fcmToken: token,
          deviceName: navigator.userAgent.slice(0, 255),
        }),
      });
      localStorage.setItem(STORAGE_KEY, 'true');
      setIsSubscribed(true);
    } catch (err) {
      setError((err as Error).message ?? 'Failed to enable push notifications.');
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, accessToken]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!isSupported || !accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
      const messaging = getFirebaseMessaging();
      const token = await getToken(messaging, buildTokenOptions(registration));
      await fetch('/api/v1/push/subscribe', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ fcmToken: token }),
      });
      await deleteToken(messaging);
      localStorage.removeItem(STORAGE_KEY);
      setIsSubscribed(false);
    } catch (err) {
      setError((err as Error).message ?? 'Failed to disable push notifications.');
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, accessToken]);

  return { isSupported, isSubscribed, isLoading, error, subscribe, unsubscribe };
}
