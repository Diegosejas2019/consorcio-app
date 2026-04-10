const CACHE_NAME = 'consorcio-v4';
const STATIC_ASSETS = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Al instalar: pre-cachear solo íconos estáticos y activar de inmediato
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Al activar: limpiar caches viejos, tomar control y avisar a los clientes
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ includeUncontrolled: true, type: 'window' }))
      .then(clients => clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' })))
  );
});

// Fetch: network-first para archivos de la app (siempre frescos), cache-first para íconos
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isAppFile = e.request.destination === 'document'
    || url.pathname.endsWith('.js')
    || url.pathname.endsWith('.css');

  if (isAppFile) {
    // Network-first: intenta red, actualiza cache, fallback a cache
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then(cached => cached || caches.match('/index.html')))
    );
  } else {
    // Cache-first para íconos y recursos estáticos
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
  }
});
