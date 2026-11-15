/* FIT@HCMUS offline app shell.
 * Load once while online to prepare pages and libraries for offline access.
 * Academic records stay in the browser's localStorage; no grade data is sent here.
 */
const OFFLINE_VERSION = 'fit-hcmus-offline-20261115-v1';
const SHELL_CACHE = OFFLINE_VERSION + '-shell';
const RUNTIME_CACHE = OFFLINE_VERSION + '-runtime';
const APP_SHELL = [
  './', './index.html', './register.html', './dashboard.html',
  './program.html', './grades.html', './goals.html',
  './graduation.html', './settings.html', './module-politics.html',
  './module-skills.html', './module-math.html', './module-it.html',
  './module-language.html', './module-foundation.html',
  './module-major.html', './module-graduation.html',
  './style.css', './script.js', './auth-guard.js',
  './course-requirements.js', './hoc_truoc_K2025.json'
];
const ONLINE_LIBRARIES = [
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap'
];

async function cacheResource(cache, url) {
  try {
    const request = new Request(url, { mode: new URL(url, self.location.href).origin === self.location.origin ? 'same-origin' : 'no-cors' });
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') {
      await cache.put(request, response);
      return true;
    }
  } catch (error) {
    console.warn('[offline] Could not cache:', url, error);
  }
  return false;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // Required local files: an incomplete installation must not claim to be offline-ready.
    await cache.addAll(APP_SHELL);
    // Cross-origin libraries can be opaque; cache them individually.
    const libraryResults = await Promise.all(ONLINE_LIBRARIES.map(url => cacheResource(cache, url)));
    if (libraryResults.some(ok => !ok)) {
      console.warn('[offline] Some online libraries are not yet cached; retry preparation while online.');
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const existing = await caches.keys();
    await Promise.all(existing.filter(name => name.startsWith('fit-hcmus-offline-') &&
      name !== SHELL_CACHE && name !== RUNTIME_CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function networkFirst(request, navigation = false) {
  const runtime = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') {
      await runtime.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (navigation) {
      const index = await caches.match('./index.html');
      if (index) return index;
    }
    return Response.error();
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !/^https?:$/.test(new URL(request.url).protocol)) return;
  const url = new URL(request.url);
  const isLocal = url.origin === self.location.origin;
  if (isLocal) {
    // No caching of user data: all academic data are localStorage only.
    event.respondWith(networkFirst(request, request.mode === 'navigate'));
    return;
  }
  // Runtime-cache fonts and CDN assets as they are requested by the browser.
  if (['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com',
       'fonts.gstatic.com', 'use.fontawesome.com'].includes(url.hostname)) {
    event.respondWith((async () => {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;
      return networkFirst(request);
    })());
  }
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'OFFLINE_STATUS') return;
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const missing = [];
    for (const url of APP_SHELL) {
      if (!(await cache.match(url))) missing.push(url);
    }
    const unavailableLibraries = [];
    for (const url of ONLINE_LIBRARIES) {
      if (!(await cache.match(url))) unavailableLibraries.push(url);
    }
    event.source?.postMessage({
      type: 'OFFLINE_STATUS',
      ready: missing.length === 0 && unavailableLibraries.length === 0,
      missing, unavailableLibraries
    });
  })());
});
