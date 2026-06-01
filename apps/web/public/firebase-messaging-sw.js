// Firebase Messaging Service Worker
// IMPORTANT: Replace the firebaseConfig values below with your actual Firebase project config for production.
// These values are intentionally placeholder for MVP — do not deploy to production without updating them.
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Accept config from main thread via postMessage so runtime VITE env vars can be forwarded.
// Falls back to placeholder values — replace for production.
let firebaseConfig = {
  apiKey: 'REPLACE_WITH_VITE_FIREBASE_API_KEY',
  projectId: 'REPLACE_WITH_VITE_FIREBASE_PROJECT_ID',
  messagingSenderId: 'REPLACE_WITH_VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'REPLACE_WITH_VITE_FIREBASE_APP_ID',
};

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    firebaseConfig = event.data.config;
    initFirebase();
  }
});

let messaging = null;

function initFirebase() {
  if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
  }
  messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? 'LibraMS';
    const body = payload.notification?.body ?? '';
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-72.png',
      data: payload.data ?? {},
    });
  });
}

// Attempt init with placeholder config on load (no-op in production until FIREBASE_CONFIG message arrives).
try {
  initFirebase();
} catch {
  // Will be re-initialised when FIREBASE_CONFIG message is received.
}
