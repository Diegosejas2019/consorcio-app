const CACHE_NAME = 'consorcio-v5';
const API_CACHE  = 'consorcio-api-v1';
const API_ORIGIN = 'https://consorcio-api-production.up.railway.app/api/';
const TTL_MS     = 24 * 60 * 60 * 1000; // 24 horas

const STATIC_ASSETS = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── Instalar: pre-cachear íconos y activar de inmediato ──────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activar: limpiar caches viejos ───────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== API_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ includeUncontrolled: true, type: 'window' }))
      .then(clients => clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' })))
  );
});

// ── Handler para requests GET a la API (network-first + cache 24h) ──
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const networkRes = await fetch(request);
    if (networkRes.ok) {
      const body    = await networkRes.clone().arrayBuffer();
      const headers = new Headers(networkRes.headers);
      headers.set('X-Cached-At', Date.now().toString());
      cache.put(request, new Response(body, { status: networkRes.status, headers }));
    }
    return networkRes;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      const cachedAt = parseInt(cached.headers.get('X-Cached-At') || '0');
      if (Date.now() - cachedAt > TTL_MS) {
        // Datos stale (>24h): devolver igual con header indicador
        const body    = await cached.clone().arrayBuffer();
        const headers = new Headers(cached.headers);
        headers.set('X-Cache-Stale', 'true');
        return new Response(body, { status: cached.status, headers });
      }
      return cached;
    }
    return new Response(
      JSON.stringify({ success: false, message: 'Sin conexión y sin datos cacheados.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // API GET → network-first con fallback a cache
  if (e.request.method === 'GET' && url.startsWith(API_ORIGIN)) {
    e.respondWith(handleApiRequest(e.request));
    return;
  }

  const parsed   = new URL(url);
  const isAppFile = e.request.destination === 'document'
    || parsed.pathname.endsWith('.js')
    || parsed.pathname.endsWith('.css');

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
