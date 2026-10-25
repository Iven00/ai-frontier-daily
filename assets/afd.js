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

  // ---------- subscribe ----------
  var FULL_MSG = '目前是試營運版，訂閱名額已滿（上限 400 人），暫時無法訂閱。名額增加時，要我們通知你嗎？';
  var gisP = null;
  function loadGIS() {
    if (gisP) return gisP;
    gisP = new Promise(function (ok, no) { var x = document.createElement('script'); x.src = 'https://accounts.google.com/gsi/client'; x.async = true; x.onload = ok; x.onerror = no; document.head.appendChild(x); });
    return gisP;
  }
  function gisButton(el, onCred, text) {
    return loadGIS().then(function () {
      google.accounts.id.initialize({ client_id: C.clientId, callback: function (r) { onCred(r.credential); }, ux_mode: 'popup', auto_select: false, cancel_on_tap_outside: true, use_fedcm_for_button: true });
      el.innerHTML = ''; google.accounts.id.renderButton(el, { type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: text || 'signup_with', locale: 'zh-TW', logo_alignment: 'left' });
    });
  }
  function consentGiven() { s('afd-consent', '1'); }
  function subUI(box) {
    var ui = $('.afd-sub-ui', box); if (!ui || !API) return;
    if (g('afd-subscribed') === '1') { ui.innerHTML = '<div class="msg">✅ 你已經訂閱晨報了，每天早上 6 點（台北時間）見。</div>'; return; }
    ui.innerHTML = '<div class="note">載入中…</div>';
    var seen = false;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { if (!seen && es[0].isIntersecting) { seen = true; ev('subscribe_view'); } }).observe(box);
    function msg(t, html) { var m = $('.msg', ui); if (!m) { m = document.createElement('div'); m.className = 'msg'; m.setAttribute('role', 'status'); ui.appendChild(m); } if (html) m.innerHTML = t; else m.textContent = t; }
    function showFull(cred) {
      ui.innerHTML = '<div>' + FULL_MSG + '</div><div style="margin-top:10px"><button class="btn primary" type="button" data-y>要，通知我</button><button class="btn" type="button" data-n>不用了</button></div><div class="gis2" style="margin-top:10px"></div>';
      $('[data-n]', ui).onclick = function () { ev('waitlist_optout'); post({ action: 'waitlist', optin: false, vid: vid() }).catch(function () {}); ui.innerHTML = '<div class="msg">好的，不會通知你。謝謝你的關注！</div>'; };
      $('[data-y]', ui).onclick = function () {
        function send(c) { msg('處理中…'); consentGiven(); post({ action: 'waitlist', optin: true, credential: c, vid: vid(), consent_version: C.consentVersion, eu: EU ? 1 : 0 })
          .then(function (r) { if (r.ok) { ev('waitlist_optin'); ui.innerHTML = '<div class="msg">✅ 已登記！名額增加時會寄信通知 ' + (r.email || '你') + '。</div>'; } else msg(r.message || '登記失敗，請稍後再試。'); })
          .catch(function () { msg('連線失敗，請稍後再試（若有開啟廣告阻擋外掛，請暫時關閉）。'); }); }
        if (cred) return send(cred);
        $('.gis2', ui).innerHTML = '<div class="note">請用 Google 帳號登入，讓我們知道要通知哪個信箱：</div><div class="gb"></div>';
        gisButton($('.gb', ui), send, 'continue_with').catch(function () { msg('無法載入 Google 登入，請稍後再試。'); });
      };
    }
    function onCred(cred) {
      msg('處理中…'); consentGiven(); ev('subscribe_start');
      post({ action: 'subscribe', credential: cred, vid: vid(), consent_version: C.consentVersion, eu: EU ? 1 : 0, page: PAGE })
        .then(function (r) {
          if (r.ok) { s('afd-subscribed', '1'); ev('subscribe_success'); flush(false); ui.innerHTML = '<div class="msg">✅ 訂閱成功！' + (r.already ? '（你之前就訂閱了）' : '') + '明天早上 6 點（台北時間）起，晨報會寄到 ' + (r.email || '你的信箱') + '。</div>'; }
          else if (r.state === 'full') showFull(cred);
          else msg(r.message || '訂閱失敗，請稍後再試。');
        }).catch(function () { msg('連線失敗，請稍後再試（若有開啟廣告阻擋外掛，請暫時關閉）。'); });
    }
    getStatus().then(function (r) {
      if (r && r.state === 'full') return showFull(null);
      ui.innerHTML = '<div class="gb"></div>' + (EU ? '<div class="note">你所在地區適用歐盟規範：登入訂閱前，本站不記錄你的閱讀行為。</div>' : '');
      return gisButton($('.gb', ui), onCred);
    }).catch(function () { ui.innerHTML = '<div class="note">訂閱服務暫時連不上，請稍後再試。</div>'; });
  }
  $$('[data-afd-sub]').forEach(subUI);

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
