// Gridline user interface. All data rules live in core.mjs and model.mjs.
import {
  COLUMNS, COLUMN_BY_KEY, generateRows, getValue, formatValue, toPlain, formatInt, formatMoney,
  computeView, toggleSort, isFilterActive, filterKindFor, describeFilter, isNumericType,
  parseCSV, toCSV, parseTSV, toTSV, guessMapping, rangeStats, sanitizeView, sampleImportCSV
} from './core.mjs';
import { GridModel } from './model.mjs';

const ROW_H = 36, HEAD_H = 40, OVERSCAN = 10, CARD_H = 152;
const OPEN = ['Submitted', 'Approved', 'Shipped'];
const STORE_KEY = 'gridline.views.v1';
const SEARCHABLE = new Set(['id', 'supplier', 'item', 'status', 'priority', 'category', 'warehouse', 'sku', 'buyer', 'notes']);
const MONO = new Set(['id', 'sku', 'dueDate', 'orderDate', 'qty', 'unitCost', 'total']);

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// Very large screens scale the page with CSS zoom. Pointer and rect values are screen pixels, layout values are not.
const zoom = () => parseFloat(getComputedStyle(document.body).zoom) || 1;
const plural = (n, word) => `${formatInt(n)} ${word}${n === 1 ? '' : 's'}`;
const clone = o => JSON.parse(JSON.stringify(o));
const today = () => new Date().toISOString().slice(0, 10);

const ICON = {
  dots: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="3.5" r="1.4" fill="currentColor"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/><circle cx="8" cy="12.5" r="1.4" fill="currentColor"/></svg>',
  x: '<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
};

// Data and model --------------------------------------------------------------------------
const rows = generateRows();
const model = new GridModel(rows);
const rowIndex = new Map(rows.map((r, i) => [r.id, i]));
let viewPos = new Int32Array(rows.length).fill(-1);

const defaultColumns = () => COLUMNS.map(c => ({ key: c.key, width: c.width, hidden: false, pinned: c.key === 'id' }));
const BUILTIN = [
  { id: 'all', name: 'All orders', filters: {}, sort: [], search: '' },
  { id: 'late', name: 'Open and past due', filters: { status: { kind: 'enum', values: OPEN }, dueDate: { kind: 'date', from: '', to: '2026-10-18' } }, sort: [{ key: 'dueDate', dir: 1 }], search: '' },
  { id: 'rush', name: 'Rush and high priority', filters: { priority: { kind: 'enum', values: ['High', 'Rush'] }, status: { kind: 'enum', values: ['Draft', ...OPEN] } }, sort: [{ key: 'priority', dir: -1 }, { key: 'dueDate', dir: 1 }], search: '' },
  { id: 'large', name: 'Largest open orders', filters: { status: { kind: 'enum', values: OPEN }, total: { kind: 'range', min: 500000, max: null } }, sort: [{ key: 'total', dir: -1 }], search: '' }
];

const state = {
  cols: defaultColumns(), filters: {}, search: '', sort: [], view: [], stale: false,
  active: { r: 0, c: 0 }, anchor: { r: 0, c: 0 }, editing: null, viewId: 'b:all', mode: 'grid', lastViewMs: 0
};
let layout = null;
let rendered = { first: -1, last: -1 };

// Elements
const grid = $('#grid'), canvas = $('#canvas'), hrow = $('#hrow'), body = $('#body');
const editLayer = $('#edit-layer'), editor = $('#editor'), editError = $('#edit-error');
const cards = $('#cards'), cardsSizer = $('#cards-sizer');
const searchInput = $('#search'), viewsSelect = $('#views');
const colMenu = $('#colmenu'), exportMenu = $('#export-menu');
const clip = $('#clip');

// Layout ----------------------------------------------------------------------------------
function relayout() {
  state.cols = [...state.cols.filter(c => c.pinned), ...state.cols.filter(c => !c.pinned)];
  let x = 0;
  const cols = state.cols.filter(c => !c.hidden).map(c => {
    const o = { key: c.key, col: COLUMN_BY_KEY[c.key], width: c.width, pinned: c.pinned, left: x };
    x += c.width; return o;
  });
  const pinned = cols.filter(c => c.pinned);
  layout = { cols, total: x, pinnedWidth: pinned.reduce((s, c) => s + c.width, 0), lastPinned: pinned.length - 1 };
  state.active.c = clamp(state.active.c, 0, cols.length - 1);
  state.anchor.c = clamp(state.anchor.c, 0, cols.length - 1);
}
const colIndexOf = key => layout.cols.findIndex(c => c.key === key);
const rowAt = r => rows[state.view[r]];

function selRect() {
  const a = state.anchor, b = state.active;
  if (b.r < 0 || !state.view.length) return null;
  const ar = a.r < 0 ? b.r : a.r;
  return { r0: Math.min(ar, b.r), r1: Math.max(ar, b.r), c0: Math.min(a.c, b.c), c1: Math.max(a.c, b.c) };
}

// View pipeline -------------------------------------------------------------------------------
function refreshView({ keepPosition = false } = {}) {
  const t0 = performance.now();
  state.view = computeView(rows, state);
  state.lastViewMs = performance.now() - t0;
  document.documentElement.dataset.viewMs = state.lastViewMs.toFixed(1);
  viewPos.fill(-1);
  state.view.forEach((ri, vi) => { viewPos[ri] = vi; });
  state.stale = false;
  const n = state.view.length;
  if (!keepPosition) {
    grid.scrollTop = 0;
    if (state.mode === 'cards') scrollCardsTo(0);
    state.active = { r: n ? 0 : -1, c: state.active.c };
    state.anchor = { ...state.active };
  } else {
    state.active.r = clamp(state.active.r, -1, n - 1);
    state.anchor.r = clamp(state.anchor.r, -1, n - 1);
  }
  renderAll();
}

let refreshTimer = 0;
function refreshSoon() { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => refreshView(), 140); }

function renderAll() {
  renderHeader();
  renderBody(true);
  renderCards(true);
  renderChips();
  renderCounts();
  renderSummary();
  updateToolbar();
  if ($('#review').open) renderReview();
}

// Header ------------------------------------------------------------------------------------
function dirWords(col, dir) {
  const t = col.type;
  if (t === 'int' || t === 'money') return dir === 1 ? 'smallest first' : 'largest first';
  if (t === 'date') return dir === 1 ? 'oldest first' : 'newest first';
  if (t === 'enum') return dir === 1 ? 'in list order' : 'in reverse list order';
  return dir === 1 ? 'A to Z' : 'Z to A';
}

function renderHeader() {
  canvas.style.width = layout.total + 'px';
  hrow.style.width = layout.total + 'px';
  grid.setAttribute('aria-colcount', layout.cols.length);
  const headActive = state.active.r === -1;
  hrow.innerHTML = layout.cols.map((lc, c) => {
    const si = state.sort.findIndex(s => s.key === lc.key);
    const s = si >= 0 ? state.sort[si] : null;
    const filtered = isFilterActive(state.filters[lc.key]);
    const cls = ['hcell', lc.pinned && 'pin', c === layout.lastPinned && 'pin-edge', isNumericType(lc.col.type) && 'num', filtered && 'filtered', headActive && state.active.c === c && 'act'].filter(Boolean).join(' ');
    const ind = s ? `<span class="sort-ind" aria-hidden="true">${s.dir === 1 ? '↑' : '↓'}${state.sort.length > 1 ? si + 1 : ''}</span>` : '';
    const srSort = s && si > 0 ? `<span class="sr">, sort ${si + 1} ${dirWords(lc.col, s.dir)}</span>` : '';
    const ariaSort = si === 0 ? ` aria-sort="${s.dir === 1 ? 'ascending' : 'descending'}"` : '';
    return `<div role="columnheader" id="gh_${c}" data-c="${c}" class="${cls}" aria-colindex="${c + 1}"${ariaSort} style="width:${lc.width}px${lc.pinned ? `;left:${lc.left}px` : ''}">` +
      `<span class="hlabel">${esc(lc.col.label)}</span>${ind}${srSort}${filtered ? '<span class="fdot" aria-hidden="true"></span><span class="sr">, filtered</span>' : ''}` +
      `<button type="button" class="hmenu" tabindex="-1" data-menu="${c}" aria-label="${esc(lc.col.label)} column menu" aria-haspopup="dialog" aria-expanded="false">${ICON.dots}</button>` +
      `<span class="resizer" data-resize="${c}" aria-hidden="true"></span></div>`;
  }).join('');
}

// Body ---------------------------------------------------------------------------------------
function cellInner(lc, row) {
  const v = getValue(row, lc.key);
  if (lc.key === 'status') return `<span class="pill st-${v.toLowerCase()}">${v}</span>`;
  if (lc.key === 'priority') return `<span class="pri pr-${v.toLowerCase()}">${v}</span>`;
  return `<span class="v">${esc(formatValue(lc.col, v))}</span>`;
}

function rowHtml(r, sel, hasChanges) {
  const row = rowAt(r);
  const act = state.active;
  let h = `<div role="row" class="row${r % 2 ? ' odd' : ''}" aria-rowindex="${r + 2}" style="top:${HEAD_H + r * ROW_H}px;width:${layout.total}px">`;
  const totalDerived = hasChanges && (model.isDirty(row.id, 'qty') || model.isDirty(row.id, 'unitCost'));
  for (let c = 0; c < layout.cols.length; c++) {
    const lc = layout.cols[c];
    const inSel = sel && r >= sel.r0 && r <= sel.r1 && c >= sel.c0 && c <= sel.c1;
    const dirty = hasChanges && model.isDirty(row.id, lc.key);
    let cls = 'cell';
    if (MONO.has(lc.key)) cls += ' mono';
    if (isNumericType(lc.col.type)) cls += ' num';
    if (lc.col.readonly) cls += ' ro';
    if (lc.pinned) cls += ' pin';
    if (c === layout.lastPinned) cls += ' pin-edge';
    if (dirty) cls += ' dirty';
    else if (lc.key === 'total' && totalDerived) cls += ' derived';
    if (inSel) cls += ' sel';
    if (act.r === r && act.c === c) cls += ' act';
    const title = dirty ? ` title="Was ${esc(formatValue(lc.col, model.originalValue(row.id, lc.key)) || 'blank')}"` : '';
    h += `<div role="gridcell" id="g${r}_${c}" data-r="${r}" data-c="${c}" class="${cls}" aria-colindex="${c + 1}" aria-selected="${inSel ? 'true' : 'false'}"${lc.col.readonly ? ' aria-readonly="true"' : ''}${title} style="width:${lc.width}px${lc.pinned ? `;left:${lc.left}px` : ''}">${cellInner(lc, row)}</div>`;
  }
  return h + '</div>';
}

function renderBody(force = false) {
  if (state.mode !== 'grid') return;
  const n = state.view.length;
  canvas.style.height = (HEAD_H + n * ROW_H) + 'px';
  grid.setAttribute('aria-rowcount', n + 1);
  $('#empty').hidden = n > 0;
  const top = grid.scrollTop, h = grid.clientHeight || 600;
  const visFirst = Math.floor(top / ROW_H), visLast = Math.ceil((top + h) / ROW_H);
  if (!force && visFirst >= rendered.first && visLast <= rendered.last) return;
  const first = Math.max(0, visFirst - OVERSCAN), last = Math.min(n - 1, visLast + OVERSCAN);
  rendered = { first, last: visLast + OVERSCAN };
  const sel = selRect();
  const hasChanges = model.changeCount > 0;
  let html = '';
  for (let r = first; r <= last; r++) html += rowHtml(r, sel, hasChanges);
  const a = state.active.r;
  if (a >= 0 && a < n && (a < first || a > last)) html += rowHtml(a, sel, hasChanges);
  body.innerHTML = html;
  updateActiveDescendant();
}

function updateActiveDescendant() {
  const { r, c } = state.active;
  if (!state.view.length && r >= 0) { grid.removeAttribute('aria-activedescendant'); return; }
  grid.setAttribute('aria-activedescendant', r < 0 ? `gh_${c}` : `g${r}_${c}`);
}

function scrollCellIntoView(r, c, fromC = c) {
  if (r >= 0) {
    const top = r * ROW_H, viewH = grid.clientHeight - HEAD_H;
    if (top < grid.scrollTop) grid.scrollTop = top;
    else if (top + ROW_H > grid.scrollTop + viewH) grid.scrollTop = top + ROW_H - viewH;
  }
  const lc = layout.cols[c];
  // Moving into a pinned column from elsewhere, as Home does, also brings the scroll back to the start
  if (lc && lc.pinned && c !== fromC) grid.scrollLeft = 0;
  else if (lc && !lc.pinned) {
    if (lc.left < grid.scrollLeft + layout.pinnedWidth) grid.scrollLeft = lc.left - layout.pinnedWidth;
    else if (lc.left + lc.width > grid.scrollLeft + grid.clientWidth) grid.scrollLeft = lc.left + lc.width - grid.clientWidth;
  }
}

function go(r, c, extend = false) {
  const n = state.view.length, m = layout.cols.length;
  const wasHead = state.active.r < 0, fromC = state.active.c;
  r = clamp(r, extend ? 0 : -1, n - 1);
  c = clamp(c, 0, m - 1);
  state.active = { r, c };
  if (!extend) state.anchor = { r, c };
  scrollCellIntoView(r, c, fromC);
  if (wasHead || r < 0) renderHeader();
  renderBody(true);
  renderSummary();
}

let scrollRaf = 0, lastScrollLeft = 0;
grid.addEventListener('scroll', () => {
  // Only sideways scrolling moves the header under an open column menu
  if (grid.scrollLeft !== lastScrollLeft) { lastScrollLeft = grid.scrollLeft; closePopovers(); }
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0;
    renderBody();
    placeEditor();
    grid.classList.toggle('scrolled-x', grid.scrollLeft > 0);
  });
}, { passive: true });

new ResizeObserver(() => { renderBody(true); renderCards(true); placeEditor(); }).observe($('#main'));

// Chips, counts and summary ----------------------------------------------------------------------
function sortText() {
  return 'Sorted by ' + state.sort.map((s, i) => `${i ? 'then ' : ''}${COLUMN_BY_KEY[s.key].label}, ${dirWords(COLUMN_BY_KEY[s.key], s.dir)}`).join(', ');
}

function renderChips() {
  const out = [];
  const q = state.search.trim();
  if (q) out.push(`<button type="button" class="chip" data-clear="search" aria-label="Remove search for ${esc(q)}"><span class="t">Search "${esc(q)}"</span><span class="x">${ICON.x}</span></button>`);
  for (const [k, f] of Object.entries(state.filters)) {
    if (!isFilterActive(f)) continue;
    const d = describeFilter(k, f);
    out.push(`<button type="button" class="chip" data-clear="f:${k}" aria-label="Remove filter ${esc(d)}"><span class="t">${esc(d)}</span><span class="x">${ICON.x}</span></button>`);
  }
  const filterCount = out.length;
  if (state.sort.length) out.push(`<button type="button" class="chip sort" data-clear="sort" aria-label="Clear sort. ${esc(sortText())}"><span class="t">${esc(sortText())}</span><span class="x">${ICON.x}</span></button>`);
  if (out.length >= 2) out.push('<button type="button" class="chip-clear" data-clear="all">Clear all</button>');
  if (state.stale) out.push('<button type="button" class="chip warn" data-clear="stale">Edits changed rows in this view. Refresh to re-sort and re-filter</button>');
  $('#chips').innerHTML = out.length ? '<span class="chips-label">Showing</span>' + out.join('') : `<span class="chips-empty"><span class="ce-text">All orders. Try a saved view:</span>${BUILTIN.slice(1).map(v => `<button type="button" class="quick" data-view="b:${v.id}">${esc(v.name)}</button>`).join('')}<span class="ce-hint">Then double-click a cell to edit it, or drag across numbers for their sum.</span></span>`;
  const fc = $('#filter-count');
  fc.hidden = !filterCount; fc.textContent = filterCount;
}

$('#chips').addEventListener('click', e => {
  const v = e.target.closest('[data-view]');
  if (v) { viewsSelect.value = v.dataset.view; viewsSelect.dispatchEvent(new Event('change')); return; }
  const b = e.target.closest('[data-clear]');
  if (!b) return;
  const what = b.dataset.clear;
  const chips = [...$('#chips').querySelectorAll('[data-clear]')];
  const idx = chips.indexOf(b);
  if (what === 'search') { state.search = ''; searchInput.value = ''; }
  else if (what === 'sort') state.sort = [];
  else if (what === 'all') { state.filters = {}; state.search = ''; searchInput.value = ''; state.sort = []; }
  else if (what.startsWith('f:')) delete state.filters[what.slice(2)];
  refreshView({ keepPosition: what === 'stale' });
  syncPhoneSort();
  const next = [...$('#chips').querySelectorAll('[data-clear]')];
  (next[Math.min(idx, next.length - 1)] || searchInput).focus();
});

function renderCounts() {
  const n = state.view.length, t = rows.length;
  $('#row-count').textContent = n === t ? `${formatInt(t)} orders` : `${formatInt(n)} of ${formatInt(t)} orders`;
}

function renderSummary() {
  const el = $('#summary');
  if (state.mode === 'cards') {
    let sum = 0;
    for (const i of state.view) sum += rows[i].qty * rows[i].unitCost;
    el.innerHTML = state.view.length ? `<span>Order value <b>${formatMoney(sum)}</b></span>` : '';
    return;
  }
  const s = selRect();
  if (!s) { el.innerHTML = ''; return; }
  const cells = (s.r1 - s.r0 + 1) * (s.c1 - s.c0 + 1);
  const parts = [];
  for (let c = s.c0; c <= s.c1; c++) {
    const lc = layout.cols[c];
    if (!isNumericType(lc.col.type)) continue;
    const vals = [];
    for (let r = s.r0; r <= s.r1; r++) vals.push(getValue(rowAt(r), lc.key));
    const st = rangeStats(vals);
    const money = lc.col.type === 'money';
    const fmt = v => money ? formatMoney(Math.round(v)) : formatInt(Math.round(v * 10) / 10);
    parts.push(`<span class="sum-col" data-key="${lc.key}"><b>${esc(lc.col.label)}</b> count <span data-stat="count">${formatInt(st.count)}</span>, sum <span data-stat="sum">${fmt(st.sum)}</span>, average <span data-stat="avg">${fmt(st.avg)}</span></span>`);
  }
  const lead = cells > 1 ? `<span><b>${formatInt(cells)}</b> cells selected</span>` : '';
  el.innerHTML = lead + (parts.length ? parts.join('') : (cells > 1 ? '' : '<span class="hint">Select numbers to see their count, sum and average.</span>'));
}

function updateToolbar() {
  const u = model.history.peekUndo(), r = model.history.peekRedo();
  const undoBtn = $('#undo'), redoBtn = $('#redo');
  undoBtn.disabled = !u; redoBtn.disabled = !r;
  undoBtn.title = u ? `Undo ${u.label}` : 'Nothing to undo';
  redoBtn.title = r ? `Redo ${r.label}` : 'Nothing to redo';
  const cc = $('#change-count');
  cc.textContent = formatInt(model.changeCount);
  cc.classList.toggle('on', model.changeCount > 0);
  $('#review-open').setAttribute('aria-label', `Review changes, ${plural(model.changeCount, 'changed cell')}`);
}

// Toast ------------------------------------------------------------------------------------------
let toastTimer = 0;
function toast(msg, details = [], kind = 'info') {
  const t = $('#toast');
  t.className = 'toast' + (kind === 'warn' ? ' warn' : '');
  $('#toast-msg').textContent = msg;
  $('#toast-list').innerHTML = details.map(d => `<li>${esc(d)}</li>`).join('');
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, details.length ? 9000 : 4500);
}
$('#toast-x').addEventListener('click', () => { $('#toast').hidden = true; });

function reportEdit(verb, res) {
  const n = res.changes.length, e = res.errors.length;
  if (!e) { toast(n ? `${verb} ${plural(n, 'cell')}.` : 'Nothing changed. The values were already the same.'); return; }
  const details = res.errors.slice(0, 4).map(x => `${x.id}: ${x.message}`);
  if (e > 4) details.push(`${formatInt(e - 4)} more not shown.`);
  toast(`${verb} ${plural(n, 'cell')}. ${plural(e, 'cell')} skipped.`, details, 'warn');
}

// Changes and undo ----------------------------------------------------------------------------------
function touchesView(batch) {
  const keys = new Set(batch.changes.map(c => c.key));
  const hit = k => keys.has(k) || (k === 'total' && (keys.has('qty') || keys.has('unitCost')));
  return state.sort.some(s => hit(s.key)) ||
    Object.entries(state.filters).some(([k, f]) => isFilterActive(f) && hit(k)) ||
    (state.search.trim() && [...keys].some(k => SEARCHABLE.has(k)));
}

function afterChange(batch) {
  if (batch && touchesView(batch)) state.stale = true;
  renderBody(true);
  renderCards(true);
  renderChips();
  renderSummary();
  updateToolbar();
  if ($('#review').open) renderReview();
}

function focusBatch(b) {
  if (state.mode !== 'grid' || !b.changes.length) return;
  const ch = b.changes[0];
  const r = viewPos[rowIndex.get(ch.id)], c = colIndexOf(ch.key);
  if (r >= 0 && c >= 0) go(r, c);
}

function undo() {
  if (state.editing) return;
  const b = model.undo();
  if (!b) { toast('Nothing to undo.'); return; }
  afterChange(b); focusBatch(b);
  toast(`Undone: ${b.label}. ${plural(b.changes.length, 'cell')} restored.`);
}
function redo() {
  if (state.editing) return;
  const b = model.redo();
  if (!b) { toast('Nothing to redo.'); return; }
  afterChange(b); focusBatch(b);
  toast(`Redone: ${b.label}. ${plural(b.changes.length, 'cell')} changed again.`);
}
$('#undo').addEventListener('click', undo);
$('#redo').addEventListener('click', redo);

const isTyping = el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod || isTyping(e.target) || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
});

// Editing ------------------------------------------------------------------------------------------
function beginEdit(initial = null) {
  const { r, c } = state.active;
  if (r < 0 || !state.view.length) return;
  const lc = layout.cols[c];
  const row = rowAt(r);
  if (lc.col.readonly) {
    toast(lc.key === 'total' ? 'Total is worked out from Qty and Unit cost. Edit those instead.' : `${lc.col.label} can't be edited.`);
    return;
  }
  state.anchor = { r, c };
  scrollCellIntoView(r, c);
  renderBody(true);
  state.editing = { r, c, id: row.id, key: lc.key };
  editor.value = initial !== null ? initial : toPlain(lc.col, row[lc.key]);
  editor.className = 'editor' + (MONO.has(lc.key) ? ' mono' : '');
  if (lc.col.type === 'enum') editor.setAttribute('list', 'dl-' + lc.key); else editor.removeAttribute('list');
  editor.setAttribute('inputmode', lc.col.type === 'int' ? 'numeric' : lc.col.type === 'money' ? 'decimal' : 'text');
  editor.setAttribute('aria-label', `${lc.col.label} for ${row.id}`);
  editor.removeAttribute('aria-invalid');
  editError.hidden = true;
  editor.hidden = false;
  placeEditor();
  editor.focus({ preventScroll: true });
  if (initial === null) editor.select(); else editor.setSelectionRange(editor.value.length, editor.value.length);
}

function placeEditor() {
  if (!state.editing) return;
  const { r, c } = state.editing;
  const lc = layout.cols[c];
  if (!lc) return;
  editLayer.style.width = grid.clientWidth + 'px';
  editLayer.style.height = Math.max(0, grid.clientHeight - HEAD_H) + 'px';
  const x = lc.pinned ? lc.left : lc.left - grid.scrollLeft;
  const y = r * ROW_H - grid.scrollTop;
  editor.style.transform = `translate(${x}px, ${y}px)`;
  editor.style.width = Math.max(lc.width, 140) + 'px';
  editor.style.height = ROW_H + 'px';
  if (!editError.hidden) {
    const below = HEAD_H + y + ROW_H + 6;
    const fitsBelow = below + 60 < grid.clientHeight;
    editError.style.left = clamp(x, 8, Math.max(8, grid.clientWidth - 348)) + 'px';
    editError.style.top = (fitsBelow ? below : HEAD_H + y - 56) + 'px';
  }
}

function endEdit() {
  state.editing = null;
  editor.hidden = true;
  editError.hidden = true;
  grid.focus({ preventScroll: true });
}

function commitEdit(move = null) {
  const ed = state.editing;
  if (!ed) return true;
  const col = COLUMN_BY_KEY[ed.key];
  const res = model.edit([{ id: ed.id, key: ed.key, raw: editor.value }], `Edit ${col.label}`);
  if (res.errors.length) {
    editor.setAttribute('aria-invalid', 'true');
    editError.textContent = res.errors[0].message;
    editError.hidden = false;
    placeEditor();
    return false;
  }
  endEdit();
  afterChange(res.batch);
  if (move) go(state.active.r + move[0], state.active.c + move[1]);
  return true;
}

function cancelEdit() { endEdit(); renderBody(true); }

editor.addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Enter') { e.preventDefault(); commitEdit([e.shiftKey ? -1 : 1, 0]); }
  else if (e.key === 'Tab') { e.preventDefault(); commitEdit([0, e.shiftKey ? -1 : 1]); }
  else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
});
editor.addEventListener('input', () => { editor.removeAttribute('aria-invalid'); editError.hidden = true; });
editor.addEventListener('blur', () => {
  if (!state.editing) return;
  const ed = state.editing;
  const col = COLUMN_BY_KEY[ed.key];
  const res = model.edit([{ id: ed.id, key: ed.key, raw: editor.value }], `Edit ${col.label}`);
  state.editing = null;
  editor.hidden = true;
  editError.hidden = true;
  if (res.errors.length) toast(`Edit not saved. ${res.errors[0].message}`, [], 'warn');
  afterChange(res.batch);
});

// Bulk operations ------------------------------------------------------------------------------------
function selectionTable() {
  const s = selRect();
  if (!s) return [];
  const out = [];
  for (let r = s.r0; r <= s.r1; r++) {
    const row = rowAt(r), line = [];
    for (let c = s.c0; c <= s.c1; c++) { const lc = layout.cols[c]; line.push(toPlain(lc.col, getValue(row, lc.key))); }
    out.push(line);
  }
  return out;
}

function copySelection() {
  const t = selectionTable();
  if (!t.length) return null;
  const text = toTSV(t);
  clip.value = text;
  clip.focus({ preventScroll: true });
  clip.select();
  setTimeout(() => grid.focus({ preventScroll: true }), 0);
  toast(`Copied ${plural(t.length * t[0].length, 'cell')} as tab separated text.`);
  return text;
}

grid.addEventListener('copy', e => {
  const t = selectionTable();
  if (!t.length) return;
  e.preventDefault();
  e.clipboardData.setData('text/plain', toTSV(t));
  toast(`Copied ${plural(t.length * t[0].length, 'cell')} as tab separated text.`);
});

function pasteText(text) {
  const block = parseTSV(text);
  const s = selRect();
  if (!block.length || !s) return;
  const n = state.view.length, m = layout.cols.length;
  const edits = [];
  const single = block.length === 1 && block[0].length === 1;
  let h = block.length, w = Math.max(...block.map(b => b.length));
  if (single && (s.r1 > s.r0 || s.c1 > s.c0)) {
    for (let r = s.r0; r <= s.r1; r++) for (let c = s.c0; c <= s.c1; c++) edits.push({ id: rowAt(r).id, key: layout.cols[c].key, raw: block[0][0] });
    h = s.r1 - s.r0 + 1; w = s.c1 - s.c0 + 1;
  } else {
    block.forEach((line, i) => {
      const r = s.r0 + i; if (r >= n) return;
      line.forEach((raw, j) => { const c = s.c0 + j; if (c < m) edits.push({ id: rowAt(r).id, key: layout.cols[c].key, raw }); });
    });
  }
  const res = model.edit(edits, 'Paste');
  state.anchor = { r: s.r0, c: s.c0 };
  state.active = { r: Math.min(n - 1, s.r0 + h - 1), c: Math.min(m - 1, s.c0 + w - 1) };
  afterChange(res.batch);
  reportEdit('Pasted', res);
}

function onPasteEvent(e) {
  if (state.editing) return;
  const text = e.clipboardData && e.clipboardData.getData('text/plain');
  e.preventDefault();
  grid.focus({ preventScroll: true });
  if (text) pasteText(text);
}
grid.addEventListener('paste', onPasteEvent);
clip.addEventListener('paste', onPasteEvent);

function fillDown() {
  const s = selRect();
  if (!s) return;
  if (s.r1 === s.r0) { toast('Select two or more rows, then fill down copies the top row into the rest.'); return; }
  const edits = [];
  for (let c = s.c0; c <= s.c1; c++) {
    const lc = layout.cols[c];
    if (lc.col.readonly) continue;
    const top = toPlain(lc.col, rowAt(s.r0)[lc.key]);
    for (let r = s.r0 + 1; r <= s.r1; r++) edits.push({ id: rowAt(r).id, key: lc.key, raw: top });
  }
  const res = model.edit(edits, 'Fill down');
  afterChange(res.batch);
  reportEdit('Filled', res);
}

function clearSelection() {
  const s = selRect();
  if (!s) return;
  const edits = [];
  for (let r = s.r0; r <= s.r1; r++) for (let c = s.c0; c <= s.c1; c++) {
    const lc = layout.cols[c];
    if (!lc.col.readonly) edits.push({ id: rowAt(r).id, key: lc.key, raw: '' });
  }
  const res = model.edit(edits, 'Clear');
  afterChange(res.batch);
  reportEdit('Cleared', res);
}

// Grid keyboard -------------------------------------------------------------------------------------
grid.addEventListener('keydown', e => {
  if (e.target !== grid || state.editing) return;
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key;
  const n = state.view.length, m = layout.cols.length;
  const a = state.active;
  const page = Math.max(1, Math.floor((grid.clientHeight - HEAD_H) / ROW_H) - 1);
  if (mod && !e.altKey) {
    const lk = k.toLowerCase();
    if (lk === 'c') { copySelection(); return; }
    if (lk === 'v') { clip.value = ''; clip.focus({ preventScroll: true }); return; }
    if (lk === 'd') { e.preventDefault(); fillDown(); return; }
    if (lk === 'a') { e.preventDefault(); if (n) { state.anchor = { r: 0, c: 0 }; state.active = { r: n - 1, c: m - 1 }; scrollCellIntoView(a.r < 0 ? 0 : a.r, a.c); renderBody(true); renderSummary(); } return; }
  }
  if (e.altKey && k === 'ArrowDown') { e.preventDefault(); openColumnMenu(a.c); return; }
  let handled = true;
  switch (k) {
    case 'ArrowDown': go(mod ? n - 1 : a.r + 1, a.c, e.shiftKey); break;
    case 'ArrowUp': go(mod ? (e.shiftKey ? 0 : -1) : a.r - 1, a.c, e.shiftKey); break;
    case 'ArrowRight': go(a.r, mod ? m - 1 : a.c + 1, e.shiftKey); break;
    case 'ArrowLeft': go(a.r, mod ? 0 : a.c - 1, e.shiftKey); break;
    case 'Home': go(mod ? 0 : a.r, 0, e.shiftKey); break;
    case 'End': go(mod ? n - 1 : a.r, m - 1, e.shiftKey); break;
    case 'PageDown': go(Math.max(0, a.r) + page, a.c, e.shiftKey); break;
    case 'PageUp': go(Math.max(0, a.r - page), a.c, e.shiftKey); break;
    case 'Enter':
      if (a.r < 0) { state.sort = toggleSort(state.sort, layout.cols[a.c].key, e.shiftKey); refreshView({ keepPosition: true }); syncPhoneSort(); go(-1, a.c); }
      else beginEdit();
      break;
    case 'F2': beginEdit(); break;
    case 'Delete': case 'Backspace': if (a.r >= 0) clearSelection(); break;
    case 'Escape': state.anchor = { ...state.active }; renderBody(true); renderSummary(); break;
    case 'ContextMenu': openColumnMenu(a.c); break;
    default:
      if (k.length === 1 && !mod && !e.altKey && a.r >= 0) beginEdit(k);
      else handled = false;
  }
  if (handled) e.preventDefault();
});

// Grid mouse -------------------------------------------------------------------------------------------
let drag = null;
function cellFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  const cell = el && el.closest && el.closest('#body .cell');
  return cell ? { r: +cell.dataset.r, c: +cell.dataset.c } : null;
}

grid.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  const resizer = e.target.closest('.resizer');
  const menuBtn = e.target.closest('.hmenu');
  const head = e.target.closest('.hcell');
  if (resizer) { startResize(e, +resizer.dataset.resize); return; }
  if (menuBtn) return;
  if (head) { startHeaderDrag(e, +head.dataset.c); return; }
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const pos = { r: +cell.dataset.r, c: +cell.dataset.c };
  if (e.pointerType !== 'mouse') { pendingTap = { pos, x: e.clientX, y: e.clientY }; return; }
  e.preventDefault();
  if (!state.editing) grid.focus({ preventScroll: true });
  else editor.blur();
  // preventDefault above keeps drag selection clean but can swallow dblclick, so detect it here
  const now = performance.now();
  const second = !e.shiftKey && lastDown && lastDown.r === pos.r && lastDown.c === pos.c && now - lastDown.t < 450;
  lastDown = second ? null : { ...pos, t: now };
  if (e.shiftKey) { state.active = pos; }
  else { state.active = pos; state.anchor = { ...pos }; }
  if (state.active.r >= 0) renderHeader();
  renderBody(true); renderSummary();
  grid.focus({ preventScroll: true });
  if (second) { beginEdit(); return; }
  drag = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
});
let lastDown = null;

let pendingTap = null;
grid.addEventListener('pointerup', e => {
  if (!pendingTap) return;
  const t = pendingTap; pendingTap = null;
  if (Math.abs(e.clientX - t.x) > 8 || Math.abs(e.clientY - t.y) > 8) return;
  if (state.editing) editor.blur();
  state.active = t.pos; state.anchor = { ...t.pos };
  grid.focus({ preventScroll: true });
  renderBody(true); renderSummary();
});

let autoScroll = 0;
window.addEventListener('pointermove', e => {
  if (!drag) return;
  drag.lastX = e.clientX; drag.lastY = e.clientY;
  extendDragTo(e.clientX, e.clientY);
  const rect = grid.getBoundingClientRect(), z = zoom();
  const dy = e.clientY > rect.bottom - 20 * z ? 24 : e.clientY < rect.top + (HEAD_H + 10) * z ? -24 : 0;
  const dx = e.clientX > rect.right - 20 * z ? 24 : e.clientX < rect.left + (layout.pinnedWidth + 10) * z && grid.scrollLeft > 0 ? -24 : 0;
  clearInterval(autoScroll);
  if (dx || dy) autoScroll = setInterval(() => {
    grid.scrollTop += dy; grid.scrollLeft += dx;
    renderBody(); extendDragTo(drag ? drag.lastX : 0, drag ? drag.lastY : 0);
  }, 40);
});
function extendDragTo(x, y) {
  if (!drag) return;
  const rect = grid.getBoundingClientRect(), z = zoom();
  const p = cellFromPoint(clamp(x, rect.left + 2 * z, rect.right - 14 * z), clamp(y, rect.top + (HEAD_H + 2) * z, rect.bottom - 14 * z));
  if (p && (p.r !== state.active.r || p.c !== state.active.c)) { state.active = p; renderBody(true); renderSummary(); }
}
window.addEventListener('pointerup', () => { drag = null; clearInterval(autoScroll); });

grid.addEventListener('dblclick', e => {
  const cell = e.target.closest('#body .cell');
  if (!cell || state.editing) return;
  state.active = { r: +cell.dataset.r, c: +cell.dataset.c };
  beginEdit();
});

// Header interactions: sort, reorder and resize ---------------------------------------------------------
function startResize(e, c) {
  e.preventDefault(); e.stopPropagation();
  const lc = layout.cols[c];
  const colState = state.cols.find(x => x.key === lc.key);
  const startX = e.clientX, startW = colState.width, z = zoom();
  grid.classList.add('resizing');
  let raf = 0;
  const move = ev => {
    colState.width = clamp(Math.round(startW + (ev.clientX - startX) / z), 60, 600);
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; relayout(); renderHeader(); renderBody(true); placeEditor(); });
  };
  const up = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    grid.classList.remove('resizing');
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function visualColumnX(c) {
  const lc = layout.cols[c];
  return lc.pinned ? lc.left : lc.left - grid.scrollLeft;
}

function startHeaderDrag(e, c) {
  const startX = e.clientX;
  const key = layout.cols[c].key;
  let moved = false, target = null;
  const mark = $('#drop-mark');
  const rect = grid.getBoundingClientRect(), z = zoom();
  const move = ev => {
    if (!moved && Math.abs(ev.clientX - startX) < 6) return;
    moved = true;
    const x = (ev.clientX - rect.left) / z;
    const src = layout.cols[c];
    // Allowed drop slots are within the same pinned group
    let best = null;
    layout.cols.forEach((lc, i) => {
      if (lc.pinned !== src.pinned) return;
      const vx = visualColumnX(i);
      if (best === null || Math.abs(vx - x) < Math.abs(best.x - x)) best = { i, x: vx };
      const end = vx + lc.width;
      if (Math.abs(end - x) < Math.abs(best.x - x)) best = { i: i + 1, x: end };
    });
    target = best;
    if (best) { mark.hidden = false; mark.style.left = clamp(best.x - 1, 0, grid.clientWidth - 3) + 'px'; }
    const h = hrow.querySelector(`[data-c="${c}"]`);
    if (h) h.classList.add('dragging');
  };
  const up = ev => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    mark.hidden = true;
    if (!moved) {
      if (ev.target.closest && ev.target.closest('.hmenu')) return;
      state.sort = toggleSort(state.sort, key, ev.shiftKey);
      refreshView({ keepPosition: true });
      syncPhoneSort();
      return;
    }
    if (target) moveColumnTo(key, target.i);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

// Move a column so it sits before visible slot `slot` (or at the end of its group)
function moveColumnTo(key, slot) {
  const src = layout.cols.find(lc => lc.key === key);
  const before = layout.cols[slot] && layout.cols[slot].pinned === src.pinned ? layout.cols[slot].key : null;
  if (before === key) { renderHeader(); return; }
  const item = state.cols.find(c => c.key === key);
  const list = state.cols.filter(c => c.key !== key);
  let at;
  if (before) at = list.findIndex(c => c.key === before);
  else { const group = list.filter(c => c.pinned === item.pinned); at = group.length ? list.indexOf(group[group.length - 1]) + 1 : (item.pinned ? 0 : list.length); }
  list.splice(at, 0, item);
  state.cols = list;
  const activeKey = layout.cols[state.active.c] && layout.cols[state.active.c].key;
  columnsChanged();
  const ci = colIndexOf(activeKey);
  if (ci >= 0) { state.active.c = ci; state.anchor.c = ci; renderBody(true); }
  toast(`Moved ${COLUMN_BY_KEY[key].label}.`);
}

function moveColumnBy(key, delta) {
  const idx = layout.cols.findIndex(lc => lc.key === key);
  const t = idx + delta;
  const src = layout.cols[idx];
  if (t < 0 || t >= layout.cols.length || layout.cols[t].pinned !== src.pinned) { toast(`${src.col.label} is already at the edge of its group.`); return; }
  moveColumnTo(key, delta > 0 ? t + 1 : t);
}

function columnsChanged() {
  relayout();
  renderHeader();
  renderBody(true);
  renderSummary();
  if ($('#columns').open) renderColumnsPanel();
}

function setPinned(key, pinned) {
  const item = state.cols.find(c => c.key === key);
  const list = state.cols.filter(c => c.key !== key);
  item.pinned = pinned;
  const lastPinned = list.filter(c => c.pinned).length;
  list.splice(lastPinned, 0, item);
  state.cols = list;
  columnsChanged();
}

function setHidden(key, hidden) {
  if (hidden && layout.cols.length <= 1) { toast('Keep at least one column visible.'); return false; }
  state.cols.find(c => c.key === key).hidden = hidden;
  columnsChanged();
  return true;
}

// Column menu ----------------------------------------------------------------------------------------------
function enumCounts(key) {
  const counts = {};
  for (const r of rows) counts[r[key]] = (counts[r[key]] || 0) + 1;
  return counts;
}

function parseBound(col, raw) {
  const t = String(raw).replace(/[$,\s]/g, '');
  if (!t) return { ok: true, value: null };
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return { ok: false };
  const n = Number(t);
  return { ok: true, value: col.type === 'money' ? Math.round(n * 100) : n };
}

// Builds the filter control for one column. Used by the column menu and the phone filter sheet.
function filterControls(key) {
  const col = COLUMN_BY_KEY[key];
  const kind = filterKindFor(col);
  const f = state.filters[key];
  const fs = document.createElement('fieldset');
  fs.className = 'fc';
  const id = 'f-' + key + '-' + Math.random().toString(36).slice(2, 7);
  if (kind === 'enum') {
    const counts = enumCounts(key);
    const sel = new Set(f ? f.values : col.options);
    fs.innerHTML = `<legend>Show ${esc(col.label.toLowerCase())}</legend><div class="fc-enum">${col.options.map(o => `<label class="chk"><input type="checkbox" value="${esc(o)}"${sel.has(o) ? ' checked' : ''}><span>${esc(o)}</span><span class="ct">${formatInt(counts[o] || 0)}</span></label>`).join('')}</div><div class="fc-links"><button type="button" data-all>Select all</button><button type="button" data-none>Select none</button></div>`;
    const apply = () => {
      const values = [...fs.querySelectorAll('input:checked')].map(i => i.value);
      setFilter(key, values.length === col.options.length ? null : { kind: 'enum', values });
    };
    fs.addEventListener('change', apply);
    fs.querySelector('[data-all]').addEventListener('click', () => { fs.querySelectorAll('input').forEach(i => { i.checked = true; }); apply(); });
    fs.querySelector('[data-none]').addEventListener('click', () => { fs.querySelectorAll('input').forEach(i => { i.checked = false; }); apply(); });
  } else if (kind === 'range') {
    const show = v => (v === null || v === undefined) ? '' : col.type === 'money' ? (v / 100).toFixed(2) : String(v);
    fs.innerHTML = `<legend>${esc(col.label)} range</legend><div class="fc-pair"><label for="${id}-a">From<input type="text" id="${id}-a" data-min inputmode="decimal" autocomplete="off" value="${show(f && f.min)}"></label><label for="${id}-b">To<input type="text" id="${id}-b" data-max inputmode="decimal" autocomplete="off" value="${show(f && f.max)}"></label></div><p class="fc-err" aria-live="polite"></p>`;
    const minI = fs.querySelector('[data-min]'), maxI = fs.querySelector('[data-max]'), err = fs.querySelector('.fc-err');
    fs.addEventListener('input', () => {
      const a = parseBound(col, minI.value), b = parseBound(col, maxI.value);
      minI.setAttribute('aria-invalid', String(!a.ok)); maxI.setAttribute('aria-invalid', String(!b.ok));
      if (!a.ok || !b.ok) { err.textContent = 'Enter a number, like 250 or 19.99.'; return; }
      err.textContent = '';
      setFilter(key, { kind: 'range', min: a.value, max: b.value }, true);
    });
  } else if (kind === 'date') {
    fs.innerHTML = `<legend>${esc(col.label)} between</legend><div class="fc-pair"><label for="${id}-a">From<input type="date" id="${id}-a" data-from value="${f ? esc(f.from || '') : ''}"></label><label for="${id}-b">To<input type="date" id="${id}-b" data-to value="${f ? esc(f.to || '') : ''}"></label></div>`;
    fs.addEventListener('change', () => setFilter(key, { kind: 'date', from: fs.querySelector('[data-from]').value, to: fs.querySelector('[data-to]').value }));
  } else {
    fs.innerHTML = `<legend>${esc(col.label)}</legend><div class="fc-one"><label for="${id}-q">Contains<input type="text" id="${id}-q" data-q autocomplete="off" value="${f ? esc(f.q) : ''}"></label></div>`;
    fs.addEventListener('input', () => setFilter(key, { kind: 'text', q: fs.querySelector('[data-q]').value }, true));
  }
  return fs;
}

function setFilter(key, f, typed = false) {
  if (!f || !isFilterActive(f)) delete state.filters[key]; else state.filters[key] = f;
  if (typed) refreshSoon(); else refreshView();
  updatePhoneFilterSummary();
}

let menuKey = null, menuReturn = null;
function openColumnMenu(c, anchorEl = null) {
  closePopovers();
  const lc = layout.cols[c];
  if (!lc) return;
  const key = lc.key, col = lc.col;
  menuKey = key;
  menuReturn = document.activeElement === grid ? grid : (anchorEl || grid);
  const inSort = state.sort.find(s => s.key === key);
  colMenu.setAttribute('aria-label', `${col.label} column`);
  colMenu.innerHTML = `<p class="pm-title">${esc(col.label)}</p>
    <div class="pm-sec"><button type="button" data-act="asc" aria-pressed="${!!(inSort && inSort.dir === 1 && state.sort.length === 1)}">Sort ${dirWords(col, 1)}</button><button type="button" data-act="desc" aria-pressed="${!!(inSort && inSort.dir === -1 && state.sort.length === 1)}">Sort ${dirWords(col, -1)}</button>
    <button type="button" data-act="then">${inSort ? 'Flip this sort' : 'Add as next sort'}</button>${inSort ? '<button type="button" data-act="unsort">Remove from sort</button>' : ''}</div>
    <div id="pm-filter"></div>
    <div class="pm-sec"><button type="button" data-act="pin">${lc.pinned ? 'Unpin column' : 'Pin to left'}</button><button type="button" data-act="hide">Hide column</button>
    <button type="button" data-act="left">Move left</button><button type="button" data-act="right">Move right</button>
    <button type="button" data-act="narrow">Narrower</button><button type="button" data-act="wide">Wider</button>
    ${isFilterActive(state.filters[key]) ? '<button type="button" data-act="clear">Clear filter</button>' : ''}</div>`;
  $('#pm-filter', colMenu).append(filterControls(key));
  colMenu.hidden = false;
  const btn = hrow.querySelector(`[data-menu="${c}"]`);
  const ref = (btn || anchorEl || grid).getBoundingClientRect(), z = zoom();
  const w = colMenu.offsetWidth, h = colMenu.offsetHeight;
  colMenu.style.left = clamp(ref.right / z - w, 8, window.innerWidth / z - w - 8) + 'px';
  colMenu.style.top = clamp(ref.bottom / z + 4, 8, Math.max(8, window.innerHeight / z - h - 8)) + 'px';
  if (btn) btn.setAttribute('aria-expanded', 'true');
  colMenu.querySelector('button').focus();
}

colMenu.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || !menuKey) return;
  const key = menuKey, act = b.dataset.act;
  const colState = state.cols.find(c => c.key === key);
  const close = () => { closePopovers(); grid.focus({ preventScroll: true }); };
  if (act === 'asc' || act === 'desc') { state.sort = [{ key, dir: act === 'asc' ? 1 : -1 }]; refreshView({ keepPosition: true }); syncPhoneSort(); close(); }
  else if (act === 'then') { const cur = state.sort.find(s => s.key === key); state.sort = cur ? state.sort.map(s => s.key === key ? { key, dir: -s.dir } : s) : [...state.sort, { key, dir: 1 }]; refreshView({ keepPosition: true }); syncPhoneSort(); close(); }
  else if (act === 'unsort') { state.sort = state.sort.filter(s => s.key !== key); refreshView({ keepPosition: true }); syncPhoneSort(); close(); }
  else if (act === 'pin') { setPinned(key, !colState.pinned); close(); }
  else if (act === 'hide') { if (setHidden(key, true)) toast(`${COLUMN_BY_KEY[key].label} is hidden. Show it again from Columns.`); close(); }
  else if (act === 'left' || act === 'right') { moveColumnBy(key, act === 'left' ? -1 : 1); openColumnMenu(colIndexOf(key)); }
  else if (act === 'narrow' || act === 'wide') { colState.width = clamp(colState.width + (act === 'wide' ? 40 : -40), 60, 600); columnsChanged(); openColumnMenu(colIndexOf(key)); colMenu.querySelector(`[data-act="${act}"]`).focus(); }
  else if (act === 'clear') { setFilter(key, null); close(); }
});

colMenu.addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); const r = menuReturn; closePopovers(); (r || grid).focus({ preventScroll: true }); }
});

hrow.addEventListener('click', e => {
  const b = e.target.closest('.hmenu');
  if (!b) return;
  const c = +b.dataset.menu;
  if (!colMenu.hidden && menuKey === layout.cols[c].key) { closePopovers(); return; }
  openColumnMenu(c, b);
});

function closePopovers() {
  if (!colMenu.hidden) {
    colMenu.hidden = true; menuKey = null;
    hrow.querySelectorAll('.hmenu[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  if (!exportMenu.hidden) { exportMenu.hidden = true; $('#export-open').setAttribute('aria-expanded', 'false'); }
}
document.addEventListener('pointerdown', e => {
  if (!colMenu.hidden && !colMenu.contains(e.target) && !e.target.closest('.hmenu')) closePopovers();
  if (!exportMenu.hidden && !exportMenu.contains(e.target) && !e.target.closest('#export-open')) closePopovers();
});
window.addEventListener('resize', closePopovers);

// Search ----------------------------------------------------------------------------------------------------
searchInput.addEventListener('input', () => { state.search = searchInput.value; refreshSoon(); });
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { clearTimeout(refreshTimer); state.search = searchInput.value; refreshView(); }
  if (e.key === 'ArrowDown' && state.mode === 'grid') { e.preventDefault(); grid.focus(); }
});
$('#empty-clear').addEventListener('click', () => {
  state.filters = {}; state.search = ''; searchInput.value = '';
  refreshView(); searchInput.focus();
});

// Export --------------------------------------------------------------------------------------------------
function download(name, text) {
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function exportView() {
  const header = layout.cols.map(lc => lc.col.label);
  const data = state.view.map(i => layout.cols.map(lc => toPlain(lc.col, getValue(rows[i], lc.key))));
  download(`gridline-orders-${today()}.csv`, toCSV([header, ...data]));
  toast(`Exported ${plural(state.view.length, 'order')} with ${plural(layout.cols.length, 'column')}.`);
}
function exportChanges() {
  if (!model.changeCount) { toast('There are no changes to export yet.'); return; }
  download(`gridline-changes-${today()}.csv`, toCSV(model.changesTable()));
  toast(`Exported ${plural(model.changeCount, 'changed cell')}.`);
}

$('#export-open').addEventListener('click', () => {
  const wasOpen = !exportMenu.hidden;
  closePopovers();
  if (wasOpen) return;
  exportMenu.hidden = false;
  $('#export-open').setAttribute('aria-expanded', 'true');
  const ref = $('#export-open').getBoundingClientRect(), z = zoom();
  const w = exportMenu.offsetWidth;
  exportMenu.style.left = clamp(ref.right / z - w, 8, window.innerWidth / z - w - 8) + 'px';
  exportMenu.style.top = (ref.bottom / z + 6) + 'px';
  exportMenu.querySelector('button').focus();
});
exportMenu.addEventListener('keydown', e => {
  const items = [...exportMenu.querySelectorAll('button')];
  const i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  if (e.key === 'Escape') { e.preventDefault(); closePopovers(); $('#export-open').focus(); }
});
$('#export-view').addEventListener('click', () => { closePopovers(); exportView(); });
$('#export-changes-menu').addEventListener('click', () => { closePopovers(); exportChanges(); });

// Dialog helpers ---------------------------------------------------------------------------------------------
document.querySelectorAll('dialog').forEach(d => {
  d.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { d.close(); return; }
    if (e.target === d) {
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
    }
  });
});
function openDialog(d) { closePopovers(); if (state.editing) editor.blur(); d.showModal(); }

// Review changes ----------------------------------------------------------------------------------------------
const REVIEW_LIMIT = 300;
function renderReview() {
  const list = model.changes();
  const rowsTouched = new Set(list.map(c => c.id)).size;
  $('#review-sub').textContent = list.length ? `${plural(list.length, 'changed cell')} in ${plural(rowsTouched, 'order')}.` : 'No changes yet.';
  $('#revert-all').disabled = !list.length;
  $('#export-changes').disabled = !list.length;
  const box = $('#review-list');
  if (!list.length) { box.innerHTML = '<p>Edit a cell, paste or import a file and every change shows up here with its old and new value.</p>'; return; }
  const shown = list.slice(0, REVIEW_LIMIT);
  box.innerHTML = `<table class="tbl stack"><thead><tr><th scope="col">PO number</th><th scope="col">Column</th><th scope="col">Old value</th><th scope="col">New value</th><th scope="col"><span class="sr">Actions</span></th></tr></thead><tbody>${shown.map(ch => {
    const col = COLUMN_BY_KEY[ch.key];
    const o = formatValue(col, ch.old) || 'blank', nw = formatValue(col, ch.now) || 'blank';
    return `<tr data-id="${ch.id}" data-key="${ch.key}"><td><button type="button" class="mini link" data-goto aria-label="Show ${ch.id} in the grid">${ch.id}</button></td><td>${esc(col.label)}</td><td class="old"><span class="sr">Old value </span>${esc(o)}</td><td class="new"><span class="sr">New value </span>${esc(nw)}</td><td class="act-cell"><button type="button" class="mini" data-revert aria-label="Revert ${esc(col.label)} on ${ch.id}">Revert</button></td></tr>`;
  }).join('')}</tbody></table>${list.length > REVIEW_LIMIT ? `<p class="review-more">Showing the first ${formatInt(REVIEW_LIMIT)} of ${formatInt(list.length)} changes. Export changes to see every one.</p>` : ''}`;
}

$('#review-open').addEventListener('click', () => { renderReview(); openDialog($('#review')); });
$('#review-list').addEventListener('click', e => {
  const tr = e.target.closest('tr[data-id]');
  if (!tr) return;
  const { id, key } = tr.dataset;
  if (e.target.closest('[data-revert]')) {
    const next = tr.nextElementSibling || tr.previousElementSibling;
    const nextSel = next ? `tr[data-id="${next.dataset.id}"][data-key="${next.dataset.key}"] [data-revert]` : null;
    const b = model.revert([{ id, key }]);
    afterChange(b);
    toast(`Reverted ${COLUMN_BY_KEY[key].label} on ${id}.`);
    const f = nextSel && $('#review-list').querySelector(nextSel);
    (f || $('#review .dlg-x')).focus();
  } else if (e.target.closest('[data-goto]')) {
    const r = viewPos[rowIndex.get(id)];
    if (r < 0) { toast(`${id} is hidden by the current search or filters.`); return; }
    $('#review').close();
    if (state.mode === 'cards') { scrollCardsTo(r); return; }
    const c = colIndexOf(key);
    go(r, c >= 0 ? c : 0);
    grid.focus({ preventScroll: true });
  }
});
$('#revert-all').addEventListener('click', () => {
  const n = model.changeCount;
  const b = model.revertAll();
  afterChange(b);
  toast(`Reverted all ${plural(n, 'change')}. Undo brings them back.`);
  $('#review .dlg-x').focus();
});
$('#export-changes').addEventListener('click', exportChanges);

// Import --------------------------------------------------------------------------------------------------------
let importData = null, importPlan = null;
function loadImportText(text, name) {
  importData = null; importPlan = null;
  $('#import-name').textContent = name ? `File: ${name}` : '';
  const parsed = parseCSV(text);
  if (parsed.error || parsed.rows.length < 2) {
    $('#import-map').innerHTML = '';
    $('#import-result').innerHTML = `<p class="import-err">${esc(parsed.error || 'The file needs a header row and at least one data row.')}</p>`;
    $('#import-apply').disabled = true;
    return;
  }
  const headers = parsed.rows[0];
  importData = { headers, records: parsed.rows.slice(1), mapping: guessMapping(headers) };
  renderImportMap();
  renderImportPlan();
}

function renderImportMap() {
  const { headers, records, mapping } = importData;
  $('#import-map').innerHTML = `<div class="map-wrap"><table class="tbl"><thead><tr><th scope="col">Column in the file</th><th scope="col">First value</th><th scope="col">Maps to</th></tr></thead><tbody>${headers.map((h, i) => `<tr><th scope="row">${esc(h || 'Column ' + (i + 1))}</th><td class="ex">${esc(records[0][i] ?? '')}</td><td><select data-map="${i}" aria-label="Map ${esc(h || 'column ' + (i + 1))} to"><option value="">Ignore</option>${COLUMNS.map(c => `<option value="${c.key}"${mapping[i] === c.key ? ' selected' : ''}>${esc(c.label)}${c.readonly && c.key !== 'id' ? ', read only' : ''}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>`;
}

function renderImportPlan() {
  importPlan = model.planImport(importData.records, importData.mapping);
  const p = importPlan;
  const out = [];
  if (p.error) out.push(`<p class="import-err">${esc(p.error)}</p>`);
  else {
    out.push(`<div class="plan"><span class="good"><b>${formatInt(p.updatedRows)}</b> ${p.updatedRows === 1 ? 'row' : 'rows'} will change ${plural(p.changes.length, 'cell')}</span><span>${plural(p.unchangedRows, 'row')} already match</span><span class="${p.rejected.length ? 'bad' : ''}"><b>${formatInt(p.rejected.length)}</b> ${p.rejected.length === 1 ? 'row' : 'rows'} rejected</span>${p.ignoredColumns.length ? `<span>${plural(p.ignoredColumns.length, 'read only column')} ignored</span>` : ''}</div>`);
    if (p.rejected.length) {
      const shown = p.rejected.slice(0, 200);
      out.push(`<div class="err-wrap"><table class="tbl"><caption class="sr">Rejected rows</caption><thead><tr><th scope="col">Line</th><th scope="col">PO number</th><th scope="col">Problem</th></tr></thead><tbody>${shown.map(r => `<tr><td class="mono">${r.line}</td><td class="mono">${esc(r.id || 'none')}</td><td>${r.problems.map(x => esc(x.message + (x.value && !x.message.includes(x.value) ? ` The file has "${x.value}".` : ''))).join('<br>')}</td></tr>`).join('')}</tbody></table>${p.rejected.length > 200 ? `<p class="review-more">Showing the first 200 of ${formatInt(p.rejected.length)} rejected rows.</p>` : ''}</div>`);
    }
  }
  $('#import-result').innerHTML = out.join('');
  const btn = $('#import-apply');
  btn.disabled = !p.changes.length;
  btn.textContent = p.changes.length ? `Apply ${plural(p.changes.length, 'change')}` : 'Apply changes';
}

$('#import-map').addEventListener('change', e => {
  const s = e.target.closest('[data-map]');
  if (!s) return;
  const i = +s.dataset.map, v = s.value || null;
  if (v) importData.mapping = importData.mapping.map((k, j) => (k === v && j !== i ? null : k));
  importData.mapping[i] = v;
  renderImportMap();
  renderImportPlan();
  $(`#import-map [data-map="${i}"]`).focus();
});
$('#import-open').addEventListener('click', openImport);
$('#import-menu').addEventListener('click', openImport);
function openImport() {
  importData = null; importPlan = null;
  $('#import-file').value = '';
  $('#import-name').textContent = '';
  $('#import-map').innerHTML = ''; $('#import-result').innerHTML = '';
  $('#import-apply').disabled = true; $('#import-apply').textContent = 'Apply changes';
  openDialog($('#import'));
}
$('#import-file').addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (file.size > 15 * 1024 * 1024) { $('#import-result').innerHTML = '<p class="import-err">That file is larger than 15 MB. Split it and import the parts.</p>'; return; }
  loadImportText(await file.text(), file.name);
});
$('#import-sample').addEventListener('click', () => loadImportText(sampleImportCSV(rows), 'gridline-sample-import.csv'));
$('#sample-download').addEventListener('click', () => download('gridline-sample-import.csv', sampleImportCSV(rows)));
$('#import-apply').addEventListener('click', () => {
  if (!importPlan || !importPlan.changes.length) return;
  const p = importPlan;
  const b = model.apply(p.changes, 'Import');
  $('#import').close();
  afterChange(b);
  toast(`Imported ${plural(p.changes.length, 'change')} from ${plural(p.updatedRows, 'row')}.${p.rejected.length ? ` ${plural(p.rejected.length, 'row')} rejected.` : ''} Review changes shows each one.`);
  importPlan = null;
});

// Columns panel ---------------------------------------------------------------------------------------------------
function renderColumnsPanel() {
  const focusSel = document.activeElement && document.activeElement.closest('#col-list') ? ['data-vis', 'data-pin', 'data-up', 'data-down'].map(a => document.activeElement.hasAttribute(a) ? `[${a}="${document.activeElement.getAttribute(a)}"]` : '').find(Boolean) : null;
  const pinnedCount = state.cols.filter(c => c.pinned).length;
  $('#col-list').innerHTML = state.cols.map((c, i) => {
    const col = COLUMN_BY_KEY[c.key];
    const groupStart = c.pinned ? 0 : pinnedCount, groupEnd = c.pinned ? pinnedCount - 1 : state.cols.length - 1;
    return `<li><label class="chk"><input type="checkbox" data-vis="${c.key}"${c.hidden ? '' : ' checked'}><span>${esc(col.label)}</span></label>${c.pinned ? '<span class="pin-tag">Pinned</span>' : ''}<button type="button" class="mini${c.pinned ? ' on' : ''}" data-pin="${c.key}" aria-pressed="${c.pinned}" aria-label="Pin ${esc(col.label)}">Pin</button><button type="button" class="mini" data-up="${c.key}" aria-label="Move ${esc(col.label)} up"${i <= groupStart ? ' disabled' : ''}>↑</button><button type="button" class="mini" data-down="${c.key}" aria-label="Move ${esc(col.label)} down"${i >= groupEnd ? ' disabled' : ''}>↓</button></li>`;
  }).join('');
  if (focusSel) { const el = $('#col-list').querySelector(focusSel); if (el && !el.disabled) el.focus(); }
}
$('#columns-open').addEventListener('click', () => { renderColumnsPanel(); openDialog($('#columns')); });
$('#col-list').addEventListener('change', e => {
  const k = e.target.dataset.vis;
  if (!k) return;
  if (!setHidden(k, !e.target.checked)) e.target.checked = true;
});
$('#col-list').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.pin) { const c = state.cols.find(x => x.key === b.dataset.pin); setPinned(c.key, !c.pinned); }
  if (b.dataset.up || b.dataset.down) {
    const key = b.dataset.up || b.dataset.down;
    const i = state.cols.findIndex(c => c.key === key);
    const j = i + (b.dataset.up ? -1 : 1);
    if (j < 0 || j >= state.cols.length || state.cols[j].pinned !== state.cols[i].pinned) return;
    [state.cols[i], state.cols[j]] = [state.cols[j], state.cols[i]];
    columnsChanged();
  }
});
$('#columns-reset').addEventListener('click', () => { state.cols = defaultColumns(); columnsChanged(); toast('Columns are back to the default layout.'); });

// Saved views --------------------------------------------------------------------------------------------------------
function loadSaved() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.map(sanitizeView).filter(Boolean) : [];
  } catch { return []; }
}
function storeSaved(list) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); return true; } catch { return false; }
}
function renderViews() {
  const saved = loadSaved();
  viewsSelect.innerHTML = `<optgroup label="Built in">${BUILTIN.map(v => `<option value="b:${v.id}">${esc(v.name)}</option>`).join('')}</optgroup>` +
    (saved.length ? `<optgroup label="Saved in this browser">${saved.map(v => `<option value="u:${esc(v.name)}">${esc(v.name)}</option>`).join('')}</optgroup>` : '');
  viewsSelect.value = state.viewId;
  if (viewsSelect.value !== state.viewId) { state.viewId = 'b:all'; viewsSelect.value = 'b:all'; }
  $('#view-delete').disabled = !state.viewId.startsWith('u:');
}
function applyView(id) {
  let v;
  if (id.startsWith('b:')) { v = BUILTIN.find(x => x.id === id.slice(2)); if (v) v = { ...clone(v), columns: defaultColumns() }; }
  else v = loadSaved().find(x => x.name === id.slice(2));
  if (!v) { toast('That view could not be loaded.'); return; }
  state.viewId = id;
  state.filters = clone(v.filters); state.sort = clone(v.sort); state.search = v.search || '';
  searchInput.value = state.search;
  state.cols = clone(v.columns);
  relayout();
  refreshView();
  syncPhoneSort();
  $('#view-delete').disabled = !id.startsWith('u:');
}
viewsSelect.addEventListener('change', () => { applyView(viewsSelect.value); toast(`Showing the view ${viewsSelect.selectedOptions[0].textContent}.`); });
$('#view-save').addEventListener('click', () => {
  $('#view-name').value = state.viewId.startsWith('u:') ? state.viewId.slice(2) : '';
  openDialog($('#save-view'));
  $('#view-name').focus();
});
$('#save-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('#view-name').value.trim();
  if (!name) { $('#view-name').focus(); return; }
  const view = sanitizeView({ name, filters: state.filters, sort: state.sort, search: state.search, columns: state.cols });
  const list = loadSaved().filter(v => v.name !== view.name);
  list.push(view);
  const ok = storeSaved(list);
  $('#save-view').close();
  if (!ok) { toast('This browser blocked saving, so the view could not be stored.', [], 'warn'); return; }
  state.viewId = 'u:' + view.name;
  renderViews();
  toast(`Saved the view ${view.name}.`);
});
$('#view-delete').addEventListener('click', () => {
  if (!state.viewId.startsWith('u:')) return;
  const name = state.viewId.slice(2);
  storeSaved(loadSaved().filter(v => v.name !== name));
  state.viewId = 'b:all';
  renderViews();
  toast(`Deleted the view ${name}. The grid keeps its current filters.`);
});

// Shortcuts --------------------------------------------------------------------------------------------------------------
$('#shortcuts-open').addEventListener('click', () => openDialog($('#shortcuts')));

// Phone cards ------------------------------------------------------------------------------------------------------------
function renderCards(force = false) {
  if (state.mode !== 'cards') return;
  const n = state.view.length;
  cardsSizer.style.height = Math.max(0, n * CARD_H - 12) + 'px';
  // The page scrolls on phones, so the window is measured from the top of the list
  const listTop = cards.getBoundingClientRect().top;
  const top = Math.max(0, -listTop), h = window.innerHeight;
  const first = Math.max(0, Math.floor(top / CARD_H) - 4), last = Math.min(n - 1, Math.ceil((top + h) / CARD_H) + 4);
  if (!force && first === rendered.cardFirst && last === rendered.cardLast) return;
  rendered.cardFirst = first; rendered.cardLast = last;
  const hasChanges = model.changeCount > 0;
  let html = '';
  for (let i = first; i <= last; i++) {
    const r = rows[state.view[i]];
    const dirty = hasChanges && model.rowIsDirty(r.id);
    html += `<div role="listitem" class="card" aria-setsize="${n}" aria-posinset="${i + 1}" style="top:${i * CARD_H}px"><button type="button" class="card-btn${dirty ? ' dirty' : ''}" data-r="${i}" aria-label="${r.id}, ${esc(r.supplier)}, ${r.status}, total ${formatMoney(r.qty * r.unitCost)}${dirty ? ', edited' : ''}. Edit order">
      <span class="c-top"><b>${r.id}</b><span class="pill st-${r.status.toLowerCase()}">${r.status}</span></span>
      <span class="c-sup">${esc(r.supplier)}</span>
      <span class="c-item">${esc(r.item)}</span>
      <span class="c-meta"><span>${formatInt(r.qty)} at ${formatMoney(r.unitCost)}<br>Due ${r.dueDate} <span class="pri pr-${r.priority.toLowerCase()}">${r.priority}</span>${dirty ? ' <span class="edited">Edited</span>' : ''}</span><b>${formatMoney(r.qty * r.unitCost)}</b></span>
    </button></div>`;
  }
  cardsSizer.innerHTML = html;
}
let cardsRaf = 0;
window.addEventListener('scroll', () => {
  if (state.mode !== 'cards' || cardsRaf) return;
  cardsRaf = requestAnimationFrame(() => { cardsRaf = 0; renderCards(); });
}, { passive: true });
// Bring the top of the list into view, used after the filters or sort change on phones
function scrollCardsTo(index) {
  const y = window.scrollY + cards.getBoundingClientRect().top - 8 + index * CARD_H;
  if (index > 0 || window.scrollY > y) window.scrollTo(0, Math.max(0, y));
  renderCards(true);
}
cards.addEventListener('click', e => { const b = e.target.closest('.card-btn'); if (b) openCardEditor(+b.dataset.r); });

let cardEditing = null;
function openCardEditor(vi) {
  const row = rowAt(vi);
  cardEditing = { id: row.id, vi };
  const fields = COLUMNS.filter(c => !c.readonly).map(col => {
    const v = toPlain(col, row[col.key]);
    const id = 'ce-' + col.key;
    let control;
    if (col.type === 'enum') control = `<select id="${id}" name="${col.key}">${col.options.map(o => `<option${o === v ? ' selected' : ''}>${o}</option>`).join('')}</select>`;
    else control = `<input id="${id}" name="${col.key}" type="${col.type === 'date' ? 'date' : 'text'}" value="${esc(v)}" autocomplete="off"${col.type === 'int' ? ' inputmode="numeric"' : col.type === 'money' ? ' inputmode="decimal"' : ''} aria-describedby="${id}-err">`;
    const was = model.isDirty(row.id, col.key) ? `<p class="was">Was ${esc(formatValue(col, model.originalValue(row.id, col.key)) || 'blank')}</p>` : '';
    const full = ['supplier', 'item', 'notes'].includes(col.key) ? ' full' : '';
    return `<div class="ce-field${full}"><label for="${id}">${esc(col.label)}</label>${control}<p class="field-err" id="${id}-err"></p>${was}</div>`;
  }).join('');
  $('#card-form').innerHTML = `<div class="dlg-head"><div><h2 id="card-title">${row.id}</h2><p class="muted">${esc(row.supplier)}</p></div><button type="button" class="dlg-x" data-close aria-label="Close without saving">&times;</button></div>
    <div class="ce-grid">${fields}</div>
    <p class="ce-total">Total <b>${formatMoney(row.qty * row.unitCost)}</b>, worked out from Qty and Unit cost.</p>
    <div class="dlg-foot"><button type="button" class="btn line" data-close>Cancel</button><button type="submit" class="btn primary">Save changes</button></div>`;
  openDialog($('#card-edit'));
}
$('#card-form').addEventListener('submit', e => {
  e.preventDefault();
  if (!cardEditing) return;
  const row = model.byId.get(cardEditing.id);
  const form = $('#card-form');
  // Look fields up by id: form.elements['item'] would return the collection's item() method
  const field = key => form.querySelector('#ce-' + key);
  const edits = [];
  for (const col of COLUMNS) {
    if (col.readonly) continue;
    const el = field(col.key);
    el.removeAttribute('aria-invalid');
    $('#ce-' + col.key + '-err').textContent = '';
    if (el.value !== toPlain(col, row[col.key])) edits.push({ id: row.id, key: col.key, raw: el.value });
  }
  const { changes, errors } = model.propose(edits);
  if (errors.length) {
    errors.forEach(er => { field(er.key).setAttribute('aria-invalid', 'true'); $('#ce-' + er.key + '-err').textContent = er.message; });
    field(errors[0].key).focus();
    return;
  }
  const b = model.apply(changes, `Edit ${row.id}`);
  $('#card-edit').close();
  afterChange(b);
  toast(changes.length ? `Saved ${plural(changes.length, 'change')} to ${row.id}.` : 'Nothing changed.');
});

// Phone filters and sort
const PHONE_SORTS = [
  ['none', 'Original order', []],
  ['due-asc', 'Due date, soonest first', [{ key: 'dueDate', dir: 1 }]],
  ['due-desc', 'Due date, latest first', [{ key: 'dueDate', dir: -1 }]],
  ['total-desc', 'Total, largest first', [{ key: 'total', dir: -1 }]],
  ['total-asc', 'Total, smallest first', [{ key: 'total', dir: 1 }]],
  ['ordered-desc', 'Ordered, newest first', [{ key: 'orderDate', dir: -1 }]],
  ['supplier-asc', 'Supplier, A to Z', [{ key: 'supplier', dir: 1 }]],
  ['status-asc', 'Status, workflow order', [{ key: 'status', dir: 1 }]],
  ['priority-desc', 'Priority, rush first', [{ key: 'priority', dir: -1 }]]
];
function syncPhoneSort() {
  const sel = $('#phone-sort');
  const cur = JSON.stringify(state.sort);
  const hit = PHONE_SORTS.find(p => JSON.stringify(p[2]) === cur);
  sel.innerHTML = PHONE_SORTS.map(p => `<option value="${p[0]}">${p[1]}</option>`).join('') + (hit ? '' : '<option value="custom">Custom sort from a saved view</option>');
  sel.value = hit ? hit[0] : 'custom';
}
$('#phone-sort').addEventListener('change', e => {
  const p = PHONE_SORTS.find(x => x[0] === e.target.value);
  if (!p) return;
  state.sort = clone(p[2]);
  refreshView();
  syncPhoneSort();
});

const PHONE_FILTERS = ['status', 'priority', 'warehouse', 'category', 'dueDate', 'orderDate', 'total', 'qty', 'supplier', 'buyer'];
function renderPhoneFilters() {
  const bodyEl = $('#filters-body');
  bodyEl.innerHTML = '';
  for (const key of PHONE_FILTERS) {
    const d = document.createElement('details');
    d.className = 'fgroup';
    d.dataset.key = key;
    const on = isFilterActive(state.filters[key]);
    d.open = on;
    d.innerHTML = `<summary>${esc(COLUMN_BY_KEY[key].label)}<span class="on">${on ? 'Filtered' : ''}</span></summary>`;
    d.append(filterControls(key));
    bodyEl.append(d);
  }
  updatePhoneFilterSummary();
}
function updatePhoneFilterSummary() {
  if (!$('#filters').open) return;
  $('#filters-sub').textContent = `${formatInt(state.view.length)} of ${formatInt(rows.length)} orders match.`;
  $('#filters-body').querySelectorAll('details.fgroup').forEach(d => { d.querySelector('.on').textContent = isFilterActive(state.filters[d.dataset.key]) ? 'Filtered' : ''; });
}
$('#filters-open').addEventListener('click', () => { openDialog($('#filters')); renderPhoneFilters(); });
$('#filters-clear').addEventListener('click', () => { state.filters = {}; refreshView(); renderPhoneFilters(); });
// Typed filters refresh after a short delay, so update the sheet summary once the view is ready.
new MutationObserver(updatePhoneFilterSummary).observe($('#row-count'), { childList: true, characterData: true, subtree: true });

// Mode -----------------------------------------------------------------------------------------------------------------------
const phoneQuery = window.matchMedia('(max-width: 640px)');
function setMode() {
  const mode = phoneQuery.matches ? 'cards' : 'grid';
  if (mode === state.mode) return;
  if (state.editing) cancelEdit();
  closePopovers();
  applyModeAttrs(mode);
  rendered = { first: -1, last: -1 };
  renderAll();
}
function applyModeAttrs(mode) {
  state.mode = mode;
  document.body.dataset.mode = mode;
  searchInput.placeholder = mode === 'cards' ? 'Search orders' : 'Search PO, supplier, item, SKU or buyer';
}
phoneQuery.addEventListener('change', setMode);

// Start ------------------------------------------------------------------------------------------------------------------------
function init() {
  $('#datalists').innerHTML = COLUMNS.filter(c => c.type === 'enum').map(c => `<datalist id="dl-${c.key}">${c.options.map(o => `<option value="${o}"></option>`).join('')}</datalist>`).join('');
  applyModeAttrs(phoneQuery.matches ? 'cards' : 'grid');
  relayout();
  renderViews();
  syncPhoneSort();
  refreshView();
  document.documentElement.dataset.ready = 'true';
}
init();
