// Service worker customizado (estratégia injectManifest do vite-plugin-pwa).
// Substitui o generateSW anterior para poder reagir a eventos `push` reais —
// generateSW não permite adicionar listeners próprios. O precache e o
// runtime caching de fontes replicam exatamente o que estava em
// vite.config.js antes desta mudança.

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

self.skipWaiting();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// --- Push notifications ---
// icon-192x192.png (a cores) fica só para o Chrome desktop / ícone grande;
// icon-badge-mono.png é a silhueta monocromática exigida pelo Android para
// a barra de estado (um ícone a cores aí é ignorado e mostra um círculo em
// branco). A imagem mostrada quando a notificação é expandida varia por
// categoria (data.type) — success/warning/error/info — em vez de ser sempre
// a mesma imagem de marca; push-banner.png fica só como último recurso.
const BANNER_BY_TYPE = {
  success: '/banners/success.svg',
  warning: '/banners/warning.svg',
  error: '/banners/error.svg',
  info: '/banners/info.svg',
};
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Magnetic Place', body: event.data.text() };
  }
  const title = data.title || 'Magnetic Place';
  const options = {
    body: data.body || '',
    icon: '/icon-192x192.png',
    badge: '/icon-badge-mono.png',
    image: data.image || BANNER_BY_TYPE[data.type] || '/push-banner.png',
    tag: data.tag || 'default',
    renotify: true,
    vibrate: [120, 60, 120],
    actions: [
      { action: 'view', title: 'Ver Portal' },
      { action: 'dismiss', title: 'Dispensar' },
    ],
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
