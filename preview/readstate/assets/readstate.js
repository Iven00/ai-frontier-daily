/* readstate.js — DESIGN PREVIEW ONLY (/preview/readstate/).
 * Listening progress is READ from afd-listen.js's store ("afd-prog-v1": per-issue listened intervals, same ≥90% rule as the beads).
 * Read marks + view history live in "afd-read-v1" in the same localStorage. It is a separate key on purpose: afd-listen.js rewrites
 * its whole in-memory object on every save, so fields added to "afd-prog-v1" by another script would be overwritten.
 *   { v:1, items:{ "<issue>|<segment id>": readTs }, seen:{ "<issue>": viewTs }, hclr: ts(history cleared), legend: 1 }
 * States per item: 未看 · 聽了一部分 (>5% and <90%) · 已聽 (≥90%) · 已讀 (opened, or ≥5 s in view with text visible).
 */
(function () {
  'use strict';
  var KP = 'afd-prog-v1', KR = 'afd-read-v1', FULL = 0.9, PART = 0.05;
  var $ = function (q, r) { return (r || document).querySelector(q); }, $$ = function (q, r) { return Array.prototype.slice.call((r || document).querySelectorAll(q)); };
  var LDATA = {}, DATA = {}; try { LDATA = JSON.parse(($('#afdl-data') || {}).textContent || '{}'); } catch (e) {}
  // #rs-data = every issue (hrefs relative to the preview root); #afdl-data = what afd-listen.js can play in-page on this page.
  try { DATA = Object.assign({}, LDATA, JSON.parse(($('#rs-data') || {}).textContent || '{}')); } catch (e) { DATA = LDATA; }
  function playCtl(k, lab, cls, aria) { return LDATA[k] ? '<button class="btn ' + cls + ' sm" type="button" data-afdl-play="' + esc(k) + '"' + (aria ? ' aria-label="' + esc(aria) + '"' : '') + '>' + lab + '</button>' : '<a class="btn ' + cls + ' sm" href="' + esc(BASE + DATA[k].href) + '?play=1"' + (aria ? ' aria-label="' + esc(aria) + '"' : '') + '>' + lab + '</a>'; }
  var QS = new URLSearchParams(location.search), BASE = document.documentElement.getAttribute('data-rs-base') || '';
  function jget(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v || d; } catch (e) { return d; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function R() { var r = jget(KR, null); if (!r || r.v !== 1) r = { v: 1, items: {}, seen: {} }; r.items = r.items || {}; r.seen = r.seen || {}; return r; }
  function P() { var p = jget(KP, null); return (p && p.v === 1) ? p : { v: 1, issues: {} }; }
  function cover(iv, a, b) { var c = 0; (iv || []).forEach(function (x) { c += Math.max(0, Math.min(b, x[1]) - Math.max(a, x[0])); }); return c; }
  var NONITEM = /^(intro|outro|next|trend-\d+)$/;
  function items(k) { var D = DATA[k], o = []; if (!D) return o; D.beads.forEach(function (b) { b.segs.forEach(function (s) { if (!NONITEM.test(s[0])) o.push(s); }); }); return o; }
  function fr(p, k, a, b) { var r = p.issues[k]; if (!r) return 0; var f = cover(r.iv, a, b) / Math.max(1, b - a); return f >= FULL ? 1 : f; }
  function itemState(p, r, k, id, a, b) {
    var f = fr(p, k, a, b), read = !!r.items[k + '|' + id];
    if (f >= 1) return { c: 'rs-done', t: '✓ 已聽', f: 1 };
    if (f > PART) return { c: 'rs-part', t: (read ? '已讀・' : '') + '聽到 ' + Math.round(f * 100) + '%', f: f };
    if (read) return { c: 'rs-read', t: '已讀', f: f };
    return { c: '', t: '', f: f };
  }
  function issueProg(p, k) { var L = items(k), n = 0; var segs = L.map(function (s) { var f = fr(p, k, s[1], s[2]); if (f >= 1) n++; return f; }); return { n: n, N: L.length, segs: segs }; }
  function tpe(ts) { try { return new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ts)); } catch (e) { return ''; } }
  function lastViewed(p, r, k) { var a = r.seen[k] || 0, u = p.issues[k] && p.issues[k].upd ? Date.parse(p.issues[k].upd) || 0 : 0; var t = Math.max(a, u); return t > (r.hclr || 0) ? t : 0; }
  function history() { var p = P(), r = R(); return Object.keys(DATA).map(function (k) { return { k: k, t: lastViewed(p, r, k) }; }).filter(function (x) { return x.t; }).sort(function (a, b) { return b.t - a.t; }); }
  function f2(t) { t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 60) + ':' + ('0' + t % 60).slice(-2); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------- issue page: per-item cards ----------
  var AUD = $('audio[data-afdl-key]'), PK = AUD && AUD.getAttribute('data-afdl-key');
  var CARDS = [];
  if (PK) {
    var isSp = PK.charAt(0) === 's';
    if (isSp) { var sp = $('main .isec .blk.art'); if (sp) CARDS.push({ el: sp, id: '*' }); }
    else $$('#items article.blk.art[id]').forEach(function (el) { CARDS.push({ el: el, id: el.id }); });
    CARDS.forEach(function (c) { c.el.classList.add('rs-card'); var ch = document.createElement('span'); ch.className = 'rs-chip'; ch.setAttribute('role', 'status'); c.el.appendChild(ch); var ln = document.createElement('i'); ln.className = 'rs-line'; ln.setAttribute('aria-hidden', 'true'); c.el.appendChild(ln); c.ch = ch; c.ln = ln; });
    var r0 = R(); r0.seen[PK] = Date.now(); jset(KR, r0);
  }
  function rangeOf(k, id) { if (id === '*') { var L = items(k); return L.length ? [L[0][1], L[L.length - 1][2]] : [0, 0]; } var s = items(k).filter(function (x) { return x[0] === id; })[0]; return s ? [s[1], s[2]] : null; }
  function paintItems() {
    if (!CARDS.length) return; var p = P(), r = R();
    CARDS.forEach(function (c) {
      var rg = rangeOf(PK, c.id); if (!rg) return; var st = itemState(p, r, PK, c.id, rg[0], rg[1]);
      c.el.classList.remove('rs-done', 'rs-part', 'rs-read'); if (st.c) c.el.classList.add(st.c);
      if (c.ch.textContent !== st.t) c.ch.textContent = st.t; c.ln.style.setProperty('--p', Math.round(st.f * 100) + '%');
    });
  }
  function markRead(id) { var r = R(), key = PK + '|' + id; if (!r.items[key]) { r.items[key] = Date.now(); jset(KR, r); paintItems(); } }
  if (CARDS.length && 'IntersectionObserver' in window) {
    // 已讀 = ≥5 s continuously in view with its text visible: ≥50% of the card, or the card covering ≥60% of the viewport (long cards).
    var tm = {};
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var id = e.target._rsid, vis = e.isIntersecting && (e.intersectionRatio >= 0.5 || e.intersectionRect.height >= innerHeight * 0.6);
        if (vis && !tm[id] && !document.hidden) tm[id] = setTimeout(function () { markRead(id); }, 5000);
        if (!vis && tm[id]) { clearTimeout(tm[id]); tm[id] = 0; }
      });
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    CARDS.forEach(function (c) { c.el._rsid = c.id; io.observe(c.el); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) Object.keys(tm).forEach(function (k) { clearTimeout(tm[k]); tm[k] = 0; }); });
    document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a'); if (!a) return; var c = a.closest('.rs-card'); if (c && /閱讀全文/.test(a.textContent)) markRead(c._rsid); });
  }
  // first-time legend (inserted at load, before reading starts → no later shift)
  if (CARDS.length && !R().legend) {
    var lg = document.createElement('div'); lg.className = 'rs-legend';
    lg.innerHTML = '<span>標記說明：</span><span class="rs-chip">✓ 已聽</span><span class="rs-chip">聽到 40%</span><span class="rs-chip">已讀</span><span>只存在這台裝置</span><button type="button">知道了</button>';
    var host = isSp ? $('main .isec') : $('#items'); var h2 = !isSp && host && $('h2', host); // special: the h2 sits inside the card, so the legend goes above the card
    if (host) { if (h2) h2.after(lg); else host.prepend(lg); }
    $('button', lg).onclick = function () { var r = R(); r.legend = 1; jset(KR, r); lg.remove(); };
  }

  // ---------- issue cards (home / archive / history) ----------
  function paintIssueCards() {
    var p = P();
    $$('[data-afdl-card]').forEach(function (c) {
      var k = c.getAttribute('data-afdl-card'), ip = issueProg(p, k); if (!ip.N) return;
      var th = $('.ithumb', c); if (!th) return; c.classList.add('rs-ic');
      var ch = $('.rs-ichip', th), sg = $('.rs-iseg', th);
      if (!ch) { ch = document.createElement('span'); ch.className = 'rs-ichip'; th.appendChild(ch); sg = document.createElement('span'); sg.className = 'rs-iseg'; sg.innerHTML = ip.segs.map(function () { return '<i></i>'; }).join(''); th.appendChild(sg); }
      var any = ip.segs.some(function (f) { return f > PART; }), unit = k.charAt(0) === 's' ? ' 段' : '';
      ch.textContent = ip.n === ip.N ? '✓ 整期聽完' : any ? '已聽 ' + ip.n + '/' + ip.N + unit : '';
      ch.hidden = !ch.textContent; sg.hidden = !any;
      // chip is decorative over a thumbnail that is aria-hidden; expose the same text to screen readers on the card title
      c.setAttribute('aria-description', ch.textContent);
      $$('i', sg).forEach(function (el, i) { var f = ip.segs[i]; el.className = f >= 1 ? 'd' : f > PART ? 'p' : ''; el.style.setProperty('--p', Math.round(f * 100) + '%'); });
    });
  }

  // ---------- history page ----------
  var HIST = $('#rs-hist');
  function paintHistory() {
    if (!HIST) return; var h = history(), all = $$('[data-afdl-card]', HIST), p = P();
    all.forEach(function (c) { c.hidden = true; });
    h.forEach(function (x) {
      var c = all.filter(function (el) { return el.getAttribute('data-afdl-card') === x.k; })[0]; if (!c) return;
      c.hidden = false; HIST.appendChild(c); // newest-viewed first
      var m = $('.rs-hmeta', c); if (!m) { m = document.createElement('div'); m.className = 'rs-hmeta'; $('h3', c).after(m); }
      var r = p.issues[x.k], D = DATA[x.k]; m.textContent = '上次觀看 ' + tpe(x.t) + '（台北）' + (r && r.pos > 20 ? '・聽到 ' + f2(r.pos) + '／' + f2(D.dur) : '');
    });
    $('#rs-empty').hidden = h.length > 0; $('#rs-htools').hidden = h.length === 0;
  }
  if (HIST) {
    // 「繼續聽」 = play intent (in-page player resumes at saved pos −15 s via afd-listen); 「看內容」 = plain link, no autoplay.
    $$('[data-afdl-card]', HIST).forEach(function (c) {
      var k = c.getAttribute('data-afdl-card'), bt = $('.bt', c), href = $('h3 a', c).getAttribute('href');
      var pb = $('[data-afdl-play]', bt); if (pb) pb.innerHTML = '<span>▶ 繼續聽</span>';
      var a = document.createElement('a'); a.className = 'btn sm'; a.href = href; a.textContent = '看內容'; bt.appendChild(a);
    });
    $('#rs-clear').onclick = function () { if (!confirm('清除這台裝置上的「歷史觀看」清單？（聆聽進度與已讀標記會保留）')) return; var r = R(); r.hclr = Date.now(); r.seen = {}; jset(KR, r); paintHistory(); };
  }

  // ---------- mobile 收聽 sheet (option A) / option B ----------
  var ALT = QS.get('alt') || sessionStorage.getItem('rs-alt') || 'a'; try { sessionStorage.setItem('rs-alt', ALT); } catch (e) {}
  document.documentElement.setAttribute('data-rs-alt', ALT);
  var tab = $('.v2-tabs [data-rs-tab]'), SH = null;
  function buildSheet() {
    var h = history(), p = P(), keys = Object.keys(DATA), last = h[0] && h[0].k, html = '<h3>🎧 收聽</h3>';
    if (last) { var D = DATA[last], r = p.issues[last], ip = issueProg(p, last);
      html += '<div class="rs-sec"><p class="rs-lbl">繼續收聽</p><div class="rs-row"><div class="rs-t"><a href="' + esc(BASE + D.href) + '">' + esc(D.label) + '</a><small>' + (r && r.pos > 20 ? '聽到 ' + f2(r.pos) + '／' + f2(D.dur) : '尚未開始') + '・已聽 ' + ip.n + '/' + ip.N + '</small></div>' + playCtl(last, '▶ 繼續聽', 'pri') + '</div></div>';
    } else { var today = keys.filter(function (k) { return k.charAt(0) === 'd'; }).sort().pop();
      if (today) html += '<div class="rs-sec"><p class="rs-lbl">還沒有收聽紀錄</p><div class="rs-row"><div class="rs-t"><a href="' + esc(BASE + DATA[today].href) + '">' + esc(DATA[today].label) + '</a><small>今日晨報</small></div>' + playCtl(today, '▶ 播放', 'pri') + '</div></div>'; }
    var rest = h.slice(last ? 1 : 0, (last ? 1 : 0) + 3);
    if (rest.length) { html += '<div class="rs-sec"><p class="rs-lbl">歷史觀看</p>' + rest.map(function (x) { var D = DATA[x.k], ip = issueProg(p, x.k); return '<div class="rs-row"><div class="rs-t"><a href="' + esc(BASE + D.href) + '">' + esc(D.label) + '</a><small>' + (ip.n === ip.N ? '✓ 整期聽完' : '已聽 ' + ip.n + '/' + ip.N) + '・' + tpe(x.t) + '</small></div>' + playCtl(x.k, '▶', '', '繼續聽 ' + D.label) + '</div>'; }).join('') + '</div>'; }
    html += '<div class="rs-links"><a href="' + BASE + 'history/">歷史觀看 →</a><a href="' + BASE + 'archive/">所有期刊 →</a></div>';
    SH.innerHTML = html;
  }
  function closeSheet() { if (SH) SH.hidden = true; if (tab) tab.setAttribute('aria-expanded', 'false'); }
  if (tab && ALT === 'a') {
    var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-rs-tab', ''); b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', 'rs-lsheet'); b.innerHTML = '<span class="i">🎧</span>收聽';
    tab.replaceWith(b); tab = b;
    SH = document.createElement('div'); SH.className = 'rs-sheet'; SH.id = 'rs-lsheet'; SH.hidden = true; SH.setAttribute('role', 'dialog'); SH.setAttribute('aria-label', '收聽'); document.body.appendChild(SH);
    b.addEventListener('click', function (e) { e.stopPropagation(); if (SH.hidden) { buildSheet(); SH.hidden = false; b.setAttribute('aria-expanded', 'true'); var cs = $('#afd-cats'); if (cs) cs.hidden = true; } else closeSheet(); });
    document.addEventListener('click', function (e) { if (SH && !SH.hidden && !SH.contains(e.target)) closeSheet(); if (e.target.closest && e.target.closest('#rs-lsheet [data-afdl-play], #rs-lsheet a')) setTimeout(closeSheet, 50); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
  } else if (tab) { tab.innerHTML = '<span class="i">📚</span>所有期刊'; }

  // ---------- account menu: 清除閱讀紀錄 ----------
  new MutationObserver(function () {
    var inn = $('.afd-acp .in'); if (!inn || $('[data-rs-clr]', inn)) return;
    var bt = document.createElement('button'); bt.type = 'button'; bt.className = 'btn sm'; bt.setAttribute('data-rs-clr', ''); bt.textContent = '清除閱讀紀錄';
    bt.onclick = function () { if (!confirm('清除這台裝置上的閱讀紀錄？\n・已讀標記\n・聆聽進度（已聽／聽到 %、續聽位置）\n歷史觀看清單另有「清除觀看紀錄」。')) return; var r = R(); r.items = {}; jset(KR, r); try { localStorage.removeItem(KP); } catch (e) {} location.reload(); };
    inn.appendChild(bt);
  }).observe(document.body, { childList: true, subtree: true });

  // ---------- preview-only demo data ----------
  var demo = QS.get('demo');
  if (demo === '0') { try { localStorage.removeItem(KP); localStorage.removeItem(KR); } catch (e) {} QS.delete('demo'); location.replace(location.pathname + (QS.toString() ? '?' + QS : '')); return; }
  if (demo === '1') {
    var now = Date.now(), p = { v: 1, issues: {} }, r = { v: 1, items: {}, seen: {} }, iso = function (t) { return new Date(t + 8 * 3600e3).toISOString().replace('Z', '+08:00'); };
    Object.keys(DATA).forEach(function (k) {
      var L = items(k), D = DATA[k]; if (!L.length) return; var iv = [], pos = 0, ago;
      if (k.charAt(0) === 's') { iv = [[0, L[2][2]], [L[3][1], L[3][1] + (L[3][2] - L[3][1]) * 0.4]]; pos = iv[1][1]; ago = 3 * 3600e3; }
      else if (k === Object.keys(DATA).filter(function (x) { return x.charAt(0) === 'd'; }).sort().pop()) { iv = [[0, L[2][2]], [L[3][1], L[3][1] + (L[3][2] - L[3][1]) * 0.4]]; pos = iv[1][1]; r.items[k + '|' + L[4][0]] = now - 600e3; r.items[k + '|' + L[1][0]] = now - 700e3; ago = 20 * 60e3; }
      else { iv = [[0, D.dur]]; pos = D.dur; ago = 26 * 3600e3; }
      p.issues[k] = { pos: pos, dur: D.dur, upd: iso(now - ago), iv: iv, segs: {} }; r.seen[k] = now - ago;
    });
    r.legend = QS.get('legend') === '1' ? 0 : 1; jset(KP, p); jset(KR, r); QS.delete('demo'); QS.delete('legend'); location.replace(location.pathname + (QS.toString() ? '?' + QS : '')); return;
  }

  function paint() { paintItems(); paintIssueCards(); paintHistory(); }
  paint();
  window.addEventListener('storage', paint);
  setInterval(function () { paintItems(); paintIssueCards(); }, 2000); // afd-listen saves progress while playing
})();
