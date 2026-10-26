/* Mirakee Signal PWA service worker — PREVIEW (scope = the folder this file is served from).
 * Strategy:
 *   app shell (CSS/JS/icons/manifest/offline page) → cache-first, versioned cache name (VERSION changes whenever a shell file changes)
 *   HTML pages + *.json                           → network-first (fresh issue whenever online); last good copy used only when offline
 *   same-origin images                             → cache-first (small runtime cache, capped)
 *   MP3 / any Range request / media                → NOT handled (browser streams from the network; no Range breakage)
 *   other origins (Apps Script, Google sign-in, fonts…) and any URL with a token → NOT handled (network only, never cached)
 */
'use strict';
const VERSION = '6346b40e82';
const SHELL = 'ms-pwa-shell-' + VERSION, PAGES = 'ms-pwa-pages-' + VERSION, IMG = 'ms-pwa-img-' + VERSION;
const SCOPE = new URL(self.registration.scope);
const SHELL_FILES = ["manifest.webmanifest", "offline/", "assets/afd.js", "assets/afd-listen.js", "assets/config.js", "assets/v2.css", "assets/item-topics.json", "assets/pwa.94cf3665.js", "assets/pwa.120bf9e4.css", "icons/apple-touch-icon.png", "icons/favicon.ico", "icons/favicon.svg", "icons/icon-192.png", "icons/icon-32.png", "icons/icon-512.png", "icons/icon-maskable-512.png"];   // relative to scope
const PRE_PAGES = ["./", "archive/", "daily/2026-10-26/", "special/2026-10-26/"];     // pages cached at install so offline works right away
const OFFLINE = new URL('offline/', SCOPE).href;
const SECRET = /[?&](s|t|token|credential|code|state|id_token|access_token|g_csrf_token)=/i;
const SHELL_PATHS = new Set(SHELL_FILES.map(f => new URL(f, SCOPE).pathname));

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL); await c.addAll(SHELL_FILES.map(f => new Request(new URL(f, SCOPE), { cache: 'reload' })));
    const p = await caches.open(PAGES); await Promise.all(PRE_PAGES.map(async f => { try { const r = await fetch(new Request(new URL(f, SCOPE), { cache: 'reload' })); if (r.ok) await p.put(new URL(f, SCOPE).href, r); } catch (x) {} }));
    // first install takes control at once; an UPDATE waits until the page asks (toast 「有新版本，點一下更新」)
    if (!self.registration.active) await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keep = new Set([SHELL, PAGES, IMG]);
    for (const k of await caches.keys()) if (k.startsWith('ms-pwa-') && !keep.has(k)) {
      if (k.startsWith('ms-pwa-pages-')) { // carry visited issues over so the offline list survives updates
        const old = await caches.open(k), nw = await caches.open(PAGES);
        for (const q of await old.keys()) if (!(await nw.match(q))) { const r = await old.match(q); if (r) await nw.put(q, r); }
      }
      await caches.delete(k);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('message', e => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); if (e.data && e.data.type === 'VERSION' && e.ports[0]) e.ports[0].postMessage(VERSION); });

function inScope(u) { return u.origin === SCOPE.origin && u.pathname.startsWith(SCOPE.pathname); }
async function networkFirst(req, cacheName, fallbackOffline) {
  const key = new URL(req.url); key.search = ''; key.hash = '';
  try {
    // cache:'no-cache' → always revalidate with the server (ETag/304), so the HTTP cache (GitHub Pages max-age=600) never hides a new issue
    const r = await fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin', redirect: 'follow' }));
    if (r.redirected && req.mode === 'navigate') return Response.redirect(r.url, 302);
    if (r.ok && r.type === 'basic' && !r.headers.get('set-cookie')) { const c = await caches.open(cacheName); c.put(key.href, r.clone()); }
    return r;
  } catch (x) {
    const hit = await caches.match(key.href, { ignoreSearch: true });
    if (hit) return hit;
    if (fallbackOffline) { const o = await caches.match(OFFLINE); if (o) return o; }
    return new Response('offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
async function cacheFirst(req, cacheName, cap) {
  // exact URL incl. ?v= — a page asking for a newer asset version never gets an older cached copy
  const hit = await caches.match(req);
  if (hit) return hit;
  let r;
  try { r = await fetch(req); } catch (x) {
    const any = cacheName === SHELL && await caches.match(req, { ignoreSearch: true }); // offline: same file, other ?v=
    if (any) return any; throw x;
  }
  if (r.ok && r.type === 'basic') { const c = await caches.open(cacheName); await c.put(req, r.clone()); if (cap) { const ks = await c.keys(); for (let i = 0; i < ks.length - cap; i++) await c.delete(ks[i]); } }
  return r;
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;            // POSTs (Apps Script, sign-in, events) → network
  const u = new URL(req.url);
  if (u.origin !== SCOPE.origin) return;                               // Apps Script / Google / anything cross-origin → network only
  if (SECRET.test(u.search)) return;                                   // email/unsubscribe tokens, credentials → never cached
  if (req.headers.has('range') || /\.(mp3|m4a|aac|ogg|wav)$/i.test(u.pathname) || req.destination === 'audio' || req.destination === 'video') return; // stream from network
  if (req.mode === 'navigate') { if (inScope(u)) e.respondWith(networkFirst(req, PAGES, true)); return; }
  if (SHELL_PATHS.has(u.pathname)) { e.respondWith(cacheFirst(req, SHELL)); return; }
  if (/\.json$/i.test(u.pathname)) { e.respondWith(networkFirst(req, PAGES, false)); return; }
  if (req.destination === 'image') { e.respondWith(cacheFirst(req, IMG, 80)); return; }
});
