const CACHE_NAME = 'meteran-air-v2';
const assetsToCache = [
  '/',
  '/index.html',
  '/app.js',
  '/config.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// 1. Install Event: Menyimpan aset ke cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assetsToCache);
    })
  );
  self.skipWaiting(); // Langsung aktifkan service worker baru tanpa menunggu tab ditutup
});

// 2. Activate Event: Menghapus cache lama jika ada pembaruan versi
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch Event: Strategi Network-First untuk Supabase, Cache-First untuk aset lokal
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Abaikan request ke Supabase atau API eksternal agar data selalu *real-time*
  if (url.origin.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).catch(() => {
        // Fallback opsional jika offline total
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
