const scope = new URL(self.registration.scope);
const cachePrefix = 'mr-scala:' + scope.pathname + ':';
const cacheName = cachePrefix + '0.33';
const staticUrls = [
  './', './index.html', './style.css?v=0.33', './scala.js?v=0.33',
  './manifest.webmanifest?v=0.33', './caratula.webp', './scala-fachada-180.png', './scala-fachada-192.png', './scala-fachada-512.png'
].map(path => new URL(path, scope).href);
const assets = new Set(staticUrls);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(staticUrls)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.filter(name => name.startsWith(cachePrefix) && name !== cacheName)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const homepage = event.request.mode === 'navigate' && url.origin === scope.origin &&
    [scope.pathname, scope.pathname + 'index.html'].includes(url.pathname);
  if (!homepage && !assets.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    if (homepage) {
      try {
        const result = await fetch(event.request);
        if (result.ok) return result;
      } catch {
        // Open the installed app shell when offline.
      }
      return (await cache.match(staticUrls[0])) || Response.error();
    }
    return (await cache.match(event.request)) || fetch(event.request);
  })());
});
