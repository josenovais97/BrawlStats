/*
 * BrawlZone's service worker (2026-10-28): free-reward notifications, and
 * nothing else -- no caching, no offline pages, so it can never serve a stale
 * site. A push carries {title, body, url}; tapping it opens the url.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'BrawlZone', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || '🎁 New free Brawl Stars reward', {
      body: data.body || 'Tap to claim it before it expires.',
      icon: '/bubble/app-icon.png',
      badge: '/bubble/app-icon.png',
      tag: data.tag || 'brawlzone-reward',
      renotify: true,
      data: { url: data.url || '/rewards' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/rewards', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url === url && 'focus' in w) return w.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
