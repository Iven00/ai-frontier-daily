/* AI 前沿情報日刊 site script (assets/afd.js). Source: scripts/afd.js; copied by scripts/site_hub.py.
 * - Does nothing network-related until AFD_CONFIG.api (Apps Script Web App URL) is set.
 * - Tracking: anonymous visitor id (localStorage), batched events. Off for DNT/GPC, after 〔不要追蹤〕,
 *   and for likely-EU visitors until they consent (consent = signing in to subscribe, per the privacy policy).
 * - Subscribe (Google Identity Services, popup/callback ID-token flow), waitlist, feedback, unsubscribe/keep/resub.
 * All times shown to users are Taipei time (UTC+8).
 */
(function () {
  'use strict';
  var C = window.AFD_CONFIG || {}; var API = (C.api || '').trim();
  var LS = (function () { try { localStorage.setItem('afd-t', '1'); localStorage.removeItem('afd-t'); return localStorage; } catch (e) { return null; } })();
  function g(k) { return LS ? LS.getItem(k) : null; } function s(k, v) { if (LS) LS.setItem(k, v); }
  function $(q, r) { return (r || document).querySelector(q); } function $$(q, r) { return Array.prototype.slice.call((r || document).querySelectorAll(q)); }
  function rnd(n) { var a = new Uint8Array(n); (window.crypto || window.msCrypto).getRandomValues(a); return Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function ts8() { var d = new Date(Date.now() + 8 * 3600e3); return d.toISOString().replace('Z', '+08:00'); }
  var qs = new URLSearchParams(location.search);
  var PAGE = location.pathname.replace(/^.*?\/ai-frontier-daily/, '') || '/';
  var IS_MANAGE = !!$('[data-afd-manage]');

  // ---------- privacy / consent ----------
  var EU_LANGS = ['bg', 'cs', 'da', 'de', 'el', 'et', 'fi', 'fr', 'ga', 'hr', 'hu', 'it', 'lt', 'lv', 'mt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv', 'is', 'no', 'nb', 'nn'];
  function isEU() {
    var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    if (/^Europe\//.test(tz) || tz === 'Atlantic/Reykjavik' || tz === 'Atlantic/Canary' || tz === 'Atlantic/Madeira' || tz === 'Atlantic/Azores') return true;
    var L = (navigator.languages || [navigator.language || '']).map(function (x) { return String(x).toLowerCase(); });
    return L.some(function (l) { var p = l.split('-'); return EU_LANGS.indexOf(p[0]) >= 0 || (p[0] === 'en' && /^(ie|mt|gb)$/.test(p[1] || '')); });
  }
  var EU = isEU();
  var DNT = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
  function canTrack() { return !!API && !!LS && !DNT && g('afd-notrack') !== '1' && (!EU || g('afd-consent') === '1'); }

  $$('[data-afd-notrack]').forEach(function (a) {
    function lab() { a.textContent = g('afd-notrack') === '1' ? '已停止追蹤（按此恢復）' : '不要追蹤'; }
    lab(); a.addEventListener('click', function (e) { e.preventDefault(); if (g('afd-notrack') === '1') { s('afd-notrack', '0'); } else { s('afd-notrack', '1'); Q.length = 0; } lab(); });
  });

  // ---------- ids ----------
  function vid() { if (!canTrack()) return ''; var v = g('afd-vid'); if (!v) { v = 'v_' + rnd(8); s('afd-vid', v); } return v; }
  var SID = (function () { try { var x = sessionStorage.getItem('afd-sid'); if (!x) { x = 's_' + rnd(6); sessionStorage.setItem('afd-sid', x); } return x; } catch (e) { return 's_' + rnd(6); } })();
  // email token (?s=) -> remember & strip from URL (not on the unsubscribe page, which needs it)
  var TOKEN = qs.get('s') || '';
  if (TOKEN && !IS_MANAGE) { qs.delete('s'); try { history.replaceState(null, '', location.pathname + (qs.toString() ? '?' + qs : '') + location.hash); } catch (e) {} }

  // ---------- transport ----------
  function post(body) {
    return fetch(API, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); });
  }
  function getStatus() { return fetch(API + (API.indexOf('?') >= 0 ? '&' : '?') + 'action=status', { redirect: 'follow' }).then(function (r) { return r.json(); }); }

  // ---------- events ----------
  var Q = [], CAT = document.body.getAttribute('data-afd-cat') || '', ITEM = document.body.getAttribute('data-afd-item') || '', TOP = document.body.getAttribute('data-afd-topics') || '';
  function aiEngine(ref) { var m = /(chatgpt\.com|chat\.openai\.com|perplexity\.ai|gemini\.google\.com|copilot\.microsoft\.com|bing\.com\/chat|claude\.ai|you\.com|phind\.com|grok\.com)/.exec(ref || ''); return m ? m[1] : ''; }
  function ev(name, val, extra) {
    if (!canTrack()) return;
    var e = { ev: name, val: val == null ? '' : String(val).slice(0, 300), ts: ts8(), page: PAGE, item: ITEM, topic: TOP, cat: CAT };
    if (extra) for (var k in extra) e[k] = extra[k];
    Q.push(e); if (Q.length >= 10) flush(false);
  }
  function flush(beacon) {
    if (!Q.length || !canTrack()) return;
    var body = JSON.stringify({ action: 'events', v: 1, vid: vid(), sid: SID, s: TOKEN || g('afd-s') || '', eu: EU ? 1 : 0, dev: (matchMedia('(max-width:700px)').matches ? 'mobile' : 'desktop'), events: Q.splice(0, 50) });
    try {
      if (beacon && navigator.sendBeacon) { navigator.sendBeacon(API, new Blob([body], { type: 'text/plain;charset=utf-8' })); }
      else fetch(API, { method: 'POST', body: body, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, keepalive: true, mode: 'no-cors' }).catch(function () {});
    } catch (e) {}
  }
  if (API) {
    setInterval(function () { flush(false); }, 20000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { activeOut(); flush(true); } });
    window.addEventListener('pagehide', function () { activeOut(); flush(true); });
  }
  var ref = document.referrer && document.referrer.indexOf(location.host + '/ai-frontier-daily') < 0 ? document.referrer : '';
  var returning = !!g('afd-vid');
  ev('page_view', ref ? ref.split('/')[2] : '', { ref: ref.slice(0, 200), ai: aiEngine(ref), ret: returning ? 1 : 0 });
  if (TOKEN) { s('afd-s', TOKEN); ev('email_click', qs.get('d') || ''); }

  // scroll depth (max only), read_end, active time
  var maxD = 0, sentD = 0;
  window.addEventListener('scroll', function () {
    var h = document.documentElement, p = (h.scrollTop + innerHeight) / Math.max(1, h.scrollHeight);
    var b = p >= .98 ? 100 : p >= .75 ? 75 : p >= .5 ? 50 : p >= .25 ? 25 : 0; if (b > maxD) maxD = b;
  }, { passive: true });
  setInterval(function () { if (maxD > sentD) { Q = Q.filter(function (e) { return e.ev !== 'scroll_depth'; }); sentD = maxD; ev('scroll_depth', maxD); } }, 5000);
  var act = 0, lastAct = Date.now(), tick = Date.now();
  ['mousemove', 'keydown', 'touchstart', 'scroll'].forEach(function (t) { window.addEventListener(t, function () { lastAct = Date.now(); }, { passive: true }); });
  setInterval(function () { var n = Date.now(); if (document.visibilityState === 'visible' && (n - lastAct < 30000 || isPlaying())) act += (n - tick) / 1000; tick = n; }, 1000);
  var actSent = false; function activeOut() { if (!actSent && act > 3) { actSent = true; ev('active_time', Math.round(act)); } }
  var endEl = $('#afd-end');
  if (endEl && 'IntersectionObserver' in window) {
    var words = (document.querySelector('main') || document.body).innerText.length, need = Math.min(240, words / 8 * 0.4); // ~8 CJK chars/sec reading
    var t0 = Date.now(), done = false;
    new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting && !done && (Date.now() - t0) / 1000 >= need) { done = true; ev('read_end', Math.round((Date.now() - t0) / 1000)); } }); }).observe(endEl);
  }
  // audio
  function isPlaying() { return $$('audio').some(function (a) { return !a.paused; }); }
  $$('audio').forEach(function (a) {
    var marks = {}; a.addEventListener('play', function () { ev('audio_play', Math.round(a.currentTime)); });
    a.addEventListener('timeupdate', function () { if (!a.duration) return; var p = a.currentTime / a.duration * 100;[25, 50, 75, 100].forEach(function (m) { if (p >= m - 1 && !marks[m]) { marks[m] = 1; ev('audio_progress', m, { secs: Math.round(a.currentTime) }); } }); });
  });
  // clicks
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a'); if (!a) return;
    if (a.dataset.afdEv) ev(a.dataset.afdEv, a.getAttribute('href'));
    else if (a.host && a.host !== location.host) ev('outbound_click', a.href.slice(0, 200));
  }, true);
  $$('details').forEach(function (d) { d.addEventListener('toggle', function () { if (d.open) ev('item_expand', d.id || (d.closest('[id]') || {}).id || ''); }); });
  if (CAT && !ITEM) ev('topic_view', CAT);

  // ---------- subscribe (one shared state; every [data-afd-sub] box mirrors it) ----------
  var FULL_MSG = '目前是試營運版，訂閱名額已滿（上限 400 人），暫時無法訂閱。名額增加時，要我們通知你嗎？';
  var gisP = null, gisInit = false, credFn = null;
  function loadGIS() {
    if (gisP) return gisP;
    gisP = new Promise(function (ok, no) { var x = document.createElement('script'); x.src = 'https://accounts.google.com/gsi/client'; x.async = true; x.onload = ok; x.onerror = function () { gisP = null; no(); }; document.head.appendChild(x); });
    return gisP;
  }
  function gisButton(el, onCred, text) {
    credFn = onCred;
    return loadGIS().then(function () {
      if (!gisInit) { gisInit = true; google.accounts.id.initialize({ client_id: C.clientId, callback: function (r) { if (credFn) credFn(r.credential); }, ux_mode: 'popup', auto_select: false, cancel_on_tap_outside: true, use_fedcm_for_button: true }); }
      var w = Math.max(200, Math.min(320, Math.floor((el.parentNode && el.parentNode.clientWidth) || 280)));
      el.innerHTML = ''; google.accounts.id.renderButton(el, { type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: text || 'signup_with', locale: 'zh-TW', logo_alignment: 'left', width: w });
    });
  }
  function consentGiven() { s('afd-consent', '1'); }
  var SUB = { st: g('afd-subscribed') === '1' ? 'done' : 'loading', html: '', wcred: null };
  var BOXES = $$('[data-afd-sub]');
  function visible(box) { return !box.hasAttribute('data-afd-lazy') || box.closest('dialog[open]'); }
  function paint(box) {
    var ui = $('.afd-sub-ui', box); if (!ui || !API) return;
    var strip = box.hasAttribute('data-afd-strip');
    if (strip) box.classList.toggle('afd-done', SUB.st === 'done' && g('afd-subscribed') === '1' && !box._justDone);
    if (!visible(box)) { box._dirty = true; return; } box._dirty = false;
    if (SUB.st === 'done' && !SUB.html) { ui.innerHTML = '<div class="msg">✅ 你已經訂閱晨報了，每天早上 6 點（台北時間）見。</div>'; return; }
    if (SUB.html) { ui.innerHTML = SUB.html; return; }
    if (SUB.st === 'loading') { ui.innerHTML = '<div class="note">載入 Google 訂閱按鈕…</div>'; return; }
    if (SUB.st === 'error') { ui.innerHTML = '<div class="note">訂閱服務暫時連不上，請稍後再試。</div>'; return; }
    if (SUB.st === 'ready') {
      ui.innerHTML = '<div class="gb"></div>' + (EU && !strip ? '<div class="note">你所在地區適用歐盟規範：登入訂閱前，本站不記錄你的閱讀行為。</div>' : '') + '<div class="msg" role="status"></div>';
      gisButton($('.gb', ui), onCred).catch(function () { ui.innerHTML = '<div class="note">無法載入 Google 登入，請稍後再試（若有開啟廣告阻擋外掛，請暫時關閉）。</div>'; });
      return;
    }
    if (SUB.st === 'full') {
      ui.innerHTML = '<div>' + FULL_MSG + '</div><div style="margin-top:10px"><button class="btn primary" type="button" data-y>要，通知我</button><button class="btn" type="button" data-n>不用了</button></div><div class="gis2" style="margin-top:10px"></div><div class="msg" role="status"></div>';
      $('[data-n]', ui).onclick = function () { ev('waitlist_optout'); post({ action: 'waitlist', optin: false, vid: vid() }).catch(function () {}); setHTML('<div class="msg">好的，不會通知你。謝謝你的關注！</div>'); };
      $('[data-y]', ui).onclick = function () {
        if (SUB.wcred) return sendWait(SUB.wcred);
        $('.gis2', ui).innerHTML = '<div class="note">請用 Google 帳號登入，讓我們知道要通知哪個信箱：</div><div class="gb"></div>';
        gisButton($('.gb', ui), sendWait, 'continue_with').catch(function () { msgAll('無法載入 Google 登入，請稍後再試。'); });
      };
    }
  }
  function paintAll() { BOXES.forEach(paint); }
  function setHTML(h) { SUB.html = h; paintAll(); }
  function msgAll(t) { BOXES.forEach(function (box) { var m = $('.afd-sub-ui .msg', box); if (m) m.textContent = t; }); }
  function sendWait(c) {
    msgAll('處理中…'); consentGiven();
    post({ action: 'waitlist', optin: true, credential: c, vid: vid(), consent_version: C.consentVersion, eu: EU ? 1 : 0 })
      .then(function (r) { if (r.ok) { ev('waitlist_optin'); setHTML('<div class="msg">✅ 已登記！名額增加時會寄信通知 ' + (r.email || '你') + '。</div>'); } else msgAll(r.message || '登記失敗，請稍後再試。'); })
      .catch(function () { msgAll('連線失敗，請稍後再試（若有開啟廣告阻擋外掛，請暫時關閉）。'); });
  }
  function onCred(cred) {
    msgAll('處理中…'); consentGiven(); ev('subscribe_start');
    post({ action: 'subscribe', credential: cred, vid: vid(), consent_version: C.consentVersion, eu: EU ? 1 : 0, page: PAGE })
      .then(function (r) {
        if (r.ok) { s('afd-subscribed', '1'); ev('subscribe_success'); flush(false); BOXES.forEach(function (x) { x._justDone = true; }); SUB.st = 'done';
          setHTML('<div class="msg">✅ 訂閱成功！' + (r.already ? '（你之前就訂閱了）' : '') + '明天早上 6 點（台北時間）起，晨報會寄到 ' + (r.email || '你的信箱') + '。</div>'); }
        else if (r.state === 'full') { SUB.st = 'full'; SUB.wcred = cred; paintAll(); }
        else msgAll(r.message || '訂閱失敗，請稍後再試。');
      }).catch(function () { msgAll('連線失敗，請稍後再試（若有開啟廣告阻擋外掛，請暫時關閉）。'); });
  }
  if (API && BOXES.length) {
    BOXES.forEach(function (box) {
      var seen = false;
      if ('IntersectionObserver' in window && !box.hasAttribute('data-afd-lazy')) new IntersectionObserver(function (es) { if (!seen && es[0].isIntersecting) { seen = true; ev('subscribe_view', box.hasAttribute('data-afd-strip') ? 'strip' : 'box'); } }).observe(box);
    });
    paintAll();
    if (SUB.st !== 'done') getStatus().then(function (r) { SUB.st = (r && r.state === 'full') ? 'full' : 'ready'; paintAll(); })
      .catch(function () { SUB.st = 'error'; paintAll(); });
  }

  // ---------- shared shell: subscribe dialog, category sheet, listen tab, sidebar TOC, ?play= ----------
  var DLG = $('#afd-subdlg');
  function openSub(src) {
    ev('subscribe_open', src || '');
    if (DLG && DLG.showModal) { if (!DLG.open) DLG.showModal(); var bx = $('[data-afd-sub]', DLG); if (bx && (bx._dirty || !$('.afd-sub-ui', bx).children.length || /載入中/.test($('.afd-sub-ui', bx).textContent))) paint(bx); }
    else { var t = $('#subscribe') || $('[data-afd-sub]'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }
  document.addEventListener('click', function (e) {
    var o = e.target.closest && e.target.closest('[data-afd-open-sub]');
    if (o) { e.preventDefault(); openSub(o.getAttribute('data-afd-open-sub')); return; }
    if (e.target.closest && e.target.closest('[data-afd-close]') && DLG) { DLG.close(); return; }
    if (DLG && e.target === DLG) { DLG.close(); return; } // backdrop click
    var sh = $('#afd-cats'), cb = e.target.closest && e.target.closest('[data-afd-cats]');
    if (sh) { if (cb) { sh.hidden = !sh.hidden; cb.setAttribute('aria-expanded', String(!sh.hidden)); return; } if (!sh.hidden && !e.target.closest('#afd-cats')) { sh.hidden = true; } }
  });
  // listen: on pages with the follow-along player toggle it; on item pages play the clip; elsewhere open today's issue
  var AUD = $('#aud'), PP = $('#pp');
  function listenUI() {
    $$('[data-afd-listen]').forEach(function (b) {
      var t = $('.t', b), playing = AUD && !AUD.paused;
      if (t) t.textContent = playing ? '暫停' : '收聽'; else if (AUD) b.textContent = playing ? '❚❚ 暫停播放' : '▶ 播放整期（自動跟讀）';
      var i = $('.i', b); if (i) i.textContent = playing ? '⏸' : '🎧';
    });
  }
  if (AUD) { AUD.addEventListener('play', listenUI); AUD.addEventListener('pause', listenUI); }
  $$('[data-afd-listen]').forEach(function (b) {
    b.addEventListener('click', function () {
      ev('listen_tap', PAGE);
      if (PP && AUD) { PP.click(); return; }
      var clip = $('main audio'); if (clip) { clip.paused ? clip.play() : clip.pause(); clip.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      var ip = $('[data-afd-play][data-src]'); if (ip) { ip.click(); return; }
      var h = b.getAttribute('data-href'); if (h) location.href = h;
    });
  });
  var clipA = !AUD && $('main audio');
  if (clipA) { var upd = function () { $$('[data-afd-listen] .t').forEach(function (t) { t.textContent = clipA.paused ? '收聽' : '暫停'; }); }; clipA.addEventListener('play', upd); clipA.addEventListener('pause', upd); }
  // sidebar TOC (desktop)
  var tocBox = $('[data-afd-toc]'), toc = $('ol.toc');
  if (tocBox && toc) { var cl = toc.cloneNode(true); cl.className = ''; tocBox.appendChild(cl); tocBox.hidden = false; }
  // toast helper
  function toast(html, key) {
    if (key && sessionStorage.getItem(key)) return null;
    var d = document.createElement('div'); d.className = 'afd-toast'; d.setAttribute('role', 'status');
    d.innerHTML = html + '<button class="x" type="button" aria-label="關閉">✕</button>'; document.body.appendChild(d);
    $('.x', d).onclick = function () { d.remove(); }; if (key) try { sessionStorage.setItem(key, '1'); } catch (e) {}
    return d;
  }
  // ---------- listening: progress (resume), play-intent in place, ?play= with one-tap fallback ----------
  // Rule: a PLAY-intent click must start audio with no extra tap; READ links never autoplay.
  // Progress lives in localStorage 'afd-prog-v1' {v:1, issues:{'d:YYYY-MM-DD'|'s:YYYY-MM-DD':{pos,dur,upd,iv:[[s,e]]}}}
  // (same model as the batch-1 preview; ready for later sync). Resume = saved position − 15 s.
  var PK = 'afd-prog-v1';
  function prog() { try { var o = JSON.parse(g(PK) || 'null'); if (o && o.issues) return o; } catch (e) {} return { v: 1, issues: {} }; }
  function progRec(k) { return prog().issues[k] || null; }
  function progSave(k, a) {
    if (!LS || !k || !a._afdPlayed || !a.duration || !isFinite(a.duration)) return; // never overwrite progress for audio that was not played
    var o = prog(), r = o.issues[k] || (o.issues[k] = { pos: 0, dur: 0, upd: '', iv: [] });
    r.pos = Math.round(a.currentTime * 10) / 10; r.dur = Math.round(a.duration * 10) / 10; r.upd = ts8(); r.iv = r.iv || [];
    if (a._ivS != null && a.currentTime > a._ivS) {
      var iv = r.iv.concat([[Math.round(a._ivS * 10) / 10, r.pos]]).sort(function (x, y) { return x[0] - y[0]; }), m = [];
      iv.forEach(function (x) { var l = m[m.length - 1]; if (l && x[0] <= l[1] + 1) l[1] = Math.max(l[1], x[1]); else m.push([x[0], x[1]]); });
      r.iv = m; a._ivS = a.currentTime;
    }
    try { s(PK, JSON.stringify(o)); } catch (e) {}
  }
  function resumeAt(k) { var r = progRec(k); if (!r || !r.pos || !r.dur || r.pos < 20 || r.pos > r.dur - 20) return null; return Math.max(0, r.pos - 15); }
  function mmss(t) { t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 60) + ':' + ('0' + t % 60).slice(-2); }
  function track(a, k) {
    if (a._afdTrack) return; a._afdTrack = 1; var last = 0, K = typeof k === 'function' ? k : function () { return k; };
    a.addEventListener('playing', function () { a._afdPlayed = true; a._ivS = a.currentTime; });
    a.addEventListener('seeking', function () { progSave(K(), a); a._ivS = null; });
    a.addEventListener('seeked', function () { if (!a.paused) a._ivS = a.currentTime; });
    a.addEventListener('timeupdate', function () { var n = Date.now(); if (n - last > 5000) { last = n; progSave(K(), a); } });
    a.addEventListener('pause', function () { progSave(K(), a); a._ivS = null; });
    window.addEventListener('pagehide', function () { progSave(K(), a); });
  }
  (function css() {
    var st = document.createElement('style');
    st.textContent = '.afd-mini{position:fixed;left:50%;transform:translateX(-50%);bottom:16px;z-index:55;width:min(720px,calc(100vw - 20px));box-sizing:border-box;background:var(--card,#fff);color:var(--fg,#222);border:1px solid var(--line,#ddd);border-radius:16px;box-shadow:0 10px 30px #0003;padding:10px 12px;display:flex;align-items:center;gap:10px}'
      + '.afd-mini[hidden]{display:none}.afd-mini .pp{flex:none;width:44px;height:44px;border-radius:999px;border:0;background:var(--accent,#b5532a);color:#fff;font-size:1.05rem;cursor:pointer}'
      + '.afd-mini .m{flex:1;min-width:0}.afd-mini .t{font-weight:700;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '.afd-mini .r{display:flex;align-items:center;gap:8px;font-size:.75rem;color:var(--muted,#777)}.afd-mini input{flex:1;min-width:0;accent-color:var(--accent,#b5532a);margin:0}'
      + '.afd-mini a{flex:none;font-size:.8rem;font-weight:700;color:var(--accent,#b5532a);white-space:nowrap}.afd-mini .x{flex:none;border:0;background:transparent;color:inherit;font-size:1rem;padding:4px 6px;cursor:pointer}'
      + '.afd-tap{position:fixed;top:0;left:0;right:0;z-index:70;display:flex;justify-content:center;padding:12px;background:#000a}.afd-tap button{font:inherit;font-size:1.15rem;font-weight:800;border:0;border-radius:999px;padding:16px 28px;background:var(--accent,#b5532a);color:#fff;box-shadow:0 8px 24px #0005;cursor:pointer;max-width:100%}'
      + '.afd-tap small{display:block;font-size:.78rem;font-weight:400;opacity:.9;margin-top:2px}'
      + 'body.afd-has-mini{padding-bottom:96px}'
      + '@media (max-width:760px){.afd-mini{bottom:calc(var(--tabh,58px) + var(--sab,0px) + 8px)}.afd-mini a{display:none}body.afd-has-mini{padding-bottom:calc(var(--tabh,58px) + var(--sab,0px) + 96px)}}';
    document.head.appendChild(st);
  })();
  // big one-tap fallback when the browser blocks autoplay after navigation
  function tapToPlay(a, sub) {
    var o = document.createElement('div'); o.className = 'afd-tap'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', '開始播放');
    o.innerHTML = '<button type="button">▶ 點一下開始播放<small></small></button>'; $('small', o).textContent = sub || '瀏覽器需要你點一下才能播放聲音';
    document.body.appendChild(o);
    $('button', o).onclick = function () { a.play(); o.remove(); };
    o.addEventListener('click', function (e) { if (e.target === o) o.remove(); });
    a.addEventListener('play', function () { o.remove(); }, { once: true });
    ev('autoplay_blocked', PAGE);
  }
  function tryPlay(a, sub) { var p = a.play(); if (p && p.catch) p.catch(function () { tapToPlay(a, sub); }); }
  // issue / special page: key from the URL, track progress on the main player
  var PKEY = (function () { var m = /\/(daily|special)\/(\d{4}-\d{2}-\d{2})\/?$/.exec(location.pathname); return m ? (m[1] === 'daily' ? 'd:' : 's:') + m[2] : ''; })();
  if (AUD && PKEY) track(AUD, PKEY);
  // ?play=1 (resume or start) / ?play=<segment id> (start at that segment) / &t=<sec> (continue from the homepage mini player)
  var PLAY = qs.get('play'), T0 = parseFloat(qs.get('t'));
  if (PLAY && AUD) {
    var TLx = []; try { TLx = JSON.parse(($('#timeline') || {}).textContent || '[]'); } catch (e) {}
    var seg = TLx.filter(function (x) { return x.id === PLAY; })[0];
    qs.delete('play'); qs.delete('t');
    try { history.replaceState(null, '', location.pathname + (qs.toString() ? '?' + qs : '') + location.hash); } catch (e) {}
    var at = seg ? seg.start + 0.01 : (isFinite(T0) && T0 > 0 ? T0 : (PKEY ? resumeAt(PKEY) : null));
    var go = function () {
      if (at != null) AUD.currentTime = at;
      tryPlay(AUD, seg ? '從「' + seg.label.replace(/^第\d+則｜/, '').slice(0, 18) + '」開始' : (at ? '從 ' + mmss(at) + ' 繼續聽' : '從頭開始聽整期'));
    };
    if (AUD.readyState >= 1) go(); else AUD.addEventListener('loadedmetadata', go, { once: true });
    ev('play_intent_nav', PLAY);
  } else if (AUD && PKEY) {
    // read-intent visit: never autoplay; the first ▶ press resumes at saved−15 s
    var r0 = resumeAt(PKEY);
    if (r0 != null) AUD.addEventListener('play', function f() {
      AUD.removeEventListener('play', f); if (AUD.currentTime < 1) { AUD.currentTime = r0; var t = toast('<span>從 ' + mmss(r0) + ' 繼續聽</span><button type="button" data-z>從頭聽</button>'); if (t) { $('[data-z]', t).onclick = function () { AUD.currentTime = 0; t.remove(); }; setTimeout(function () { t.remove(); }, 8000); } }
    });
  }
  // play in place: [data-afd-play=key][data-src][data-page][data-label] → sticky mini player on this page
  var MINI = null, MA = null, MK = '';
  function mini() {
    if (MINI) return MINI;
    MINI = document.createElement('div'); MINI.className = 'afd-mini'; MINI.hidden = true; MINI.setAttribute('role', 'region'); MINI.setAttribute('aria-label', '播放器');
    MINI.innerHTML = '<button class="pp" type="button" aria-label="暫停">❚❚</button><div class="m"><div class="t"></div><div class="r"><span class="c">0:00</span><input type="range" min="0" max="100" step="0.1" value="0" aria-label="播放進度"><span class="d"></span></div></div><a href="#">邊聽邊看 →</a><button class="x" type="button" aria-label="關閉播放器">✕</button>';
    MA = document.createElement('audio'); MA.preload = 'metadata'; MINI.appendChild(MA); document.body.appendChild(MINI);
    var pp = $('.pp', MINI), rg = $('input', MINI), lk = $('a', MINI);
    function ui() {
      var p = MA.paused; pp.textContent = p ? '▶' : '❚❚'; pp.setAttribute('aria-label', p ? '播放' : '暫停');
      $$('[data-afd-play="' + MK + '"]').forEach(function (b) { b.setAttribute('aria-pressed', String(!p)); if (!b._lab) b._lab = b.textContent; b.textContent = p ? (MA.currentTime > 1 ? '▶ 繼續播放（' + mmss(MA.currentTime) + '）' : b._lab) : '❚❚ 暫停播放'; });
    }
    MA.addEventListener('play', ui); MA.addEventListener('pause', ui);
    MA.addEventListener('timeupdate', function () { if (MA.duration) { rg.value = MA.currentTime / MA.duration * 100; $('.c', MINI).textContent = mmss(MA.currentTime); $('.d', MINI).textContent = mmss(MA.duration); } });
    rg.addEventListener('input', function () { if (MA.duration) MA.currentTime = rg.value / 100 * MA.duration; });
    pp.onclick = function () { MA.paused ? MA.play() : MA.pause(); };
    $('.x', MINI).onclick = function () { MA.pause(); MINI.hidden = true; document.body.classList.remove('afd-has-mini'); };
    lk.addEventListener('click', function () { progSave(MK, MA); lk.href = MINI._page + '?play=1&t=' + Math.floor(MA.currentTime); ev('mini_to_page', MK); });
    return MINI;
  }
  function playInPlace(b) {
    var k = b.getAttribute('data-afd-play'), src = b.getAttribute('data-src'); if (!k || !src) return false;
    mini();
    if (MK === k) { MA.paused ? MA.play() : MA.pause(); return true; }
    if (MK) progSave(MK, MA);
    MK = k; MA._afdPlayed = false; MA.src = src; MINI._page = b.getAttribute('data-page') || ''; $('.t', MINI).textContent = '正在播放：' + (b.getAttribute('data-label') || '');
    track(MA, function () { return MK; }); MINI.hidden = false; document.body.classList.add('afd-has-mini');
    var r = resumeAt(k);
    if (r != null) { var seek = function () { MA.currentTime = r; }; if (MA.readyState >= 1) seek(); else MA.addEventListener('loadedmetadata', seek, { once: true }); }
    var p = MA.play(); // inside the click gesture → allowed
    if (p && p.catch) p.catch(function () { location.href = b.href; }); // last resort: issue page handles ?play=1
    if (r != null) toast('<span>從 ' + mmss(r) + ' 繼續聽</span>');
    ev('play_in_place', k); return true;
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('a[data-afd-play],button[data-afd-play]');
    if (!b || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    if (playInPlace(b)) e.preventDefault();
  });
  // restore the play label with the resume time
  $$('[data-afd-play]').forEach(function (b) { var r = resumeAt(b.getAttribute('data-afd-play')); if (r != null) { b._lab = b.textContent; b.textContent = '▶ 從 ' + mmss(r) + ' 繼續聽'; } });
  // after most of the episode: gentle subscribe nudge (once per session, never for subscribers)
  if (AUD && API) AUD.addEventListener('timeupdate', function () {
    if (AUD._nudged || !AUD.duration || g('afd-subscribed') === '1' || AUD.currentTime / AUD.duration < 0.9) return; AUD._nudged = true;
    var t = toast('<span>聽完了？明早 6 點把下一期寄給你</span><button type="button" data-afd-open-sub="nudge">📬 訂閱</button>', 'afd-nudge'); if (t) ev('subscribe_nudge');
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var sh = $('#afd-cats'); if (sh) sh.hidden = true; } });

  // ---------- feedback ----------
  var fb = $('[data-afd-feedback]');
  if (fb) fb.addEventListener('submit', function (e) {
    e.preventDefault(); var out = $('#fb-msg-out');
    var m = fb.message.value.trim(); if (!m) { out.textContent = '請先填寫內容。'; return; }
    if (!API) { out.innerHTML = '留言功能即將開放；目前請寄信到 <a href="mailto:' + 'rooteric' + '@' + 'gmail.com">rooteric' + '@' + 'gmail.com</a>。'; return; }
    var last = +(g('afd-fb-last') || 0); if (Date.now() - last < 60000) { out.textContent = '送出太頻繁了，請一分鐘後再試。'; return; }
    out.textContent = '送出中…';
    post({ action: 'feedback', vid: vid(), category: fb.category.value, message: m.slice(0, 3000), reply_email: fb.reply_email.value.trim().slice(0, 200), website: fb.website.value })
      .then(function (r) { if (r.ok) { s('afd-fb-last', String(Date.now())); ev('feedback_sent', fb.category.value); fb.reset(); out.textContent = '✅ 已送出，謝謝你的建議！'; } else out.textContent = r.message || '送出失敗，請稍後再試。'; })
      .catch(function () { out.textContent = '連線失敗，請稍後再試。'; });
  });

  // ---------- unsubscribe / keep / resubscribe ----------
  if (IS_MANAGE) {
    var uact = qs.get('a') || 'unsub', tok = qs.get('s') || '', A = $('#u-actions'), O = $('#u-out'), T = $('#u-title'), Bd = $('#u-body');
    var TXT = {
      unsub: ['取消訂閱', '不想再收到晨報了嗎？點下方按鈕就能取消訂閱，不需要登入，也不用填任何理由。日後想再收，隨時回到網站重新訂閱就可以。', '確認取消訂閱'],
      keep: ['繼續訂閱', '謝謝你還想收到晨報！點下方按鈕，我們就會繼續每天寄給你。', '繼續訂閱'],
      resub: ['重新訂閱', '歡迎回來！點下方按鈕重新訂閱；名額足夠時會立刻恢復，名額已滿時會先幫你登記，有名額再通知你。', '重新訂閱']
    }[uact];
    if (tok && TXT && API) {
      T.textContent = TXT[0]; Bd.innerHTML = '<p>' + TXT[1] + '</p>';
      A.innerHTML = '<button class="btn primary" type="button">' + TXT[2] + '</button>' + (uact === 'unsub' ? '<a class="btn" href="../">我再想想，回首頁</a>' : '');
      $('button', A).onclick = function () {
        O.textContent = '處理中…'; this.disabled = true;
        post({ action: uact, token: tok, vid: vid() }).then(function (r) {
          A.innerHTML = '';
          if (!r.ok) { O.textContent = r.message || '處理失敗，請稍後再試，或寄信到 rooteric@gmail.com。'; return; }
          if (uact === 'unsub') { s('afd-subscribed', '0'); O.innerHTML = '已取消訂閱，之後不會再寄晨報給你。想再收時，<a href="?a=resub&s=' + encodeURIComponent(tok) + '">點這裡重新訂閱</a>。'; }
          else if (uact === 'keep') O.textContent = '✅ 已確認，晨報會繼續寄給你。';
          else O.textContent = r.state === 'waitlist' ? '目前名額已滿，已幫你登記；名額增加時會寄信通知你。' : '✅ 已重新訂閱，明天早上 6 點（台北時間）起恢復寄送。';
        }).catch(function () { O.textContent = '連線失敗，請稍後再試。'; A.querySelector('button') && (A.querySelector('button').disabled = false); });
      };
    } else if (tok && !API) { O.textContent = '這項功能即將開放；目前請寄信到 rooteric@gmail.com 處理。'; }
  }
})();
