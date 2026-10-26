/* Mirakee Signal — share (issue / site / page).
   Reads <script type="application/json" id="ms-share">. ONE link per share, with ONE short code param:
     ?r=<ch><camp>[<vid7>]   ch: l=line f=fb m=messenger c=copy n=native · camp: i=issue s=site p=page
                             vid7 = first 7 hex chars of the sharer's anonymous afd-vid, only when tracking is allowed.
   (?s= is NOT used: afd.js treats ?s= as the e-mail token.) LINE links end with &openExternalBrowser=1 (always last).
   Deterministic, no secrets, never adds tokens. Landing decodes r → share_land "medium|campaign|v_<vid7>|" (same 4 fields
   as the old utm_/sv/ss format, which is still accepted for links already shared) and strips it from the address bar.
   Events go through window.afdEv (afd.js): 'share' (open:/channel:<kind>:<src>) and 'share_land'. */
(function () {
  'use strict';
  var D = document, H = D.documentElement, W = window, UA = navigator.userAgent || '';
  var IOS = /iPhone|iPad|iPod/i.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1);
  var AND = /Android/i.test(UA);
  var MOB = IOS || AND || (W.matchMedia && matchMedia('(max-width:760px) and (pointer:coarse)').matches);
  var LS = null, SS = null; try { LS = W.localStorage; } catch (e) {} try { SS = W.sessionStorage; } catch (e) {}
  function g(s, k) { try { return s ? s.getItem(k) : null; } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var Q = [];
  function ev(n, v) { if (W.afdEv) { try { W.afdEv(n, v); } catch (e) {} } else Q.push([n, v]); }
  (function fl(i) { if (!Q.length) { if (i < 40) setTimeout(function () { fl(i + 1); }, 250); return; } if (W.afdEv) { while (Q.length) { var a = Q.shift(); try { W.afdEv(a[0], a[1]); } catch (e) {} } } else if (i < 40) setTimeout(function () { fl(i + 1); }, 250); })(0);
  var DATA = {}; try { DATA = JSON.parse((D.getElementById('ms-share') || {}).textContent || '{}') || {}; } catch (e) { DATA = {}; }

  var CH = { l: 'line', f: 'fb', m: 'messenger', c: 'copy', n: 'native' }, CA = { i: 'issue', s: 'site', p: 'page' };
  /* ---- landing from a shared link: log + clean URL ---- */
  (function () {
    try {
      var u = new URL(location.href), p = u.searchParams, v = '';
      var m = /^([lfmcn])([isp])([0-9a-f]{7})?$/.exec(p.get('r') || '');
      if (m) {
        v = [CH[m[1]], CA[m[2]], m[3] ? 'v_' + m[3] : '', ''].join('|');
        ['r', 'openExternalBrowser'].forEach(function (k) { p.delete(k); });
      } else if (p.get('utm_source') === 'share') {   // links shared before the short code
        var clean = function (x) { return String(x || '').replace(/[^\w.-]/g, '').slice(0, 40); };
        v = [clean(p.get('utm_medium')), clean(p.get('utm_campaign')), clean(p.get('sv')), clean(p.get('ss'))].join('|');
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'sv', 'ss', 'openExternalBrowser'].forEach(function (k) { p.delete(k); });
      } else return;
      history.replaceState(history.state, '', u.pathname + (p.toString() ? '?' + p.toString() : '') + u.hash);
      ev('share_land', v);
    } catch (e) {}
  })();

  function canTrack() { return g(LS, 'afd-notrack') !== '1' && navigator.doNotTrack !== '1' && !navigator.globalPrivacyControl; }
  function code(medium, camp) {
    var c = { line: 'l', fb: 'f', messenger: 'm', copy: 'c', native: 'n' }[medium] || 'c';
    c += { issue: 'i', site: 's', page: 'p' }[camp] || 'p';
    var vid = W.afdVid ? W.afdVid() : (canTrack() ? g(LS, 'afd-vid') : '');
    var h = /^v_([0-9a-f]{7})/i.exec(vid || '');
    return c + (h ? h[1].toLowerCase() : '');
  }
  function tag(url, medium, camp) {
    var u; try { u = new URL(url, location.href); } catch (e) { return url; }
    u.hash = ''; u.search = '';               // canonical page URL only: no sub/utm/token/other params
    var q = '?r=' + code(medium, camp) + (medium === 'line' ? '&openExternalBrowser=1' : '');
    return u.origin + u.pathname + q;
  }
  function firstSentence(t) { t = String(t || '').replace(/\s+/g, ' ').trim(); var m = /^.*?[。！？!?](?=\s|$|[^」』）])/.exec(t); t = m ? m[0] : t; return t.length > 60 ? t.slice(0, 59) + '…' : t; }
  function meta(p) { var m = D.querySelector('meta[property="' + p + '"],meta[name="' + p + '"]'); return m ? m.getAttribute('content') || '' : ''; }
  function item(kind) {
    if (kind === 'page') kind = DATA.issue ? 'issue' : (DATA.kind === 'site' ? 'site' : 'page');
    if (kind === 'issue' && DATA.issue) return { kind: 'issue', d: DATA.issue };
    if (kind === 'site' && DATA.site) return { kind: 'site', d: DATA.site };
    var c = D.querySelector('link[rel=canonical]');
    return { kind: 'page', d: { title: (meta('og:title') || D.title).replace(/｜MS$/, '｜Mirakee Signal'), text: firstSentence(meta('og:description') || meta('description')), url: c ? c.href : location.href.split('#')[0], img: meta('og:image') } };
  }
  /* LINE image card (live 2026-10-26): mobile LINE tile → LIFF app (handler at /share/liff/, mirrored at /preview/share/liff/) which sends a Flex image card via
     shareTargetPicker and falls back to the 3-line text share. Only when <html data-ms-liff> is set. */
  var LIFF = (H.getAttribute('data-ms-liff') || '').replace(/[^\w-]/g, '');
  function liffHref(it) {
    var c = compose(it, 'line'), u = new URL(c.url), root = '/';
    try { root = new URL((DATA.site && DATA.site.url) || '/', location.href).pathname; } catch (e) {}
    var p = u.pathname.indexOf(root) === 0 ? u.pathname.slice(root.length) : '';
    return 'https://liff.line.me/' + LIFF + '?p=' + encodeURIComponent(p) + '&r=' + encodeURIComponent(u.searchParams.get('r') || '');
  }
  function compose(it, medium) {
    var d = it.d, url = tag(d.url, medium, it.kind), text = String(d.text || '').trim();
    return { title: d.title, text: text, url: url, msg: d.title + (text ? '\n' + text : '') + '\n' + url };   // exactly one link
  }
  /* ---- toast ---- */
  var tt;
  function toast(s) { var t = D.querySelector('.ms-toast'); if (!t) { t = D.createElement('div'); t.className = 'ms-toast'; t.setAttribute('role', 'status'); D.body.appendChild(t); } t.textContent = s; t.hidden = false; clearTimeout(tt); tt = setTimeout(function () { t.hidden = true; }, 2600); }
  function copy(s, ok) {
    var done = function () { toast(ok); };
    if (navigator.clipboard && W.isSecureContext) navigator.clipboard.writeText(s).then(done, function () { fallback(); }); else fallback();
    function fallback() { var a = D.createElement('textarea'); a.value = s; a.setAttribute('readonly', ''); a.style.cssText = 'position:fixed;top:0;left:0;opacity:0'; D.body.appendChild(a); a.select(); var r = false; try { r = D.execCommand('copy'); } catch (e) {} a.remove(); if (r) done(); else W.prompt('複製這個連結：', s); }
  }
  /* ---- sheet ---- */
  var IC = {
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
    msg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M12 2C6.5 2 2 6.1 2 11.2c0 2.9 1.4 5.5 3.7 7.2V22l3.4-1.9c.9.3 1.9.4 2.9.4 5.5 0 10-4.1 10-9.2S17.5 2 12 2zm1 12.4-2.6-2.7-5 2.7 5.5-5.8 2.6 2.7 5-2.7-5.5 5.8z"/></svg>'
  };
  var box, last, cur;
  function tile(cls, act, ic, label, href) {
    return href ? '<a class="ms-t ' + cls + '" data-ms-act="' + act + '" href="' + esc(href) + '" target="_blank" rel="noopener"><i>' + ic + '</i><span>' + label + '</span></a>'
                : '<button type="button" class="ms-t ' + cls + '" data-ms-act="' + act + '"><i>' + ic + '</i><span>' + label + '</span></button>';
  }
  function open(kind, src) {
    var it = item(kind); cur = { it: it, src: src || 'other' };
    last = D.activeElement;
    var d = it.d, head = it.kind === 'issue' ? '分享這期' : it.kind === 'site' ? '分享 Mirakee Signal' : '分享這一頁';
    var fbu = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(compose(it, 'fb').url);
    var tiles = MOB
      ? tile('line', 'line', 'LINE', 'LINE', LIFF ? liffHref(it) : 'https://line.me/R/share?text=' + encodeURIComponent(compose(it, 'line').msg))
        + tile('fb', 'fb', 'f', 'Facebook', fbu)
        + tile('msg', 'messenger', IC.msg, 'Messenger', 'fb-messenger://share/?link=' + encodeURIComponent(compose(it, 'messenger').url))
        + tile('copy', 'copy', IC.link, '複製連結')
        + (navigator.share ? tile('native', 'native', IC.share, '更多…') : '')
      : tile('line', 'copy_line', 'LINE', '複製貼到 LINE')
        + tile('lapp', 'line_app', 'APP', 'LINE App', 'line://msg/text/' + encodeURIComponent(compose(it, 'line').msg))
        + tile('fb', 'fb', 'f', 'Facebook', fbu)
        + tile('copy', 'copy', IC.link, '複製連結')
        + (navigator.share ? tile('native', 'native', IC.share, '更多…') : '');
    var note = MOB ? '' : '<p class="ms-note">沒裝 LINE 電腦版？用 <a data-ms-act="line_web" href="https://social-plugins.line.me/lineit/share?url=' + encodeURIComponent(compose(it, 'line').url) + '" target="_blank" rel="noopener">LINE 網頁分享</a></p>';
    if (!box) { box = D.createElement('div'); box.className = 'ms-shs'; box.hidden = true; D.body.appendChild(box);
      box.addEventListener('click', onSheet); D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && box && !box.hidden) close(); }); }
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', head);
    box.innerHTML = '<div class="ms-in"><div class="ms-hd"><b>' + head + '</b><button type="button" class="ms-x" data-ms-close aria-label="關閉">✕</button></div>'
      + '<div class="ms-card">' + (d.img ? '<img src="' + esc(d.img) + '" alt="" loading="lazy" decoding="async">' : '') + '<div><b>' + esc(d.title) + '</b><small>' + esc(String(d.text || '').trim()) + '</small></div></div>'
      + '<div class="ms-grid">' + tiles + '</div>' + note + '</div>';
    box.hidden = false;
    try { box.querySelector('.ms-x').focus({ preventScroll: true }); } catch (e) {}
    ev('share', 'open:' + it.kind + ':' + cur.src);
  }
  function close() { if (box) box.hidden = true; try { last && last.focus && last.focus({ preventScroll: true }); } catch (e) {} }
  function onSheet(e) {
    if (e.target === box || e.target.closest('[data-ms-close]')) { close(); return; }
    var a = e.target.closest('[data-ms-act]'); if (!a || !cur) return;
    var act = a.getAttribute('data-ms-act'), it = cur.it, med = { line: 'line', line_app: 'line', line_web: 'line', copy_line: 'line', fb: 'fb', messenger: 'messenger', copy: 'copy', native: 'native' }[act] || 'copy';
    ev('share', act + ':' + it.kind + ':' + cur.src);
    if (act === 'copy') { e.preventDefault(); copy(compose(it, 'copy').url, '已複製連結'); close(); }
    else if (act === 'copy_line') { e.preventDefault(); copy(compose(it, 'line').msg, '已複製，到 LINE 對話框貼上（Ctrl+V / ⌘V）'); close(); }
    else if (act === 'native') { e.preventDefault(); var c = compose(it, 'native'); try { navigator.share({ title: c.title, text: c.title + (c.text ? '\n' + c.text : ''), url: c.url }).catch(function () {}); } catch (x) {} close(); }
    else { setTimeout(close, 50); }
    void med;
  }
  W.MS_SHARE = { open: open, tag: tag, compose: function (k, m) { return compose(item(k), m); } };
  /* buttons: [data-ms-share="issue|site|page"]; header/legacy [data-afd-share] → current page (capture, before afd.js) */
  D.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-ms-share],[data-afd-share]'); if (!b) return;
    e.preventDefault(); if (!b.hasAttribute('data-ms-share')) e.stopImmediatePropagation();
    var k = b.getAttribute('data-ms-share') || 'page', src = b.getAttribute('data-ms-src') || (b.closest('.afd-nav,.v2-nav') ? 'header' : b.closest('.afd-tabs,.v2-tabs') ? 'tab' : 'other');
    open(k, src);
  }, true);

})();
