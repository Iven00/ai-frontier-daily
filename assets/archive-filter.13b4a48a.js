/* archive-filter.js — 往期 two-group filter (PREVIEW). User-requested 2026-10-26 09:34: the old single row
 * 全部/未聽完/特刊 mixed issue type and listening state. Two single-select groups, combined with AND:
 *   刊別 type:  all | daily | special
 *   狀態 state: all | new (沒聽過 = never played) | partial (未聽完 = played, not every bead full) | done (已聽完 = every bead full)
 * State comes from afd-listen.js (window.afdlStateOf, local progress "afd-prog-v1"; stays on this device).
 * Selection: URL ?type=&state= wins; otherwise localStorage "afd-archive-filter-v1"; default 全部/全部.
 * A chip tap saves to localStorage and mirrors into the URL (history.replaceState), so a copied link reproduces the view. */
(function () {
  'use strict';
  var SK = 'afd-archive-filter-v1', T = ['all', 'daily', 'special'], S = ['all', 'new', 'partial', 'done'];
  var $ = function (q, r) { return (r || document).querySelector(q); }, $$ = function (q, r) { return Array.prototype.slice.call((r || document).querySelectorAll(q)); };
  var box = $('[data-afx]'); if (!box) return;
  function load() {
    var o = {}; try { o = JSON.parse(localStorage.getItem(SK) || '{}') || {}; } catch (e) {}
    var q = new URLSearchParams(location.search), sel = { type: T.indexOf(o.type) >= 0 ? o.type : 'all', state: S.indexOf(o.state) >= 0 ? o.state : 'all' };
    if (T.indexOf(q.get('type')) >= 0) sel.type = q.get('type');
    if (S.indexOf(q.get('state')) >= 0) sel.state = q.get('state');
    return sel;
  }
  function save(sel) { try { localStorage.setItem(SK, JSON.stringify(sel)); } catch (e) {} }
  function toUrl(sel) {
    var u = new URL(location.href); u.searchParams.delete('type'); u.searchParams.delete('state');
    if (sel.type !== 'all') u.searchParams.set('type', sel.type);
    if (sel.state !== 'all') u.searchParams.set('state', sel.state);
    try { history.replaceState(history.state, '', u.pathname + u.search + u.hash); } catch (e) {}
  }
  function stateOf(k) { return window.afdlStateOf ? window.afdlStateOf(k) : 'new'; }
  var sel = load();
  function apply() {
    $$('[data-afx-type]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-afx-type') === sel.type)); });
    $$('[data-afx-state]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-afx-state') === sel.state)); });
    var n = 0;
    $$('[data-afdl-card]').forEach(function (c) {
      var k = c.getAttribute('data-afdl-card'), ty = c.hasAttribute('data-special') ? 'special' : 'daily';
      var show = (sel.type === 'all' || sel.type === ty) && (sel.state === 'all' || sel.state === stateOf(k));
      c.hidden = !show; if (show) n++;
    });
    var em = $('[data-afx-empty]'); if (em) em.hidden = n > 0;
    box.setAttribute('data-afx-count', String(n));
  }
  box.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-afx-type],[data-afx-state]'); if (!b) return;
    if (b.hasAttribute('data-afx-type')) sel.type = b.getAttribute('data-afx-type'); else sel.state = b.getAttribute('data-afx-state');
    save(sel); toUrl(sel); apply();
  });
  var clr = $('[data-afx-clear]');
  if (clr) clr.addEventListener('click', function () { sel = { type: 'all', state: 'all' }; save(sel); toUrl(sel); apply(); var f = $('[data-afx-type="all"]'); if (f) f.focus(); });
  toUrl(sel); apply();   // the address bar always shows the current view, so copying it reproduces the result
})();
