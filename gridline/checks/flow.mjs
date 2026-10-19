// End-to-end flow check for Gridline. Drives the real page in headless Brave.
// Usage: node checks/flow.mjs [baseUrl]   (serve the gridline folder, default http://127.0.0.1:8931/)
// Writes checks/flow-results.json and checks/perf-results.json.
import { launch, sleep, checker } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] || 'http://127.0.0.1:8931/';
const C = checker('Gridline flow');
const ok = C.ok;
const perf = {};

const p = await launch({ width: 1440, height: 900 });
const q = expr => p.eval(expr);
const wait = ms => sleep(ms);
const waitFor = async (expr, ms = 3000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await q(expr)) return true; await sleep(60); } return false; };
const colIdx = label => q(`[...document.querySelectorAll('#hrow .hcell')].findIndex(h => h.querySelector('.hlabel').textContent === ${JSON.stringify(label)})`);
const cell = (r, c) => q(`(document.getElementById('g${r}_${c}') || {}).textContent ?? null`);
const cellHas = (r, c, cls) => q(`!!document.getElementById('g${r}_${c}')?.classList.contains(${JSON.stringify(cls)})`);
const count = () => q(`document.getElementById('row-count').textContent`);
const changes = () => q(`+document.getElementById('change-count').textContent.replace(/,/g, '')`);
const toastText = () => q(`document.getElementById('toast').hidden ? '' : document.getElementById('toast').innerText`);
const activeId = () => q(`document.getElementById('grid').getAttribute('aria-activedescendant')`);
const fmt = n => n.toLocaleString('en-US');
// Independent expectation: fresh data from the core module, same spec, counted in the page
const expectCount = (spec, patch = '') => q(`(async () => { const c = await import('./src/core.mjs'); const rows = c.generateRows(); ${patch}; return c.computeView(rows, ${JSON.stringify(spec)}).length; })()`);
const clickCell = async (r, c, opts) => { await q(`document.getElementById('g${r}_${c}')?.scrollIntoView({block:'nearest'})`); await p.click(`#g${r}_${c}`, opts); };
const focusCell = async (r, c) => { await clickCell(r, c); };
// Remove every filter, search and sort chip one at a time, the way a user would
const clearChips = async () => { for (let i = 0; i < 12; i++) { const has = await q(`!!document.querySelector('#chips .chip:not(.warn)')`); if (!has) break; await p.click('#chips .chip:not(.warn)'); } };

try {
  await p.goto(base);

  // Load and virtualization ------------------------------------------------------------------
  ok(await count() === '20,000 orders', 'loads 20,000 orders', await count());
  const domRows = await q(`document.querySelectorAll('#body .row').length`);
  ok(domRows > 10 && domRows < 60, `only visible rows are in the DOM (${domRows} rows)`, domRows);
  ok(await q(`(() => { const g = document.getElementById('grid'); return g.getAttribute('role') === 'grid' && g.getAttribute('aria-rowcount') === '20001' && g.getAttribute('aria-colcount') === '15' && g.getAttribute('aria-multiselectable') === 'true'; })()`), 'grid has ARIA grid role, row count 20001 and 15 columns');
  ok(await q(`document.querySelectorAll('#body [role=row] [role=gridcell]').length > 0 && document.querySelectorAll('#hrow [role=columnheader]').length === 15`), 'rows hold gridcells and the header holds 15 columnheaders');
  ok(await q(`/fictional sample data/.test(document.querySelector('.note').textContent)`), 'page states the data is fictional sample data');
  await q(`(() => { const g = document.getElementById('grid'); g.scrollTop = g.scrollHeight; })()`);
  await wait(250);
  ok(await q(`[...document.querySelectorAll('#body .row')].some(r => r.textContent.includes('PO-260000'))`), 'scrolling to the end renders the last order PO-260000');
  ok(await q(`document.querySelectorAll('#body .row').length < 60`), 'DOM stays small after scrolling to the end');
  await q(`document.getElementById('grid').scrollTop = 0`);
  await wait(150);

  // Keyboard navigation -------------------------------------------------------------------------
  await clickCell(0, 1);
  ok(await q(`document.activeElement.id`) === 'grid' && await activeId() === 'g0_1', 'clicking a cell focuses the grid and sets the active cell', await activeId());
  await p.key('ArrowDown'); await p.key('ArrowRight');
  ok(await activeId() === 'g1_2', 'arrow keys move the active cell', await activeId());
  await p.key('End', { ctrl: true });
  await wait(120);
  ok(await activeId() === 'g19999_14' && await q(`!!document.getElementById('g19999_14')`), 'Ctrl+End jumps to the last cell and it is rendered', await activeId());
  await p.key('Home', { ctrl: true });
  await wait(120);
  ok(await activeId() === 'g0_0', 'Ctrl+Home jumps to the first cell');
  ok(await q(`document.getElementById('grid').scrollLeft`) === 0, 'Ctrl+Home also scrolls back to the first column');
  await p.key('ArrowUp');
  ok(await activeId() === 'gh_0', 'ArrowUp from the first row reaches the header row');
  await p.key('Enter');
  ok(await q(`document.getElementById('gh_0').getAttribute('aria-sort')`) === 'ascending', 'Enter on a header sorts by that column');
  await p.key('Enter');
  ok(await q(`document.getElementById('gh_0').getAttribute('aria-sort')`) === 'descending', 'Enter again reverses the sort');
  ok(await cell(0, 0) === 'PO-260000', 'descending PO sort puts PO-260000 first');
  await p.key('Enter');
  ok(await q(`!document.getElementById('gh_0').hasAttribute('aria-sort')`), 'a third Enter clears the sort');
  await p.key('ArrowDown');
  await p.key('ArrowDown', { alt: true });
  ok(await q(`!document.getElementById('colmenu').hidden && document.activeElement.closest('#colmenu') !== null`), 'Alt+ArrowDown opens the column menu with focus inside');
  await p.key('Escape');
  ok(await q(`document.getElementById('colmenu').hidden && document.activeElement.id === 'grid'`), 'Escape closes the menu and returns focus to the grid');

  // Sort by clicking headers ---------------------------------------------------------------------
  const totalC = await colIdx('Total'), statusC = await colIdx('Status'), qtyC = await colIdx('Qty'), unitC = await colIdx('Unit cost'), supplierC0 = await colIdx('Supplier');
  await p.click(`#gh_${totalC} .hlabel`);
  ok(await q(`document.getElementById('gh_${totalC}').getAttribute('aria-sort')`) === 'ascending', 'clicking Total sorts ascending');
  const totals = await q(`[...document.querySelectorAll('#body .row')].slice(0, 25).map(r => +r.children[${totalC}].textContent.replace(/[$,]/g, ''))`);
  ok(totals.every((v, i) => !i || totals[i - 1] <= v), 'rendered totals are in ascending order', totals.slice(0, 6));
  const t0 = Date.now();
  await p.click(`#gh_${statusC} .hlabel`, { shift: true });
  ok(await q(`document.querySelector('#gh_${statusC} .sort-ind').textContent`) === '↑2', 'Shift+click adds Status as the second sort');
  ok(/Sorted by Total, smallest first, then Status, in list order/.test(await q(`document.getElementById('chips').textContent`)), 'sort chip describes both sort keys');
  const sorted = await q(`[...document.querySelectorAll('#body .row')].slice(0, 25).map(r => [+r.children[${totalC}].textContent.replace(/[$,]/g, ''), r.children[${statusC}].textContent])`);
  ok(sorted.every((v, i) => !i || sorted[i - 1][0] <= v[0]), 'primary sort still holds after adding a secondary sort');
  await p.click('#chips [data-clear="sort"]');
  ok(await q(`!document.querySelector('#hrow [aria-sort]')`) && await cell(0, 0) === 'PO-240001', 'the sort chip clears the sort and restores the original order');

  // Filters ----------------------------------------------------------------------------------------
  await p.click(`#gh_${statusC} .hmenu`);
  ok(await q(`!document.getElementById('colmenu').hidden`), 'the column menu opens from the header button');
  await p.click('#colmenu [data-none]');
  ok(await count() === '0 of 20,000 orders' && await q(`!document.getElementById('empty').hidden`), 'selecting no status shows zero orders and the empty state');
  await p.click('#colmenu input[value="Shipped"]');
  const expShipped = await expectCount({ filters: { status: { kind: 'enum', values: ['Shipped'] } } });
  ok(await count() === `${fmt(expShipped)} of 20,000 orders`, `enum filter shows ${fmt(expShipped)} shipped orders, matching an independent count`, await count());
  ok(await q(`[...document.querySelectorAll('#body .row')].every(r => r.children[${statusC}].textContent === 'Shipped')`), 'every rendered row is Shipped');
  await p.key('Escape');

  await p.click(`#gh_${qtyC} .hmenu`);
  await p.click('#colmenu [data-min]'); await p.type('100');
  await p.click('#colmenu [data-max]'); await p.type('200');
  await wait(400);
  const expQty = await expectCount({ filters: { status: { kind: 'enum', values: ['Shipped'] }, qty: { kind: 'range', min: 100, max: 200 } } });
  ok(await count() === `${fmt(expQty)} of 20,000 orders`, `number range filter Qty 100 to 200 gives ${fmt(expQty)}`, await count());
  await p.key('Escape');

  const dueC = await colIdx('Due');
  await p.click(`#gh_${dueC} .hmenu`);
  await q(`(() => { const a = document.querySelector('#colmenu [data-from]'), b = document.querySelector('#colmenu [data-to]'); a.value = '2026-01-01'; b.value = '2026-06-30'; b.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await wait(200);
  const spec3 = { filters: { status: { kind: 'enum', values: ['Shipped'] }, qty: { kind: 'range', min: 100, max: 200 }, dueDate: { kind: 'date', from: '2026-01-01', to: '2026-06-30' } } };
  const expDate = await expectCount(spec3);
  ok(await count() === `${fmt(expDate)} of 20,000 orders`, `date range filter narrows to ${fmt(expDate)}`, await count());
  await p.key('Escape');
  const chipTexts = await q(`[...document.querySelectorAll('#chips .chip')].map(c => c.textContent.trim())`);
  ok(chipTexts.includes('Status: Shipped') && chipTexts.includes('Qty 100 to 200') && chipTexts.includes('Due 2026-01-01 to 2026-06-30'), 'filter bar shows one chip per filter', chipTexts);
  ok(await q(`document.querySelectorAll('#hrow .hcell.filtered').length`) === 3, 'filtered columns are marked in the header');
  await p.click('#chips [data-clear="f:qty"]');
  const expNoQty = await expectCount({ filters: { status: spec3.filters.status, dueDate: spec3.filters.dueDate } });
  ok(await count() === `${fmt(expNoQty)} of 20,000 orders`, 'removing the Qty chip clears only that filter', await count());

  await p.click('#search'); await p.type('harlow');
  await wait(450);
  const expSearch = await expectCount({ filters: { status: spec3.filters.status, dueDate: spec3.filters.dueDate }, search: 'harlow' });
  ok(await count() === `${fmt(expSearch)} of 20,000 orders` && expSearch > 0, `global search combines with filters, ${fmt(expSearch)} orders`, await count());
  ok(await q(`[...document.querySelectorAll('#chips .chip')].some(c => c.textContent.includes('Search "harlow"'))`), 'search shows as a chip');
  await p.click('#chips [data-clear="all"]');
  ok(await count() === '20,000 orders' && await q(`document.getElementById('search').value`) === '', 'Clear all removes search, filters and sort');

  // Editing --------------------------------------------------------------------------------------------
  const q0 = await cell(0, qtyC), unit0 = await cell(0, unitC);
  await focusCell(0, qtyC);
  await p.key('Enter');
  ok(await q(`!document.getElementById('editor').hidden && document.activeElement.id === 'editor'`), 'Enter opens the inline editor');
  ok(await q(`document.getElementById('editor').value`) === q0.replace(/,/g, ''), 'editor starts with the plain cell value');
  await q(`document.getElementById('editor').select()`);
  await p.type('abc');
  await p.key('Enter');
  ok(await q(`!document.getElementById('edit-error').hidden && /whole number/.test(document.getElementById('edit-error').textContent)`), 'an invalid edit shows the reason', await q(`document.getElementById('edit-error').textContent`));
  ok(await q(`document.getElementById('editor').getAttribute('aria-invalid')`) === 'true' && !(await q(`document.getElementById('editor').hidden`)), 'the editor stays open and is marked invalid');
  await p.key('Escape');
  ok(await cell(0, qtyC) === q0 && await changes() === 0, 'Escape cancels and the invalid value is not committed');
  await p.key('2'); await p.type('50'); await p.key('Enter');
  ok(await cell(0, qtyC) === '250', 'typing a digit starts an edit and Enter commits it', await cell(0, qtyC));
  ok(await cellHas(0, qtyC, 'dirty') && await changes() === 1, 'the edited cell is highlighted and counted as a change');
  const unitCents = Math.round(+unit0.replace(/[$,]/g, '') * 100);
  ok(await cell(0, totalC) === '$' + (250 * unitCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }), 'Total recalculates from the new Qty', await cell(0, totalC));
  ok(await activeId() === `g1_${qtyC}`, 'Enter moves to the next row after saving');
  await p.key('z', { ctrl: true });
  ok(await cell(0, qtyC) === q0 && await changes() === 0 && !(await cellHas(0, qtyC, 'dirty')), 'Ctrl+Z undoes the edit and clears the highlight');
  await p.key('y', { ctrl: true });
  ok(await cell(0, qtyC) === '250' && await changes() === 1, 'Ctrl+Y redoes it');
  await p.click('#undo');
  ok(await cell(0, qtyC) === q0, 'the Undo button works');
  await p.click('#redo');
  ok(await cell(0, qtyC) === '250', 'the Redo button works');
  const dueBefore = await cell(2, dueC);
  await focusCell(2, dueC);
  await p.key('F2');
  await q(`document.getElementById('editor').select()`);
  await p.type('2020-01-02'); await p.key('Enter');
  ok(/before the order date/.test(await q(`document.getElementById('edit-error').textContent`)), 'cross-field rule blocks a due date before the order date');
  await p.key('Escape');
  ok(await cell(2, dueC) === dueBefore, 'the blocked date was not saved');
  const statusBefore = await cell(3, statusC);
  await focusCell(3, statusC);
  await p.key('F2');
  await q(`document.getElementById('editor').select()`);
  await p.type('Lost'); await p.key('Tab');
  ok(/must be one of Draft/.test(await q(`document.getElementById('edit-error').textContent`)) && await cell(3, statusC) === statusBefore, 'enum validation lists the allowed values and blocks the edit');
  await q(`document.getElementById('editor').select()`);
  await p.type('cancelled'); await p.key('Tab');
  ok(await cell(3, statusC) === 'Cancelled' && await activeId() === `g3_${statusC + 1}`, 'enum input is case-insensitive and Tab saves and moves right');

  // Mouse: drag to select, Shift+click to extend, double-click to edit
  await q(`document.getElementById('grid').scrollLeft = 0`);
  await wait(80);
  const a = await p.center(`#g2_${qtyC}`), b = await p.center(`#g6_${totalC}`);
  await p.mouse('mousePressed', a.x, a.y);
  await p.mouse('mouseMoved', (a.x + b.x) / 2, (a.y + b.y) / 2); await p.mouse('mouseMoved', b.x, b.y);
  await p.mouse('mouseReleased', b.x, b.y);
  await wait(80);
  ok(await q(`document.querySelectorAll('#body .cell.sel').length`) === 15 && await activeId() === `g6_${totalC}`, 'dragging with the mouse selects a 5 by 3 range');
  await clickCell(9, unitC, { shift: true });
  ok(await q(`document.querySelectorAll('#body .cell.sel').length`) === 16 && await activeId() === `g9_${unitC}`, 'Shift+click extends the range from the anchor', await q(`document.querySelectorAll('#body .cell.sel').length`));
  await clickCell(4, supplierC0, { clickCount: 2 });
  ok(await q(`!document.getElementById('editor').hidden && document.getElementById('editor').getAttribute('aria-label')`) === `Supplier for ${await cell(4, 0)}`, 'double-click opens the editor on that cell');
  await p.key('Escape');

  // Range selection, summary and copy -----------------------------------------------------------------------
  await focusCell(0, qtyC);
  for (let i = 0; i < 3; i++) await p.key('ArrowDown', { shift: true });
  await p.key('ArrowRight', { shift: true }); await p.key('ArrowRight', { shift: true });
  ok(await q(`document.querySelectorAll('#body .cell.sel').length`) === 12, 'Shift+arrows select a 4 by 3 range');
  const qtys = await q(`[0,1,2,3].map(r => +document.getElementById('g' + r + '_${qtyC}').textContent.replace(/,/g, ''))`);
  const sumQ = qtys.reduce((a, b) => a + b, 0);
  const qtySummary = await q(`(() => { const s = document.querySelector('#summary [data-key="qty"]'); return s && { count: s.querySelector('[data-stat=count]').textContent, sum: s.querySelector('[data-stat=sum]').textContent }; })()`);
  ok(qtySummary && qtySummary.count === '4' && qtySummary.sum === fmt(sumQ), `footer shows count 4 and sum ${fmt(sumQ)} for the Qty range`, qtySummary);
  ok(await q(`/12\\s*cells selected/.test(document.getElementById('summary').textContent) && !!document.querySelector('#summary [data-key="total"]') && !!document.querySelector('#summary [data-key="unitCost"]')`), 'footer summarizes every numeric column in the range');
  const copied = await q(`(() => { const dt = new DataTransfer(); document.getElementById('grid').dispatchEvent(new ClipboardEvent('copy', { clipboardData: dt, bubbles: true, cancelable: true })); return dt.getData('text/plain'); })()`);
  const lines = copied.split('\n');
  ok(lines.length === 4 && lines.every(l => l.split('\t').length === 3) && lines[0].split('\t')[0] === '250', 'copy writes the range as TSV with plain values', copied.slice(0, 80));
  // Headless Brave does not deliver Ctrl+C, Ctrl+V or Ctrl+X key events through CDP, so these
  // shortcuts are sent as in-page KeyboardEvents. The system clipboard is never touched.
  const ctrlKey = k => q(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: '${k}', ctrlKey: true, bubbles: true, cancelable: true }))`);
  await ctrlKey('c');
  ok(await q(`document.getElementById('clip').value`) === copied, 'Ctrl+C puts the same TSV in the hidden copy buffer for the browser to copy', await q(`document.getElementById('clip').value`));
  await wait(50);
  ok(await q(`document.activeElement.id`) === 'grid', 'focus returns to the grid after copy');

  // Paste ------------------------------------------------------------------------------------------------------
  const unit6 = await cell(6, unitC);
  await focusCell(5, qtyC);
  await q(`(() => { const dt = new DataTransfer(); dt.setData('text/plain', '11\\t2.50\\n12\\tabc\\n13\\t3.75\\n'); document.getElementById('grid').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); })()`);
  await wait(80);
  ok(await cell(5, qtyC) === '11' && await cell(6, qtyC) === '12' && await cell(7, qtyC) === '13', 'paste fills a 3 by 2 block from the active cell');
  ok(await cell(5, unitC) === '$2.50' && await cell(7, unitC) === '$3.75' && await cell(6, unitC) === unit6, 'the invalid pasted value is skipped and the rest are applied');
  ok(/Pasted 5 cells\. 1 cell skipped/.test(await toastText()) && /Unit cost must be an amount/.test(await toastText()), 'paste reports the skipped cell and why', await toastText());
  const afterPaste = await changes();
  await p.key('z', { ctrl: true });
  ok(await changes() === afterPaste - 5 && await cell(5, qtyC) !== '11' && await cell(7, unitC) !== '$3.75', 'one undo reverts the whole paste');
  await p.key('y', { ctrl: true });
  ok(await changes() === afterPaste, 'redo reapplies the whole paste');
  // Ctrl+V path: the grid hands focus to the hidden buffer, the browser pastes there, the grid applies it
  await focusCell(8, qtyC);
  await ctrlKey('v');
  ok(await q(`document.activeElement.id`) === 'clip', 'Ctrl+V moves focus to the paste buffer');
  await q(`(() => { const dt = new DataTransfer(); dt.setData('text/plain', '31'); document.getElementById('clip').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); })()`);
  ok(await cell(8, qtyC) === '31' && await q(`document.activeElement.id`) === 'grid', 'the pasted value lands in the active cell and focus returns to the grid');
  await p.key('z', { ctrl: true });
  // One value pasted over a range fills the whole range
  await focusCell(15, qtyC);
  await p.key('ArrowDown', { shift: true }); await p.key('ArrowDown', { shift: true });
  await q(`(() => { const dt = new DataTransfer(); dt.setData('text/plain', '9'); document.getElementById('grid').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); })()`);
  ok(await cell(15, qtyC) === '9' && await cell(16, qtyC) === '9' && await cell(17, qtyC) === '9', 'one pasted value fills every selected cell');
  await p.key('z', { ctrl: true });
  ok(await changes() === afterPaste, 'undo brings the count back after the extra pastes');

  // Fill down --------------------------------------------------------------------------------------------------
  await focusCell(10, qtyC);
  const top10 = await cell(10, qtyC);
  for (let i = 0; i < 4; i++) await p.key('ArrowDown', { shift: true });
  await p.key('d', { ctrl: true });
  ok((await Promise.all([11, 12, 13, 14].map(r => cell(r, qtyC)))).every(v => v === top10), 'Ctrl+D fills the top value down the selection');
  const afterFill = await changes();
  await p.key('z', { ctrl: true });
  ok((await Promise.all([11, 12, 13, 14].map(r => cell(r, qtyC)))).some(v => v !== top10), 'undo reverts the fill down');
  await p.key('y', { ctrl: true });
  ok(await changes() === afterFill, 'redo reapplies the fill down');

  // Delete clears optional cells and refuses required ones
  const notesC = await colIdx('Notes'), supplierC = await colIdx('Supplier');
  await focusCell(20, supplierC);
  await p.key('Delete');
  ok(/Supplier is required/.test(await toastText()) && (await cell(20, supplierC)).length > 0, 'Delete refuses to clear a required cell and says why');

  // Review panel ------------------------------------------------------------------------------------------------
  const n0 = await changes();
  await p.click('#review-open');
  ok(await q(`document.getElementById('review').open`), 'Review changes opens');
  ok(await q(`document.querySelectorAll('#review-list tbody tr').length`) === n0, `review lists all ${n0} changed cells`);
  const firstRow = await q(`(() => { const tr = document.querySelector('#review-list tbody tr'); return [...tr.children].slice(0, 4).map(td => td.textContent.replace(/^(Old|New) value /, '')); })()`);
  ok(firstRow[0] === 'PO-240001' && firstRow[1] === 'Qty' && firstRow[2] === q0 && firstRow[3] === '250', 'diff shows row ID, column, old and new value', firstRow);
  await p.click('#review-list tbody tr [data-revert]');
  ok(await changes() === n0 - 1 && await q(`document.querySelectorAll('#review-list tbody tr').length`) === n0 - 1, 'revert one change removes it from the list');
  ok(await cell(0, qtyC) === q0, 'the reverted cell shows its original value in the grid');
  await p.click('#revert-all');
  ok(await changes() === 0 && /No changes yet/.test(await q(`document.getElementById('review-sub').textContent`)), 'Revert all clears every change');
  await p.key('z', { ctrl: true });
  ok(await changes() === n0 - 1, 'Revert all can be undone');
  await p.click('#review [data-close]');
  ok(!(await q(`document.getElementById('review').open`)), 'review closes');

  // CSV export ------------------------------------------------------------------------------------------------------
  await q(`window.__dl = []; HTMLAnchorElement.prototype.click = function () { if (this.download) window.__dl.push({ name: this.download, href: this.href }); }; URL.revokeObjectURL = () => {};`);
  const lastDownload = () => q(`(async () => { const d = window.__dl[window.__dl.length - 1]; if (!d) return null; const t = await (await fetch(d.href)).text(); return { name: d.name, text: t.replace(/^\\uFEFF/, '') }; })()`);
  await p.click('#export-open');
  ok(await q(`!document.getElementById('export-menu').hidden`), 'Export opens a menu');
  await p.click('#export-view');
  let dl = await lastDownload();
  const csvRows = dl ? (await q(`(async () => { const c = await import('./src/core.mjs'); return c.parseCSV(${JSON.stringify(dl.text)}).rows; })()`)) : [];
  ok(dl && /^gridline-orders-\d{4}-\d{2}-\d{2}\.csv$/.test(dl.name) && csvRows.length === 20001 && csvRows[0].length === 15 && csvRows[0][0] === 'PO number', 'export current view writes 20,000 rows and 15 columns', dl && { name: dl.name, rows: csvRows.length });
  ok(csvRows[1] && csvRows[1][0] === 'PO-240001' && csvRows[1][csvRows[0].indexOf('Unit cost')] === unit0.replace(/[$,]/g, ''), 'exported money is a plain decimal');
  await p.click(`#gh_${statusC} .hmenu`);
  await p.click('#colmenu [data-none]'); await p.click('#colmenu input[value="Draft"]');
  await p.key('Escape');
  const draftCount = +(await count()).split(' ')[0].replace(/,/g, '');
  await p.click('#export-open'); await p.click('#export-view');
  dl = await lastDownload();
  ok(dl.text.trim().split('\r\n').length === draftCount + 1, `export follows the current filter, ${draftCount} draft orders`);
  await p.click('#export-open'); await p.click('#export-changes-menu');
  dl = await lastDownload();
  const chLines = dl.text.trim().split('\r\n');
  ok(/^gridline-changes-/.test(dl.name) && chLines[0] === 'PO number,Column,Old value,New value' && chLines.length === (await changes()) + 1, 'export changes only writes one line per changed cell', chLines.slice(0, 2));
  await clearChips();

  // CSV import --------------------------------------------------------------------------------------------------------
  const before = await changes();
  await p.click('#import-open');
  await p.click('#import-sample');
  ok(await q(`document.querySelectorAll('#import-map select').length`) === 6 && await q(`[...document.querySelectorAll('#import-map select')].every(s => s.value)`), 'sample file maps all six columns automatically');
  const rej = await q(`[...document.querySelectorAll('#import-result .err-wrap tbody tr')].map(tr => [tr.children[0].textContent, tr.children[2].textContent])`);
  ok(rej.length === 4 && rej.map(r => r[0]).join() === '18,19,20,21', 'row-level error report lists 4 rejected lines', rej);
  ok(/not in this order list/.test(rej[0][1]) && /whole number/.test(rej[1][1]) && /before the order date/.test(rej[2][1]) && /one of/.test(rej[3][1]), 'each rejected row says why');
  const applyLabel = await q(`document.getElementById('import-apply').textContent`);
  const planned = +applyLabel.match(/\d+/)[0];
  await p.click('#import-apply');
  const afterImport = await changes();
  // Some imported cells may already be edited, so the count can grow by less than the planned number
  ok(!(await q(`document.getElementById('import').open`)) && afterImport > before && afterImport <= before + planned, `applying the import changes ${planned} cells`, [before, planned, afterImport]);
  ok(await cell(12, await colIdx('Notes')) === 'Updated from supplier confirmation' && await cell(12, statusC) === 'Approved', 'an imported row shows its new values in the grid');
  await p.key('z', { ctrl: true });
  ok(await changes() === before, 'the whole import undoes in one step');
  await p.key('y', { ctrl: true });
  await p.click('#import-open');
  await q(`(() => { const dt = new DataTransfer(); dt.items.add(new File(['PO number;Quantity\\nPO-240100;77\\nPO-240101;0\\n'], 'semicolon.csv', { type: 'text/csv' })); const i = document.getElementById('import-file'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await waitFor(`!document.getElementById('import-apply').disabled`);
  ok(/1 row rejected/.test(await q(`document.getElementById('import-result').textContent`)) && await q(`document.getElementById('import-apply').textContent`) === 'Apply 1 change', 'a semicolon CSV from a file input is parsed and checked');
  await p.click('#import [data-close]');

  // Columns: pin, hide, resize, reorder ----------------------------------------------------------------------------------
  await p.click(`#gh_${supplierC} .hmenu`);
  await p.click('#colmenu [data-act="pin"]');
  ok(await q(`document.getElementById('gh_1').classList.contains('pin') && document.querySelector('#gh_1 .hlabel').textContent === 'Supplier'`), 'pinning Supplier moves it into the pinned group');
  await q(`document.getElementById('grid').scrollLeft = 700`);
  await wait(150);
  const pinLeft = await q(`document.getElementById('gh_1').getBoundingClientRect().left - document.getElementById('grid').getBoundingClientRect().left`);
  ok(Math.abs(pinLeft - 118) <= 2, 'the pinned column stays in place when scrolling sideways', pinLeft);
  await q(`document.getElementById('grid').scrollLeft = 0`);
  await wait(100);
  const notesNow = await colIdx('Notes');
  await p.click(`#gh_${notesNow} .hmenu`);
  await p.click('#colmenu [data-act="hide"]');
  ok(await q(`document.getElementById('grid').getAttribute('aria-colcount')`) === '14' && await colIdx('Notes') === -1, 'hiding Notes removes the column');
  await q(`document.getElementById('grid').scrollLeft = 0`);
  await wait(120);
  const itemC = await colIdx('Item');
  const w0 = await q(`document.getElementById('gh_${itemC}').getBoundingClientRect().width`);
  const rz = await q(`(() => { const r = document.querySelector('#gh_${itemC} .resizer').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await p.mouse('mousePressed', rz.x, rz.y);
  await p.mouse('mouseMoved', rz.x + 40, rz.y); await p.mouse('mouseMoved', rz.x + 80, rz.y);
  await p.mouse('mouseReleased', rz.x + 80, rz.y);
  await wait(100);
  const w1 = await q(`document.getElementById('gh_${itemC}').getBoundingClientRect().width`);
  ok(Math.abs(w1 - w0 - 80) <= 2, `dragging the edge resizes Item from ${w0} to ${w1} px`);
  ok(await q(`document.getElementById('g0_${itemC}').getBoundingClientRect().width`) === w1, 'body cells follow the new width');
  const prC = await colIdx('Priority'), stC = await colIdx('Status');
  const from = await p.center(`#gh_${prC} .hlabel`), to = await q(`(() => { const r = document.getElementById('gh_${stC}').getBoundingClientRect(); return { x: r.left + 4, y: r.top + r.height / 2 }; })()`);
  await p.mouse('mousePressed', from.x, from.y);
  await p.mouse('mouseMoved', from.x - 20, from.y); await p.mouse('mouseMoved', to.x, to.y);
  await p.mouse('mouseReleased', to.x, to.y);
  await wait(100);
  ok(await colIdx('Priority') === stC && await colIdx('Status') === stC + 1, 'dragging the Priority header drops it before Status');
  ok(!(await q(`!!document.querySelector('#hrow [aria-sort]')`)), 'a header drag does not count as a sort click');
  await p.click('#columns-open');
  await p.click('#col-list [data-vis="notes"]');
  ok(await colIdx('Notes') >= 0, 'the Columns panel shows a hidden column again');
  await p.click('#col-list [data-down="qty"]');
  ok(await colIdx('Unit cost') < await colIdx('Qty'), 'the Columns panel reorders with buttons');
  await p.click('#columns-reset');
  await p.click('#columns [data-close].btn');
  ok(await colIdx('Supplier') === 1 && !(await q(`document.getElementById('gh_1').classList.contains('pin')`)) && await q(`document.getElementById('grid').getAttribute('aria-colcount')`) === '15', 'Reset columns restores the default layout');

  // Saved views ----------------------------------------------------------------------------------------------------------------
  await p.click('#search'); await p.type('meridian'); await p.key('Enter');
  const meridian = await count();
  await p.click(`#gh_${await colIdx('Total')} .hmenu`);
  await p.click('#colmenu [data-act="desc"]');
  await p.click('#view-save');
  await p.click('#view-name'); await p.type('Meridian by value');
  await p.click('#save-form [type=submit]');
  ok(await q(`document.getElementById('views').value`) === 'u:Meridian by value', 'saving a view selects it');
  ok(await q(`JSON.parse(localStorage.getItem('gridline.views.v1'))[0].search`) === 'meridian', 'the view is stored in localStorage');
  await p.goto(base);
  ok(await count() === '20,000 orders', 'a reload starts from all orders');
  await q(`(() => { const s = document.getElementById('views'); s.value = 'u:Meridian by value'; s.dispatchEvent(new Event('change')); })()`);
  ok(await count() === meridian && await q(`document.getElementById('gh_7').getAttribute('aria-sort')`) === 'descending', 'the saved view restores search and sort after reload', [await count(), meridian]);
  await q(`(() => { const s = document.getElementById('views'); s.value = 'b:late'; s.dispatchEvent(new Event('change')); })()`);
  const expLate = await expectCount({ filters: { status: { kind: 'enum', values: ['Submitted', 'Approved', 'Shipped'] }, dueDate: { kind: 'date', from: '', to: '2026-10-18' } } });
  ok(await count() === `${fmt(expLate)} of 20,000 orders`, `built-in view Open and past due shows ${fmt(expLate)} orders`, await count());
  await p.click('#view-delete');
  ok(await q(`JSON.parse(localStorage.getItem('gridline.views.v1') || '[]').length`) === 1, 'built-in views cannot be deleted');
  await q(`(() => { const s = document.getElementById('views'); s.value = 'u:Meridian by value'; s.dispatchEvent(new Event('change')); })()`);
  await p.click('#view-delete');
  ok(await q(`JSON.parse(localStorage.getItem('gridline.views.v1')).length`) === 0, 'a saved view can be deleted');
  await q(`(() => { Storage.prototype.setItem = () => { throw new Error('blocked'); }; })()`);
  await p.click('#view-save'); await p.click('#view-name'); await p.type('Blocked'); await p.click('#save-form [type=submit]');
  ok(/blocked saving/.test(await toastText()), 'blocked storage is handled with a message instead of an error');
  await p.goto(base);

  // Performance --------------------------------------------------------------------------------------------------------------------
  perf.filterSearchMs = await q(`new Promise(res => { const s = document.getElementById('search'); s.value = 'tacoma'; const t0 = performance.now(); s.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); requestAnimationFrame(() => setTimeout(() => res(+(performance.now() - t0).toFixed(1)), 0)); })`);
  perf.filterSearchCoreMs = +(await q(`document.documentElement.dataset.viewMs`));
  perf.filterSearchCount = await count();
  await clearChips();
  perf.sortTotalMs = await q(`new Promise(res => { const t0 = performance.now(); const h = document.querySelector('#gh_7'); const r = h.getBoundingClientRect(); const o = { bubbles: true, clientX: r.left + 20, clientY: r.top + 10, pointerType: 'mouse', button: 0 }; h.querySelector('.hlabel').dispatchEvent(new PointerEvent('pointerdown', o)); window.dispatchEvent(new PointerEvent('pointerup', o)); requestAnimationFrame(() => setTimeout(() => res(+(performance.now() - t0).toFixed(1)), 0)); })`);
  perf.sortTotalCoreMs = +(await q(`document.documentElement.dataset.viewMs`));
  perf.enumFilterMs = await q(`(async () => { const c = await import('./src/core.mjs'); const rows = c.generateRows(); const t = []; for (let i = 0; i < 5; i++) { const t0 = performance.now(); c.computeView(rows, { filters: { status: { kind: 'enum', values: ['Shipped', 'Approved'] }, qty: { kind: 'range', min: 10, max: 400 } }, search: 'valve' }); t.push(performance.now() - t0); } t.sort((a, b) => a - b); return +t[2].toFixed(1); })()`);
  await clearChips();
  const scroll = await q(`new Promise(res => { const g = document.getElementById('grid'); const gaps = []; let last = performance.now(); const end = last + 3000; let frames = 0; const step = now => { gaps.push(now - last); last = now; frames++; g.scrollTop = (g.scrollTop + 180) % (g.scrollHeight - g.clientHeight); if (now < end) requestAnimationFrame(step); else { gaps.shift(); gaps.sort((a, b) => a - b); res({ frames, seconds: 3, fps: +(frames / 3).toFixed(1), p50: +gaps[Math.floor(gaps.length * .5)].toFixed(1), p95: +gaps[Math.floor(gaps.length * .95)].toFixed(1), max: +gaps[gaps.length - 1].toFixed(1), domRows: document.querySelectorAll('#body .row').length }); } }; requestAnimationFrame(step); })`);
  perf.scroll = scroll;
  ok(scroll.fps >= 30, `scrolling 180 px per frame for 3 s runs at ${scroll.fps} fps, p95 frame ${scroll.p95} ms`, scroll);
  ok(perf.filterSearchMs < 200, `search across 20,000 rows renders in ${perf.filterSearchMs} ms`, perf);
  ok(perf.sortTotalMs < 200, `sorting 20,000 rows by Total renders in ${perf.sortTotalMs} ms`, perf);
  await q(`document.getElementById('grid').scrollTop = 0`);

  // Phone layout -----------------------------------------------------------------------------------------------------------------------
  await p.size(390, 844);
  await p.goto(base);
  ok(await q(`document.body.dataset.mode`) === 'cards' && await q(`getComputedStyle(document.getElementById('grid-wrap')).display`) === 'none', 'at 390 px the grid switches to cards');
  ok(await q(`document.documentElement.scrollWidth <= document.documentElement.clientWidth`), 'no horizontal page overflow at 390 px');
  ok(await q(`document.querySelectorAll('#cards .card').length < 20`), 'cards are virtualized too');
  const firstCardQty = await q(`document.querySelector('#cards .card-btn').textContent.match(/(\\d[\\d,]*) at/)[1]`);
  await p.click('#cards .card-btn');
  ok(await q(`document.getElementById('card-edit').open`), 'tapping a card opens the order editor');
  await q(`document.getElementById('ce-qty').select()`);
  await p.click('#ce-qty'); await q(`document.getElementById('ce-qty').value = ''`); await p.type('lots');
  await p.click('#card-form [type=submit]');
  ok(await q(`document.getElementById('card-edit').open && /whole number/.test(document.getElementById('ce-qty-err').textContent)`), 'an invalid card edit shows the error and keeps the dialog open');
  await q(`document.getElementById('ce-qty').value = ''`); await p.click('#ce-qty'); await p.type('42');
  await p.click('#card-form [type=submit]');
  ok(!(await q(`document.getElementById('card-edit').open`)) && await changes() === 1, 'a valid card edit saves one change');
  ok(await q(`/42 at/.test(document.querySelector('#cards .card-btn').textContent) && /Edited/.test(document.querySelector('#cards .card-btn').textContent)`), 'the card shows the new value and an Edited mark', firstCardQty);
  await p.click('#filters-open');
  await q(`document.querySelector('#filters-body details[data-key="status"]').open = true`);
  await p.click('#filters-body details[data-key="status"] [data-none]');
  await p.click('#filters-body details[data-key="status"] input[value="Draft"]');
  ok(/of 20,000 orders match/.test(await q(`document.getElementById('filters-sub').textContent`)) && await count() !== '20,000 orders', 'the phone filter sheet filters the list', await count());
  await p.click('#filters .dlg-foot [data-close]');
  await q(`(() => { const s = document.getElementById('phone-sort'); s.value = 'total-desc'; s.dispatchEvent(new Event('change')); })()`);
  ok(await q(`(() => { const v = [...document.querySelectorAll('#cards .c-meta b')].slice(0, 5).map(b => +b.textContent.replace(/[$,]/g, '')); return v.every((x, i) => !i || v[i - 1] >= x); })()`), 'the phone sort orders cards by total');
  await p.click('#export-open');
  ok(await q(`getComputedStyle(document.getElementById('import-menu')).display !== 'none'`), 'on phones Import sits in the Files menu');
  await p.key('Escape');

  ok(page_problems_empty(), 'no console errors, exceptions or failed requests', p.problems);
} catch (err) {
  ok(false, 'flow crashed: ' + err.message);
} finally {
  await p.close();
}

function page_problems_empty() { return p.problems.length === 0; }

const failed = C.done();
writeFileSync(join(here, 'flow-results.json'), JSON.stringify({ when: new Date().toISOString(), base, passed: C.results.filter(r => r.pass).length, failed, results: C.results }, null, 1));
writeFileSync(join(here, 'perf-results.json'), JSON.stringify({ when: new Date().toISOString(), browser: 'Brave headless, --disable-gpu, 1440 x 900', ...perf }, null, 1));
console.log('perf', JSON.stringify(perf));
process.exit(failed ? 1 : 0);
