/* Mirakee Signal PWA front end — PREVIEW. Registers the service worker (scope = preview folder), shows the update toast,
 * the bottom-tab 「更多」 sheet (分享本頁 + mobile-only 「📲 安裝到桌面」) + homepage hint (2nd visit on, dismiss remembered),
 * the iOS 「點分享 → 加入主畫面」 sheet, the in-app-browser hint, and fires pwa_* events through the existing pipeline. */
(function () {
  'use strict';
  var D = document, H = D.documentElement, ME = D.currentScript;
  // base = <html data-pwa-base> (preview) or the folder above this script (live: /ai-frontier-daily/assets/pwa.<hash>.js → /ai-frontier-daily/)
  var BASE = H.getAttribute('data-pwa-base') ? new URL(H.getAttribute('data-pwa-base'), location.href).href : ME && ME.src ? new URL('../', ME.src).href : new URL('./', location.href).href;
  var LS = (function () { try { localStorage.setItem('afd-t2', '1'); localStorage.removeItem('afd-t2'); return localStorage; } catch (e) { return null; } })();
  function g(k) { return LS ? LS.getItem(k) : null; } function s(k, v) { if (LS) LS.setItem(k, v); }
  function $(q, r) { return (r || D).querySelector(q); }
  var UA = navigator.userAgent || '';
  var IOS = /iPhone|iPad|iPod/i.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1), ANDROID = /Android/i.test(UA);
  var MOBILE = IOS || ANDROID || /Mobi/i.test(UA);
  var INAPP = (function () {
    var m = [['LINE', /\bLine\//i], ['Messenger', /FBAN\/Messenger|MessengerForiOS|Orca-Android/i], ['Facebook', /FBAN|FBAV|FB_IAB|FBIOS|FB4A/], ['Instagram', /Instagram/i], ['Threads', /Barcelona/i],
      ['WeChat', /MicroMessenger/i], ['TikTok', /musical_ly|TikTok|BytedanceWebview/i], ['KakaoTalk', /KAKAOTALK/i], ['X', /Twitter/i], ['LinkedIn', /LinkedInApp/i]];
    for (var i = 0; i < m.length; i++) if (m[i][1].test(UA)) return m[i][0];
    if (ANDROID && /; wv\)/.test(UA)) return 'App';
    if (IOS && /AppleWebKit/.test(UA) && !/Safari\//.test(UA) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(UA)) return 'App';
    return '';
  })();
  function standalone() { return (window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: minimal-ui)').matches)) || navigator.standalone === true; }
  // events → existing pipeline (afd.js exposes afdEv in this preview); queued until afd.js is ready
  var EQ = [];
  function ev(n, v) { if (window.afdEv) window.afdEv(n, v); else EQ.push([n, v]); }
  function evFlush() { if (window.afdEv) { while (EQ.length) { var x = EQ.shift(); window.afdEv(x[0], x[1]); } } else setTimeout(evFlush, 500); }
  setTimeout(evFlush, 300);

  // ---------- service worker + update toast ----------
  var RELOADING = false;
  function toast(html, onClick) {
    var t = D.createElement('div'); t.className = 'pwa-toast'; t.setAttribute('role', 'status'); t.innerHTML = html; D.body.appendChild(t);
    if (onClick) t.addEventListener('click', onClick); return t;
  }
  function offerUpdate(w) {
    if (!w || $('.pwa-toast[data-upd]')) return;
    var t = toast('<button type="button">🔄 有新版本，點一下更新</button>', function () { t.querySelector('button').disabled = true; w.postMessage({ type: 'SKIP_WAITING' }); });
    t.setAttribute('data-upd', '');
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (RELOADING || !window.__pwaHadController) return; RELOADING = true; location.reload(); });
    window.__pwaHadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register(BASE + 'sw.js', { scope: BASE }).then(function (reg) {
      window.__pwaReg = reg;
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', function () {
        var w = reg.installing; if (!w) return;
        w.addEventListener('statechange', function () { if (w.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(w); if (w.state === 'activated' && !window.__pwaHadController) window.__pwaHadController = true; });
      });
      // a returning tab checks for a new version (daily content itself is network-first, this is only for the app shell)
      D.addEventListener('visibilitychange', function () { if (D.visibilityState === 'visible') reg.update().catch(function () {}); });
    }).catch(function () {});
  }

  // ---------- install ----------
  var BIP = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); BIP = e; paint(); });
  window.addEventListener('appinstalled', function () { ev('pwa_installed', IOS ? 'ios' : ANDROID ? 'android' : 'other'); BIP = null; s('afd-pwa-installed', '1'); closeSheet(); paint(); });
  if (standalone()) { try { if (!sessionStorage.getItem('afd-pwa-launch')) { sessionStorage.setItem('afd-pwa-launch', '1'); ev('pwa_launch_standalone', IOS ? 'ios' : ANDROID ? 'android' : 'other'); } } catch (e) {} }
  function canShow() { return MOBILE && !standalone(); }

  var SVG_SHARE = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg>';
  var SVG_ADD = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
  var SVG_DOTS = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';
  var ICON = (function () { var l = D.querySelector('link[rel="apple-touch-icon"]'); return l ? l.href : BASE + 'icon-192.png'; })();
  function extUrl() {
    var u = new URL(location.href); u.hash = '';
    if (INAPP === 'LINE') { u.searchParams.set('openExternalBrowser', '1'); return u.toString(); }
    if (ANDROID) { u.searchParams.delete('openExternalBrowser'); return 'intent://' + u.host + u.pathname + u.search + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(u.toString()) + ';end'; }
    return '';
  }
  function sheetHTML(kind) {
    var head = '<div class="pwa-sh-hd"><img src="' + ICON + '" width="44" height="44" alt=""><div><b>安裝 Mirakee Signal</b><small>加到主畫面，每天早上一點就開，像 App 一樣全螢幕。</small></div><button type="button" class="pwa-x" data-pwa-close aria-label="關閉">✕</button></div>';
    if (kind === 'inapp') {
      var h = extUrl();
      return head + '<p class="pwa-p">你正在' + (INAPP === 'App' ? ' App 的內建瀏覽器' : '「' + INAPP + '」的內建瀏覽器') + '裡，這裡不能安裝。請改用 ' + (IOS ? 'Safari' : 'Chrome') + ' 開啟本站再安裝。</p>'
        + (h ? '<a class="pwa-btn pri" data-pwa-ext href="' + h.replace(/"/g, '&quot;') + '">用' + (INAPP === 'LINE' ? '預設瀏覽器' : ' Chrome ') + '開啟</a>' : '<p class="pwa-p sm">點右上角（或右下角）的「⋯」→「用 Safari 開啟」；或複製網址貼到 Safari。</p>')
        + '<button type="button" class="pwa-btn" data-pwa-copy>複製網址</button><span class="pwa-p sm" data-pwa-copied role="status"></span>';
    }
    if (kind === 'ios') return head + '<ol class="pwa-steps">'
      + '<li><span class="ic">' + SVG_SHARE + '</span><span>點 Safari 下方（iPad 在右上角）的<b>「分享」</b></span></li>'
      + '<li><span class="ic">' + SVG_ADD + '</span><span>往下滑，選<b>「加入主畫面」</b></span></li>'
      + '<li><span class="ic"><img src="' + ICON + '" width="22" height="22" alt=""></span><span>點右上角<b>「新增」</b>，主畫面就會出現 MS 圖示</span></li></ol>'
      + '<div class="pwa-arrow" aria-hidden="true">⬇︎ 分享按鈕在這裡</div>';
    return head + '<ol class="pwa-steps"><li><span class="ic">' + SVG_DOTS + '</span><span>點瀏覽器右上角的<b>「⋮」</b></span></li>'
      + '<li><span class="ic">' + SVG_ADD + '</span><span>選<b>「安裝應用程式」</b>或<b>「加到主畫面」</b></span></li></ol>';
  }
  var SH = null;
  function closeSheet() { if (SH) { try { SH.close(); } catch (e) {} SH.remove(); SH = null; } }
  function openSheet(kind) {
    closeSheet(); SH = D.createElement('dialog'); SH.className = 'pwa-sheet' + (kind === 'ios' ? ' ios' : ''); SH.setAttribute('aria-label', '安裝到桌面'); SH.setAttribute('data-kind', kind);
    SH.innerHTML = sheetHTML(kind); D.body.appendChild(SH);
    SH.addEventListener('click', function (e) {
      if (e.target === SH || e.target.closest('[data-pwa-close]')) return closeSheet();
      if (e.target.closest('[data-pwa-ext]')) ev('pwa_install_prompt', 'inapp_escape:' + INAPP);
      if (e.target.closest('[data-pwa-copy]')) { var u = location.href.split('#')[0], o = $('[data-pwa-copied]', SH);
        (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { o.textContent = '已複製'; }, function () { o.textContent = u; }); }
    });
    if (SH.showModal) SH.showModal(); else SH.setAttribute('open', '');
  }
  function install(src) {
    if (INAPP) { ev('pwa_install_prompt', 'inapp:' + INAPP + ':' + src); return openSheet('inapp'); }
    if (BIP) { closeSheet(); var p = BIP; BIP = null; p.prompt(); ev('pwa_install_prompt', 'native:' + src);
      (p.userChoice || Promise.resolve({})).then(function (c) { ev('pwa_install_prompt', 'native_' + ((c && c.outcome) || 'unknown')); paint(); }); return; }
    ev('pwa_install_prompt', (IOS ? 'ios_sheet:' : 'manual_sheet:') + src); openSheet(IOS ? 'ios' : 'manual');
  }
  // entry 1: bottom tab 「更多」 (replaces the old 「分享」 tab, built into the HTML) → small sheet: 分享本頁 (existing share sheet via data-afd-share) + 📲 安裝到桌面 (only when installable)
  function openMore(btn) {
    closeSheet(); SH = D.createElement('dialog'); SH.className = 'pwa-sheet pwa-more'; SH.setAttribute('aria-label', '更多'); SH.setAttribute('data-kind', 'more');
    SH.innerHTML = '<div class="pwa-more-hd"><b>更多</b><button type="button" class="pwa-x" data-pwa-close aria-label="關閉">✕</button></div>'
      + '<button type="button" class="pwa-row" data-afd-share>🔗<span>分享本頁</span></button>'
      + (canShow() ? '<button type="button" class="pwa-row" data-pwa-install="more">📲<span>安裝到桌面</span><small>' + (INAPP ? '需用瀏覽器開啟' : IOS ? '加入主畫面' : '') + '</small></button>' : '');
    D.body.appendChild(SH);
    if (btn) { btn.setAttribute('aria-expanded', 'true'); SH.addEventListener('close', function () { btn.setAttribute('aria-expanded', 'false'); }); }
    // close first, then let the click bubble on to afd.js (data-afd-share → the existing share sheet) or to install()
    SH.addEventListener('click', function (e) { if (e.target === SH || e.target.closest('[data-pwa-close]') || e.target.closest('[data-afd-share]')) closeSheet(); });
    if (SH.showModal) SH.showModal(); else SH.setAttribute('open', '');
  }
  // entry 2: homepage hint from the 2nd visit on (one visit per browser session), dismiss remembered
  var IS_HOME = H.getAttribute('data-pwa-page') === 'home';
  try { if (!sessionStorage.getItem('afd-pwa-sess')) { sessionStorage.setItem('afd-pwa-sess', '1'); s('afd-pwa-visits', String((+g('afd-pwa-visits') || 0) + 1)); } } catch (e) {}
  function hint() {
    var ex = $('.pwa-hint');
    var want = IS_HOME && canShow() && (+g('afd-pwa-visits') || 0) >= 2 && g('afd-pwa-hint-x') !== '1';
    if (!want) { if (ex) ex.remove(); return; } if (ex) return;
    var d = D.createElement('div'); d.className = 'pwa-hint'; d.setAttribute('role', 'note');
    d.innerHTML = '<img src="' + ICON + '" width="28" height="28" alt=""><span>把晨報加到主畫面，每天一點就開</span><button type="button" class="pwa-btn pri sm" data-pwa-install="hint">📲 安裝</button><button type="button" class="pwa-x" data-pwa-hint-x aria-label="不用了，關閉提示">✕</button>';
    D.body.appendChild(d);
  }
  function paint() {
    var on = canShow();
    D.querySelectorAll('[data-pwa-install]').forEach(function (b) { b.hidden = !on; });
    H.classList.toggle('pwa-standalone', standalone());
    hint();
  }
  D.addEventListener('click', function (e) {
    var mo = e.target.closest && e.target.closest('[data-pwa-more]'); if (mo) { e.preventDefault(); var c = $('#afd-cats'); if (c) c.hidden = true; return openMore(mo); }
    var b = e.target.closest && e.target.closest('[data-pwa-install]'); if (b) { e.preventDefault(); return install(b.getAttribute('data-pwa-install')); }
    if (e.target.closest && e.target.closest('[data-pwa-hint-x]')) { s('afd-pwa-hint-x', '1'); hint(); }
  });
  if (window.matchMedia) try { matchMedia('(display-mode: standalone)').addEventListener('change', paint); } catch (e) {}
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', paint); else paint();
  window.__pwa = { install: install, paint: paint, standalone: standalone, INAPP: INAPP, IOS: IOS, MOBILE: MOBILE };
})();
