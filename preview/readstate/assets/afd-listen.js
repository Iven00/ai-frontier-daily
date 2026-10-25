/* afd-listen.js — Batch 1 preview: listening progress beads + resume + in-page mini player.
 * Data model (localStorage key "afd-prog-v1"), designed for Batch 2 sync to Apps Script (keyed by issue + segment id):
 *   { v:1, issues: { "d:2026-10-24": { pos: sec, dur: sec, upd: ISO(+08:00), iv: [[s,e],...] (merged listened ranges, sec),
 *                                       segs: { "<timeline segment id>": listenedSec } } } }
 * Bead = group of consecutive timeline segments (see scripts/v2/listen_data.py). Full when >=90% listened.
 * Page data: <script id="afdl-data" type="application/json">{ "<key>": {label, href, src, dur, beads:[{t,s,e,sub,segs:[[id,s,e]]}]} }</script>
 * Hooks: [data-afdl-play=key] play/resume button, [data-afdl-beads=key] bead row, [data-afdl-toc=key] section list,
 *        [data-afdl-label=key] text replaced with resume label, [data-afdl-restart=key] 從頭聽.
 * On issue pages an existing <audio id="aud"> with data-afdl-key is used instead of the mini player.
 */
(function () {
  'use strict';
  var KEY = 'afd-prog-v1', FULL = 0.9;
  var $ = function (q, r) { return (r || document).querySelector(q); }, $$ = function (q, r) { return Array.prototype.slice.call((r || document).querySelectorAll(q)); };
  var DATA = {}; try { DATA = JSON.parse(($('#afdl-data') || {}).textContent || '{}'); } catch (e) {}
  var ST; try { ST = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {} if (!ST || ST.v !== 1) ST = { v: 1, issues: {} };
  function save() { try { localStorage.setItem(KEY, JSON.stringify(ST)); } catch (e) {} }
  function rec(k) { return ST.issues[k] || (ST.issues[k] = { pos: 0, dur: 0, upd: '', iv: [], segs: {} }); }
  function ts8() { return new Date(Date.now() + 8 * 3600e3).toISOString().replace('Z', '+08:00'); }
  function f(t) { t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 60) + ':' + ('0' + t % 60).slice(-2); }
  function addIv(iv, a, b) { if (b <= a) return iv; iv.push([a, b]); iv.sort(function (x, y) { return x[0] - y[0]; }); var o = []; iv.forEach(function (x) { var l = o[o.length - 1]; if (l && x[0] <= l[1] + 0.6) l[1] = Math.max(l[1], x[1]); else o.push([x[0], x[1]]); }); return o; }
  function cover(iv, a, b) { var c = 0; (iv || []).forEach(function (x) { c += Math.max(0, Math.min(b, x[1]) - Math.max(a, x[0])); }); return c; }
  function beadFrac(k, bd) { var r = ST.issues[k]; if (!r) return 0; var p = cover(r.iv, bd.s, bd.e) / Math.max(1, bd.e - bd.s); return p >= FULL ? 1 : p; }
  function beadAt(k, t) { var D = DATA[k]; if (!D) return -1; for (var i = D.beads.length - 1; i >= 0; i--) if (t >= D.beads[i].s - 0.05) return i; return 0; }
  function resumeAt(k) { var r = ST.issues[k], D = DATA[k]; if (!r || !r.pos) return null; var dur = (D && D.dur) || r.dur || 0; if (r.pos < 20 || (dur && r.pos > dur - 10)) return null; return Math.max(0, r.pos - 15); }
  function started(k) { var r = ST.issues[k]; return !!r && ((r.pos || 0) > 0 || (r.iv && r.iv.length > 0)); }
  function allDone(k) { var D = DATA[k]; return !!D && D.beads.every(function (b) { return beadFrac(k, b) >= 1; }); }

  // ---------- render ----------
  function paintBeads() {
    $$('[data-afdl-beads]').forEach(function (el) {
      var k = el.getAttribute('data-afdl-beads'), D = DATA[k]; if (!D) return;
      if (!el._built) { el._built = 1; el.innerHTML = D.beads.map(function (b, i) { return '<i class="bd" title="第 ' + (i + 1) + ' 區：' + b.t + '"></i>'; }).join(''); el.setAttribute('role', 'img'); }
      var full = 0, cur = (P.k === k && P.a && !P.a.paused) ? beadAt(k, P.a.currentTime) : -1;
      $$('.bd', el).forEach(function (x, i) { var p = beadFrac(k, D.beads[i]); if (p >= 1) full++; x.style.setProperty('--p', Math.round(p * 100) + '%'); x.classList.toggle('full', p >= 1); x.classList.toggle('now', i === cur); });
      el.setAttribute('aria-label', '收聽進度：' + D.beads.length + ' 區中聽完 ' + full + ' 區');
    });
    $$('[data-afdl-toc]').forEach(function (el) {
      var k = el.getAttribute('data-afdl-toc'), D = DATA[k]; if (!D) return;
      if (!el._built) { el._built = 1; el.innerHTML = D.beads.map(function (b, i) { return '<li><button type="button" data-afdl-jump="' + k + '" data-i="' + i + '"><span class="no">' + (i + 1) + '</span><span class="tt"><b>' + b.t + '</b><small>' + b.sub.slice(0, 4).join('・') + '</small></span><span class="ln">' + f(b.e - b.s) + '</span><span class="ck" aria-hidden="true"></span></button></li>'; }).join(''); }
      var cur = (P.k === k && P.a) ? beadAt(k, P.a.currentTime) : -1;
      $$('li', el).forEach(function (li, i) { var p = beadFrac(k, D.beads[i]); li.className = (p >= 1 ? 'done' : p > 0 ? 'part' : '') + (i === cur && P.a && (P.a.currentTime > 0) ? ' now' : ''); });
    });
    $$('[data-afdl-play]').forEach(function (b) {
      var k = b.getAttribute('data-afdl-play'), lab = $('[data-afdl-label]', b) || b, r = resumeAt(k), playing = P.k === k && P.a && !P.a.paused;
      if (!b._orig) b._orig = lab.textContent;
      lab.textContent = playing ? '❚❚ 暫停' : (P.k === k && P.a && P.a.currentTime > 1) ? '▶ 繼續播放' : r != null ? '▶ 從 ' + f(r) + ' 繼續聽' : allDone(k) ? '▶ 再聽一次' : b._orig;
      b.classList.toggle('playing', playing);
    });
    $$('[data-afdl-restart]').forEach(function (b) { b.hidden = resumeAt(b.getAttribute('data-afdl-restart')) == null; });
    $$('[data-afdl-state]').forEach(function (el) { var k = el.getAttribute('data-afdl-state'); var r = ST.issues[k]; el.setAttribute('data-st', allDone(k) ? 'done' : (r && r.iv && r.iv.length) ? 'part' : 'new'); });
    if (MB) { var lab2 = $('.mb-t', MB); if (P.k && DATA[P.k] && P.a) { var i = beadAt(P.k, P.a.currentTime); lab2.textContent = '正在播放：' + DATA[P.k].label + ' 第 ' + (i + 1) + ' 區'; $('.mb-pp', MB).textContent = P.a.paused ? '▶' : '❚❚'; $('.mb-c', MB).textContent = f(P.a.currentTime) + ' / ' + f(P.a.duration || DATA[P.k].dur); } }
  }

  // ---------- player (issue page audio or mini player) ----------
  var P = { a: null, k: null, last: null, saved: 0 }, MB = null;
  var PAGE_AUD = $('audio[data-afdl-key]');
  function track() {
    var a = P.a, k = P.k; if (!a || !k) return;
    var t = a.currentTime;
    if (!a.paused && P.last != null && t > P.last && t - P.last < 2.5) {
      var r = rec(k); r.iv = addIv(r.iv, P.last, t);
      var D = DATA[k]; if (D) D.beads.forEach(function (b) { b.segs.forEach(function (sg) { if (t > sg[1] && P.last < sg[2]) r.segs[sg[0]] = Math.round(cover(r.iv, sg[1], sg[2]) * 10) / 10; }); });
    }
    P.last = t;
    if (Date.now() - P.saved > 5000) persist();
    paintBeads();
  }
  function persist() { var a = P.a, k = P.k; if (!a || !k) return; var r = rec(k); if (a.currentTime > 0) r.pos = Math.round(a.currentTime * 10) / 10; r.dur = Math.round(a.duration || (DATA[k] || {}).dur || 0); r.upd = ts8(); P.saved = Date.now(); save(); }
  function bind(a, k) {
    P.a = a; P.k = k; P.last = null;
    if (a._afdl) return; a._afdl = 1;
    a.addEventListener('timeupdate', track); a.addEventListener('seeking', function () { P.last = null; });
    a.addEventListener('play', function () { P.last = a.currentTime; paintBeads(); }); a.addEventListener('pause', function () { persist(); paintBeads(); });
    window.addEventListener('pagehide', persist); document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') persist(); });
  }
  function mini() {
    if (MB) return MB;
    MB = document.createElement('div'); MB.className = 'afdl-mini'; MB.setAttribute('role', 'region'); MB.setAttribute('aria-label', '迷你播放器');
    MB.innerHTML = '<button type="button" class="mb-pp" aria-label="播放／暫停">▶</button><div class="mb-m"><div class="mb-t"></div><div class="mb-r"><span class="beads sm" data-afdl-beads=""></span><span class="mb-c"></span></div></div><a class="mb-go">邊聽邊看 →</a><button type="button" class="mb-x" aria-label="關閉播放器">✕</button><audio preload="none"></audio>';
    document.body.appendChild(MB); document.body.classList.add('has-mini');
    $('.mb-pp', MB).onclick = function () { P.a.paused ? P.a.play() : P.a.pause(); };
    $('.mb-go', MB).addEventListener('click', function () { var a = P.a, D = DATA[P.k]; if (a && D && !a.paused) { persist(); this.href = D.href + '?play=1&t=' + Math.floor(a.currentTime); } });
    $('.mb-x', MB).onclick = function () { P.a.pause(); persist(); MB.hidden = true; document.body.classList.remove('has-mini'); };
    return MB;
  }
  function start(k, at) {
    var D = DATA[k]; if (!D) return;
    var a;
    if (PAGE_AUD && PAGE_AUD.getAttribute('data-afdl-key') === k) a = PAGE_AUD;
    else {
      mini(); MB.hidden = false; document.body.classList.add('has-mini'); a = $('audio', MB);
      var bd = $('[data-afdl-beads]', MB); if (bd.getAttribute('data-afdl-beads') !== k) { bd.setAttribute('data-afdl-beads', k); bd._built = 0; }
      $('.mb-go', MB).href = D.href; if (a.getAttribute('data-k') !== k) { a.setAttribute('data-k', k); a.src = D.src; }
    }
    if (P.a && P.a !== a) { P.a.pause(); persist(); }
    bind(a, k);
    // play() is called synchronously inside the click (iOS Safari requires that); the resume seek happens once metadata is known
    var seek = function () { if (at != null && Math.abs(a.currentTime - at) > 1) { try { a.currentTime = at; } catch (e) {} } paintBeads(); };
    if (a.readyState >= 1) seek(); else { a.preload = 'auto'; a.addEventListener('loadedmetadata', seek, { once: true }); }
    var p = a.play(); if (p && p.catch) p.catch(function (err) { if (err && err.name === 'NotAllowedError' && a === PAGE_AUD) { tapToPlay(a); return; } if (err && err.name === 'NotAllowedError' && D.href) location.href = D.href + '?play=1' + (at ? '&t=' + Math.floor(at) : ''); });
    paintBeads();
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-afdl-play]');
    if (b) { e.preventDefault(); var k = b.getAttribute('data-afdl-play'); if (P.k === k && P.a && !P.a.paused) { P.a.pause(); return; } if (P.k === k && P.a && P.a.currentTime > 1) { P.a.play(); return; } var r = resumeAt(k); start(k, r != null ? r : allDone(k) ? 0 : null); return; }
    var j = e.target.closest && e.target.closest('[data-afdl-jump]');
    if (j) { e.preventDefault(); var k2 = j.getAttribute('data-afdl-jump'), bd = DATA[k2].beads[+j.getAttribute('data-i')]; start(k2, bd.s + 0.01); return; }
    var rs = e.target.closest && e.target.closest('[data-afdl-restart]');
    if (rs) { e.preventDefault(); start(rs.getAttribute('data-afdl-restart'), 0); }
  });
  // filters on archive page
  $$('[data-afdl-filter]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var v = btn.getAttribute('data-afdl-filter');
      $$('[data-afdl-filter]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === btn)); });
      $$('[data-afdl-card]').forEach(function (c) { var k = c.getAttribute('data-afdl-card'); var sp = c.hasAttribute('data-special'); c.hidden = v === 'unfinished' ? !(started(k) && !allDone(k)) : v === 'special' ? !sp : false; });
      var n = $$('[data-afdl-card]').filter(function (c) { return !c.hidden; }).length, em = $('[data-afdl-empty]'); if (em) em.hidden = n > 0;
    });
  });
  function tapToPlay(a) {
    if ($('.afdl-tap')) return;
    var o = document.createElement('div'); o.className = 'afdl-tap';
    o.innerHTML = '<button type="button">▶ 點一下開始播放<small>' + (a.currentTime > 1 ? '從 ' + f(a.currentTime) + ' 開始' : '從頭開始聽整期') + '</small></button>';
    document.body.appendChild(o);
    o.addEventListener('click', function () { var p = a.play(); if (p && p.catch) p.catch(function () {}); o.remove(); });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-afdl-from]');
    if (b) { e.preventDefault(); start(b.getAttribute('data-afdl-from'), parseFloat(b.getAttribute('data-t')) || 0); }
  });
  // play intent from another page: ?play=1 (resume or start) | ?play=<segment id> | &t=<sec>  → play now (one-tap overlay if the browser refuses)
  var QS = new URLSearchParams(location.search), QP = QS.get('play'), QT = parseFloat(QS.get('t'));
  if (QP) { QS.delete('play'); QS.delete('t'); try { history.replaceState(null, '', location.pathname + (QS.toString() ? '?' + QS : '') + location.hash); } catch (e) {} }
  // issue page: bind existing player, resume prompt at saved-15s
  if (PAGE_AUD && QP) {
    var KQ = PAGE_AUD.getAttribute('data-afdl-key'), atQ = null;
    if (isFinite(QT) && QT > 0) atQ = QT;
    else if (QP !== '1' && DATA[KQ]) DATA[KQ].beads.forEach(function (bd) { bd.segs.forEach(function (sg) { if (sg[0] === QP) atQ = sg[1] + 0.01; }); });
    if (atQ == null) atQ = resumeAt(KQ);
    start(KQ, atQ);
    setInterval(function () { if (!PAGE_AUD.paused) persist(); }, 5000);
  } else if (PAGE_AUD) {
    var K = PAGE_AUD.getAttribute('data-afdl-key'); bind(PAGE_AUD, K);
    var r0 = resumeAt(K);
    if (r0 != null) {
      var setT = function () { PAGE_AUD.currentTime = r0; paintBeads(); };
      if (PAGE_AUD.readyState >= 1) setT(); else PAGE_AUD.addEventListener('loadedmetadata', setT, { once: true });
      var t = document.createElement('div'); t.className = 'afdl-resume'; t.setAttribute('role', 'status');
      t.innerHTML = '<span>從 ' + f(r0) + ' 繼續聽？</span><button type="button" class="go">▶ 繼續聽</button><button type="button" class="rs">從頭聽</button><button type="button" class="x" aria-label="關閉">✕</button>';
      document.body.appendChild(t);
      $('.go', t).onclick = function () { PAGE_AUD.currentTime = r0; PAGE_AUD.play(); t.remove(); };
      $('.rs', t).onclick = function () { PAGE_AUD.currentTime = 0; PAGE_AUD.play(); t.remove(); };
      $('.x', t).onclick = function () { t.remove(); };
      PAGE_AUD.addEventListener('play', function () { t.remove(); }, { once: true });
    }
    setInterval(function () { if (!PAGE_AUD.paused) persist(); }, 5000);
  }
  setInterval(function () { if (P.a && !P.a.paused) persist(); }, 5000);
  // single-issue page: 本期目錄 starts collapsed on phones so the content comes first
  if (window.matchMedia && matchMedia('(max-width:1023px)').matches) $$('.itoc details').forEach(function (d) { d.open = false; });
  window.AFDL = { state: function () { return ST; }, beadFrac: beadFrac, data: DATA };
  paintBeads();
})();
