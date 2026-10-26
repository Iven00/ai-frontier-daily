/* Mirakee Signal — LINE image-card share via LIFF shareTargetPicker (user-approved 2026-10-26 10:16; robust flow 10:36; live 11:26).
   Opened as https://liff.line.me/<LIFF_ID>?p=<page path>&r=<short code>. The LIFF endpoint URL must be this page
   (live: https://iven00.github.io/ai-frontier-daily/share/liff/ ; the same page is mirrored at /preview/share/liff/ and works there too).
   Flow: load SDK (official CDN only) → liff.init (on the first load LINE adds ?liff.state=…; the SDK itself then reloads this
   page with ?p=&r= and init never resolves on that first load) → if not logged in: liff.login({redirectUri: this page + p/r},
   once) → isApiAvailable('shareTargetPicker') → shareTargetPicker([Flex image card]) automatically, plus a big button
   (user gesture) to retry. NEVER auto-redirects: on failure / cancel the page stays, shows why, and offers
   「改用文字分享」 (3-line text via line.me/R/share) and 「回到文章」. After a successful send inside LINE: liff.closeWindow().
   p must be one of the whitelisted pages embedded at build time. No tokens are read, shown or stored by this script;
   the SDK's own LIFF_STORE:* session keys are cleared after a successful send. Debug panel shows no secrets. */
(function () {
  'use strict';
  var C = JSON.parse(document.getElementById('ms-liff').textContent), W = window, $ = function (id) { return document.getElementById(id); };
  var q = new URLSearchParams(location.search), s = q.get('liff.state') || '', P = {};
  if (s) { var i = s.indexOf('?'); if (i >= 0) new URLSearchParams(s.slice(i + 1).split('#')[0]).forEach(function (v, k) { P[k] = v; }); }
  q.forEach(function (v, k) { if (k === 'p' || k === 'r') P[k] = v; });
  var key = Object.prototype.hasOwnProperty.call(C.pages, P.p || '') ? (P.p || '') : '';
  var pg = C.pages[key];
  var r = /^l[isp](?:[0-9a-f]{7})?$/.test(P.r || '') ? P.r : 'l' + pg.c;
  var link = C.base + key + '?r=' + r + '&openExternalBrowser=1';
  var msg = pg.t + (pg.x ? '\n' + pg.x : '') + '\n' + link;
  var textShare = 'https://line.me/R/share?text=' + encodeURIComponent(msg);
  var self = location.origin + location.pathname + '?p=' + encodeURIComponent(key) + '&r=' + encodeURIComponent(r);
  var flex = { type: 'flex', altText: pg.t.slice(0, 400), contents: { type: 'bubble', size: 'giga',
    hero: { type: 'image', url: pg.img, size: 'full', aspectRatio: '1200:630', aspectMode: 'cover',
      action: { type: 'uri', label: '閱讀', uri: link } } } };
  var S = { step: 'start', err: '', ready: false, busy: false, result: '' };
  W.__msLiff = { key: key, link: link, msg: msg, textShare: textShare, flex: flex, S: S };
  $('txt').href = textShare; $('back').href = pg.back || C.base + key; $('card').src = pg.img;
  var go = $('go'), DEBUG = q.get('debug') === '1' || /[?&]debug=1/.test(s);
  if (DEBUG) { $('dbg').hidden = false; $('dbgh').hidden = false; }
  // fallback UI (card preview, big button, text-share / back links) stays hidden on the normal path (picker → close)
  function showFallback(btn) { $('card').hidden = false; $('alt').hidden = false; if (btn) go.hidden = false; }
  function L() { return W.liff; }
  function safe(f) { try { return f(); } catch (e) { return 'n/a'; } }
  function ua() { var u = navigator.userAgent || ''; var m = / Line\/([\d.]+)/.exec(u); return (/Android/.test(u) ? 'Android' : /iPhone|iPad|iPod/.test(u) ? 'iOS' : 'other') + (m ? ' · LINE app UA ' + m[1] : ' · not LINE UA') + (/FBAN|FBAV|Instagram/.test(u) ? ' · FB/IG in-app' : '') + ((W.matchMedia && matchMedia('(display-mode: standalone)').matches) ? ' · PWA standalone' : ''); }
  function draw() {
    var l = L(), has = !!(l && l.init);
    var ctx = has && S.inited ? safe(function () { var c = l.getContext(); return c ? c.type + (c.viewType ? ' / ' + c.viewType : '') : 'null'; }) : '-';
    var lines = [
      'step: ' + S.step + (S.result ? ' → ' + S.result : ''),
      'error: ' + (S.err || '-'),
      'sdk: ' + (has ? 'loaded ' + safe(function () { return l.getVersion(); }) : 'not loaded'),
      'isInClient: ' + (has && S.inited ? safe(function () { return l.isInClient(); }) : '-'),
      'isLoggedIn: ' + (has && S.inited ? safe(function () { return l.isLoggedIn(); }) : '-'),
      'isApiAvailable(shareTargetPicker): ' + (has && S.inited ? safe(function () { return l.isApiAvailable('shareTargetPicker'); }) : '-'),
      'OS (liff): ' + (has && S.inited ? safe(function () { return l.getOS(); }) : '-') + ' · LINE ' + (has && S.inited ? safe(function () { return l.getLineVersion(); }) : '-'),
      'context type: ' + ctx,
      'browser: ' + ua(),
      'page: ' + location.pathname + ' · p=' + (key || '(home)') + ' · r=' + r + (s ? ' · liff.state present' : '') + (q.has('code') ? ' · returned from LINE login' : ''),
      'liffId: ' + C.liff + ' · time: ' + new Date().toLocaleTimeString('zh-TW', { hour12: false })
    ];
    $('dbg').textContent = lines.join('\n');
  }
  function step(n, txt) { S.step = n; if (txt) $('st').textContent = txt; draw(); try { console.info('ms-liff ' + n + (S.result ? ' ' + S.result : '') + (S.err ? ' ' + S.err : '')); } catch (e) {} }
  function fail(n, e, txt) { S.err = ((e && (e.code || e.name)) || '') + (e && e.message ? ': ' + String(e.message).slice(0, 160) : ''); S.result = 'failed'; showFallback(S.ready); step(n, txt || '圖片卡分享沒有成功，可以再按一次，或改用文字分享。'); }
  function clearSdkSession() {
    [W.localStorage, W.sessionStorage].forEach(function (St) { try { for (var j = St.length - 1; j >= 0; j--) { var k = St.key(j); if (k && /^LIFF_STORE/.test(k)) St.removeItem(k); } } catch (e) {} });
  }
  function share(gesture) {
    if (!S.ready || S.busy) return; S.busy = true; go.disabled = true; S.err = ''; S.result = '';
    step(gesture ? 'share (button)' : 'share (auto)', '選擇要分享的聊天室…');
    var pr; try { pr = L().shareTargetPicker([flex], { isMultiple: true }); } catch (e) { S.busy = false; go.disabled = false; return fail('share threw', e); }
    Promise.resolve(pr).then(function (res) {
      S.busy = false;
      if (res) {
        S.result = 'sent'; step('done', '已分享 ✓'); clearSdkSession();
        if (safe(function () { return L().isInClient(); }) === true) { try { L().closeWindow(); } catch (e) {} }
        go.disabled = false; go.textContent = '再分享一次';
      } else {
        S.result = 'cancelled'; go.disabled = false; step('picker closed', '已取消。要分享請按下方按鈕。');
        if (safe(function () { return L().isInClient(); }) === true && !DEBUG) { try { L().closeWindow(); return; } catch (e) {} }   // same as ed10169 inside LINE
        showFallback(true);
      }
    }, function (e) { S.busy = false; go.disabled = false; fail('share error', e); });
  }
  go.addEventListener('click', function () { share(true); });
  function afterInit() {
    S.inited = true; var l = L();
    if (!l.isLoggedIn()) {
      var tried = 0; try { tried = +(sessionStorage.getItem('ms-liff-login') || 0); } catch (e) {}
      if (tried && Date.now() - tried < 120000) { S.result = 'not logged in'; showFallback(false); return step('login failed', '沒有登入 LINE，無法用圖片卡分享。請改用文字分享。'); }
      try { sessionStorage.setItem('ms-liff-login', String(Date.now())); } catch (e) {}
      step('login', '正在登入 LINE…');
      try { l.login({ redirectUri: self }); } catch (e) { fail('login error', e); }
      return;
    }
    try { sessionStorage.removeItem('ms-liff-login'); } catch (e) {}
    var ok = false; try { ok = l.isApiAvailable('shareTargetPicker'); } catch (e) {}
    if (!ok) { S.result = 'unavailable'; showFallback(false); return step('api unavailable', '這個環境不支援圖片卡分享（shareTargetPicker）。請改用文字分享。'); }
    S.ready = true; go.disabled = false; step('ready', '');
    share(false);
  }
  setTimeout(function () { if (!S.inited && !S.err) { S.err = 'timeout: liff.init not finished after 15s'; showFallback(false); step(S.step, '等太久了，可以改用文字分享。'); } }, 15000);
  step('loading sdk');
  var sc = document.createElement('script');
  sc.src = C.sdk; sc.async = true;
  sc.onerror = function () { fail('sdk load error', { code: 'SDK_LOAD' }, '無法載入 LINE 元件，請改用文字分享。'); };
  sc.onload = function () {
    if (!W.liff || !W.liff.init) return fail('sdk missing', { code: 'SDK_MISSING' });
    step('init');
    W.liff.init({ liffId: C.liff }).then(function () {
      if (s) { step('init (liff.state)'); setTimeout(function () { if (S.step === 'init (liff.state)') afterInit(); }, 4000); return; }   // the SDK normally reloads the page here
      afterInit();
    }, function (e) { fail('init error', e, 'LINE 初始化失敗（請確認 LIFF Endpoint URL），可以改用文字分享。'); });
  };
  document.head.appendChild(sc);
})();
