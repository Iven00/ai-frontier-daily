/* Mirakee Signal service worker — LIVE SITE (scope /ai-frontier-daily/).
 * Caches the APP SHELL ONLY (pwa js/css with hashed names, icons, manifest, offline page); versioned cache name.
 * Never cached: HTML pages, JSON, MP3/media, Apps Script, Google sign-in, anything cross-origin, anything with a token.
 *   page navigations → straight to the network (always the fresh issue); only when the network fails → the 「目前離線」 page
 *   everything else  → not handled at all (the browser loads it exactly as without a service worker; MP3 Range streaming untouched)
 */
'use strict';
const VERSION = 'da10fc66';
const SHELL = 'ms-site-shell-' + VERSION;
const SCOPE = new URL(self.registration.scope);
const SHELL_FILES = ["offline/", "site.webmanifest", "assets/pwa.1a7cd500.js", "assets/pwa.17166b47.css", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "favicon.svg", "favicon.ico", "assets/share.dfe73a53.js", "assets/share.22531120.css"];   // relative to scope
const OFFLINE = new URL('offline/', SCOPE).href;
const SECRET = /[?&](s|t|token|credential|code|state|id_token|access_token|g_csrf_token)=/i;
const SHELL_PATHS = new Set(SHELL_FILES.map(f => new URL(f, SCOPE).pathname));

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL); await c.addAll(SHELL_FILES.map(f => new Request(new URL(f, SCOPE), { cache: 'reload' })));
    if (!self.registration.active) await self.skipWaiting();   // first install: take over now; an update waits for the toast 「有新版本，點一下更新」
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('ms-site-') && k !== SHELL) await caches.delete(k);   // only this worker's own caches
    await self.clients.claim();
  })());
});
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); if (e.data && e.data.type === 'VERSION' && e.ports[0]) e.ports[0].postMessage(VERSION); });

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== SCOPE.origin || !u.pathname.startsWith(SCOPE.pathname)) return;   // Apps Script / Google / other origins → untouched
  if (SECRET.test(u.search)) return;                                                   // e-mail/unsubscribe tokens → untouched
  if (req.mode === 'navigate') {                                                       // HTML: network only, offline page as fallback, nothing stored
    e.respondWith(fetch(req).catch(async () => (await caches.match(OFFLINE)) || Response.error()));
    return;
  }
  if (SHELL_PATHS.has(u.pathname)) {                                                   // app shell: cache-first, exact URL
    e.respondWith((async () => {
      const c = await caches.open(SHELL); const hit = await c.match(req); if (hit) return hit;
      try { return await fetch(req); } catch (x) { const any = await c.match(req, { ignoreSearch: true }); if (any) return any; throw x; }
    })());
  }
  // anything else (JSON, MP3, images, afd.js, css, feeds…) → not handled
});
