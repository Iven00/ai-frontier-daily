/* Mirakee Signal — LINE image-card share via LIFF shareTargetPicker (PREVIEW, user-approved 2026-10-26 10:16).
   Opened as https://liff.line.me/<LIFF_ID>?p=<page path>&r=<short code>. The LIFF endpoint URL must be this page.
   Sends ONE Flex bubble that is only the page's share card (hero image 1200:630, cover); tapping it opens the page.
   p must be one of the whitelisted pages embedded at build time (no arbitrary text/images can be injected).
   Fallback (SDK not loaded, init error, not logged in / outside LINE, API unavailable, share error):
   the 3-line text share via line.me/R/share. No tokens are stored by this script; the LIFF SDK's own
   session keys (LIFF_STORE:*) are cleared when we finish. SDK only from the official CDN. */
(function () {
  'use strict';
  var C = JSON.parse(document.getElementById('ms-liff').textContent), W = window, done = false, started = false;
  var st = document.getElementById('st'), man = document.getElementById('man');
  function say(t) { if (st) st.textContent = t; }
  // params: after liff.init's secondary redirect they are in the query; on the primary redirect they sit inside liff.state
  var q = new URLSearchParams(location.search), s = q.get('liff.state') || '', P = {};
  if (s) { var i = s.indexOf('?'); if (i >= 0) new URLSearchParams(s.slice(i + 1).split('#')[0]).forEach(function (v, k) { P[k] = v; }); }
  q.forEach(function (v, k) { if (k.indexOf('liff.') !== 0) P[k] = v; });
  var key = Object.prototype.hasOwnProperty.call(C.pages, P.p || '') ? (P.p || '') : '';
  var pg = C.pages[key];
  var r = /^l[isp](?:[0-9a-f]{7})?$/.test(P.r || '') ? P.r : 'l' + pg.c;
  var link = C.base + key + '?r=' + r + '&openExternalBrowser=1';
  var msg = pg.t + (pg.x ? '\n' + pg.x : '') + '\n' + link;
  var textShare = 'https://line.me/R/share?text=' + encodeURIComponent(msg);
  var flex = { type: 'flex', altText: pg.t.slice(0, 400), contents: { type: 'bubble', size: 'giga',
    hero: { type: 'image', url: pg.img, size: 'full', aspectRatio: '1200:630', aspectMode: 'cover',
      action: { type: 'uri', label: '閱讀', uri: link } } } };
  W.__msLiff = { key: key, link: link, msg: msg, textShare: textShare, flex: flex, result: null };
  if (man) man.href = textShare;
  function clearSdkSession() {
    [W.localStorage, W.sessionStorage].forEach(function (S) { try { for (var j = S.length - 1; j >= 0; j--) { var k = S.key(j); if (k && /^LIFF_STORE/.test(k)) S.removeItem(k); } } catch (e) {} });
  }
  function fallback(why) {
    if (done) return; done = true; W.__msLiff.result = 'fallback:' + why; clearSdkSession();
    try { console.info('ms-liff ' + W.__msLiff.result); } catch (e) {}
    say('改用文字分享到 LINE…'); location.replace(textShare);
  }
  function finish(res) {
    if (done) return; done = true; W.__msLiff.result = res; clearSdkSession();
    try { console.info('ms-liff ' + res); } catch (e) {}
    var inClient = false; try { inClient = W.liff.isInClient(); } catch (e) {}
    say(res === 'sent' ? '已分享 ✓' : '已取消');
    if (inClient) { try { W.liff.closeWindow(); return; } catch (e) {} }
    location.replace(pg.back || C.base + key);
  }
  function run() {
    if (started || done) return; started = true;
    var L = W.liff;
    try { if (!L.isApiAvailable('shareTargetPicker')) return fallback('unavailable'); } catch (e) { return fallback('unavailable'); }
    say('選擇要分享的聊天室…');
    L.shareTargetPicker([flex], { isMultiple: true }).then(function (res) { finish(res ? 'sent' : 'cancelled'); },
      function (e) { fallback('share_error:' + ((e && e.code) || '')); });
  }
  setTimeout(function () { if (!started && !done) { if (man) man.hidden = false; } }, 6000);
  setTimeout(function () { if (!started && !done) fallback('timeout'); }, 15000);
  var sc = document.createElement('script');
  sc.src = C.sdk; sc.async = true;
  sc.onerror = function () { fallback('sdk_load'); };
  sc.onload = function () {
    if (!W.liff || !W.liff.init) return fallback('sdk_missing');
    W.liff.init({ liffId: C.liff }).then(function () {
      if (s) { setTimeout(run, 4000); return; }   // primary redirect: liff.init is about to load the secondary URL
      run();
    }, function (e) { fallback('init:' + ((e && e.code) || '')); });
  };
  document.head.appendChild(sc);
})();
