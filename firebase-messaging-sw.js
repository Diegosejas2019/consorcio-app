// ── Firebase Messaging Service Worker ────────────────────────
// Maneja push notifications cuando la app está en background o cerrada.
//
// IMPORTANTE: reemplazá la config con los mismos valores que en app.js
// (Firebase Console → Configuración → General → Tu app web)
//
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT_ID.firebaseapp.com',
  projectId:         'YOUR_PROJECT_ID',
  storageBucket:     'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId:             'YOUR_APP_ID',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'ConsorcioPro';
  const body  = payload.notification?.body  || '';
  const data  = payload.data || {};

  self.registration.showNotification(title, {
    body,
    icon:  '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag:   data.type || 'consorcio',
    data,
    requireInteraction: data.type === 'urgent',
  });
});

// Al hacer click en la notificación → abrir/enfocar la app
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find(c => c.url.includes(self.location.origin) && 'focus' in c);
      if (existing) return existing.focus();
      return clients.openWindow('/');
    })
  );
});
