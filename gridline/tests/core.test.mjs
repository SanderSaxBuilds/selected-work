import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLUMNS, COLUMN_BY_KEY, CATEGORIES, STATUSES, generateRows, mulberry32, getValue, formatValue, toPlain,
  parseValue, validateCell, computeView, sortIndices, toggleSort, compilePredicate, History,
  parseCSV, parseDelimited, detectDelimiter, csvField, toCSV, parseTSV, toTSV, guessMapping,
  rangeStats, describeFilter, sanitizeView, isFilterActive, searchText, invalidateRow, sampleImportCSV, dateToDays, daysToDate
} from '../src/core.mjs';

const C = COLUMN_BY_KEY;
const rows = generateRows();

// Data generation -------------------------------------------------------------

test('generates 20,000 rows with 15 columns of mixed types', () => {
  assert.equal(rows.length, 20000);
  assert.equal(COLUMNS.length, 15);
  const types = new Set(COLUMNS.map(c => c.type));
  for (const t of ['id', 'text', 'enum', 'int', 'money', 'date']) assert.ok(types.has(t), t);
});

test('generation is deterministic for a seed and differs for another seed', () => {
  const a = generateRows(500, 7), b = generateRows(500, 7), c = generateRows(500, 8);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(rows[0].id, 'PO-240001');
  assert.equal(rows[19999].id, 'PO-260000');
});

test('every generated row passes its own column validation', () => {
  for (const r of rows.slice(0, 3000)) {
    for (const col of COLUMNS) {
      if (col.readonly) continue;
      const res = validateCell(col, toPlain(col, r[col.key]), r);
      assert.ok(res.ok, `${r.id} ${col.key} ${r[col.key]} ${res.error}`);
      assert.equal(res.value, r[col.key]);
    }
  }
});

test('ids are unique and due dates never precede order dates', () => {
  assert.equal(new Set(rows.map(r => r.id)).size, rows.length);
  assert.ok(rows.every(r => r.dueDate >= r.orderDate));
  assert.ok(rows.every(r => CATEGORIES.includes(r.category) && STATUSES.includes(r.status)));
});

test('mulberry32 yields values in [0, 1)', () => {
  const rng = mulberry32(1);
  for (let i = 0; i < 1000; i++) { const x = rng(); assert.ok(x >= 0 && x < 1); }
});

test('date helpers round trip', () => {
  assert.equal(daysToDate(dateToDays('2026-02-28') + 1), '2026-03-01');
  assert.equal(daysToDate(dateToDays('2024-02-28') + 1), '2024-02-29');
});

// Values and validation -------------------------------------------------------------

test('total is computed from qty and unit cost in cents', () => {
  const r = { qty: 3, unitCost: 1999 };
  assert.equal(getValue(r, 'total'), 5997);
  assert.equal(formatValue(C.total, 5997), '$59.97');
  assert.equal(toPlain(C.total, 5997), '59.97');
  assert.equal(toPlain(C.unitCost, 5), '0.05');
});

test('integer validation accepts separators and rejects decimals, words and range', () => {
  assert.deepEqual(parseValue(C.qty, ' 1,200 '), { ok: true, value: 1200 });
  assert.equal(parseValue(C.qty, '2.5').ok, false);
  assert.equal(parseValue(C.qty, 'abc').ok, false);
  assert.match(parseValue(C.qty, '0').error, /from 1 to 100,000/);
  assert.equal(parseValue(C.qty, '100001').ok, false);
});

test('money validation parses to exact cents', () => {
  assert.deepEqual(parseValue(C.unitCost, '$1,234.5'), { ok: true, value: 123450 });
  assert.deepEqual(parseValue(C.unitCost, '0.07'), { ok: true, value: 7 });
  assert.deepEqual(parseValue(C.unitCost, '19.99'), { ok: true, value: 1999 });
  assert.match(parseValue(C.unitCost, '1.234').error, /two decimals/);
  assert.equal(parseValue(C.unitCost, '0').ok, false);
});

test('date validation needs a real ISO calendar date in range', () => {
  assert.equal(parseValue(C.dueDate, '2026-02-29').ok, false);
  assert.equal(parseValue(C.dueDate, '2028-02-29').ok, true);
  assert.equal(parseValue(C.dueDate, '03/04/2026').ok, false);
  assert.match(parseValue(C.dueDate, '1999-01-01').error, /between/);
});

test('enum validation is case-insensitive and returns the canonical option', () => {
  assert.deepEqual(parseValue(C.status, ' shipped '), { ok: true, value: 'Shipped' });
  assert.match(parseValue(C.status, 'Lost').error, /one of Draft, Submitted/);
});

test('text validation covers required, length, pattern and upper-casing', () => {
  assert.match(parseValue(C.supplier, '  ').error, /required/);
  assert.equal(parseValue(C.notes, '').ok, true);
  assert.match(parseValue(C.notes, 'x'.repeat(121)).error, /at most 120/);
  assert.deepEqual(parseValue(C.sku, 'fst-20418'), { ok: true, value: 'FST-20418' });
  assert.match(parseValue(C.sku, 'FST20418').error, /three letters/);
});

test('read-only columns refuse edits', () => {
  assert.equal(parseValue(C.id, 'PO-1').ok, false);
  assert.equal(parseValue(C.total, '5').ok, false);
});

test('cross-field rule keeps due date on or after order date', () => {
  const r = { orderDate: '2026-05-10', dueDate: '2026-05-20' };
  assert.match(validateCell(C.dueDate, '2026-05-01', r).error, /before the order date, 2026-05-10/);
  assert.equal(validateCell(C.dueDate, '2026-05-10', r).ok, true);
  assert.match(validateCell(C.orderDate, '2026-06-01', r).error, /after the due date/);
});

// Filters, search and sort --------------------------------------------------------------

test('no filters returns every row in original order', () => {
  const v = computeView(rows);
  assert.equal(v.length, 20000);
  assert.equal(v[0], 0); assert.equal(v[19999], 19999);
});

test('enum filter keeps only selected values and matches a manual count', () => {
  const v = computeView(rows, { filters: { status: { kind: 'enum', values: ['Shipped', 'Draft'] } } });
  const expected = rows.filter(r => r.status === 'Shipped' || r.status === 'Draft').length;
  assert.equal(v.length, expected);
  assert.ok(v.every(i => ['Shipped', 'Draft'].includes(rows[i].status)));
  assert.equal(computeView(rows, { filters: { status: { kind: 'enum', values: [] } } }).length, 0);
});

test('number range filter is inclusive and works on the computed total', () => {
  const v = computeView(rows, { filters: { qty: { kind: 'range', min: 10, max: 20 } } });
  assert.equal(v.length, rows.filter(r => r.qty >= 10 && r.qty <= 20).length);
  const t = computeView(rows, { filters: { total: { kind: 'range', min: 1000000, max: null } } });
  assert.ok(t.length > 0 && t.every(i => rows[i].qty * rows[i].unitCost >= 1000000));
  assert.equal(t.length, rows.filter(r => r.qty * r.unitCost >= 1000000).length);
});

test('date range filter is inclusive on both ends', () => {
  const f = { kind: 'date', from: '2026-03-01', to: '2026-03-31' };
  const v = computeView(rows, { filters: { orderDate: f } });
  assert.equal(v.length, rows.filter(r => r.orderDate >= '2026-03-01' && r.orderDate <= '2026-03-31').length);
  assert.ok(v.some(i => rows[i].orderDate === '2026-03-01'));
});

test('text filter is a case-insensitive contains', () => {
  const v = computeView(rows, { filters: { supplier: { kind: 'text', q: 'HARLOW' } } });
  assert.ok(v.length > 0 && v.every(i => rows[i].supplier.includes('Harlow')));
});

test('global search needs every word to match somewhere in the row', () => {
  const v = computeView(rows, { search: 'harlow tacoma' });
  assert.ok(v.length > 0);
  assert.ok(v.every(i => rows[i].supplier.includes('Harlow') && rows[i].warehouse === 'Tacoma'));
  assert.equal(v.length, rows.filter(r => r.supplier.includes('Harlow') && r.warehouse === 'Tacoma').length);
  // "reno" also matches the buyer S. Moreno, which is correct substring behavior
  assert.ok(computeView(rows, { search: 'reno' }).some(i => rows[i].buyer === 'S. Moreno'));
  assert.equal(computeView(rows, { search: 'zzzz-nothing' }).length, 0);
});

test('search cache is refreshed after invalidateRow', () => {
  const r = { ...rows[0] };
  assert.ok(!searchText(r).includes('quartz'));
  r.notes = 'Quartz';
  assert.ok(!searchText(r).includes('quartz'));
  invalidateRow(r);
  assert.ok(searchText(r).includes('quartz'));
});

test('filters combine with AND', () => {
  const v = computeView(rows, { filters: { status: { kind: 'enum', values: ['Received'] }, warehouse: { kind: 'enum', values: ['Tacoma'] } } });
  assert.equal(v.length, rows.filter(r => r.status === 'Received' && r.warehouse === 'Tacoma').length);
  assert.equal(compilePredicate({ qty: { kind: 'range', min: null, max: null } }, ''), null);
});

test('multi-column sort orders by the first key, then the second', () => {
  const v = computeView(rows, { sort: [{ key: 'warehouse', dir: 1 }, { key: 'total', dir: -1 }] });
  const pos = w => C.warehouse.options.indexOf(w);
  for (let n = 1; n < v.length; n++) {
    const a = rows[v[n - 1]], b = rows[v[n]];
    assert.ok(pos(a.warehouse) <= pos(b.warehouse));
    if (a.warehouse === b.warehouse) assert.ok(getValue(a, 'total') >= getValue(b, 'total'));
  }
});

test('sort is stable and keeps original order for ties', () => {
  const v = computeView(rows, { sort: [{ key: 'status', dir: 1 }] });
  for (let n = 1; n < v.length; n++) if (rows[v[n - 1]].status === rows[v[n]].status) assert.ok(v[n - 1] < v[n]);
});

test('empty text values sort last in both directions', () => {
  const sample = rows.slice(0, 400);
  const idx = sample.map((_, i) => i);
  for (const dir of [1, -1]) {
    const v = sortIndices(sample, idx, [{ key: 'notes', dir }]);
    const firstEmpty = v.findIndex(i => sample[i].notes === '');
    assert.ok(firstEmpty > 0);
    assert.ok(v.slice(firstEmpty).every(i => sample[i].notes === ''));
  }
});

test('enum sort follows list order, not the alphabet', () => {
  const v = computeView(rows, { sort: [{ key: 'priority', dir: -1 }] });
  assert.equal(rows[v[0]].priority, 'Rush');
  assert.equal(rows[v[v.length - 1]].priority, 'Low');
  const s = computeView(rows, { sort: [{ key: 'status', dir: 1 }] });
  assert.equal(rows[s[0]].status, 'Draft');
  assert.equal(rows[s[s.length - 1]].status, 'Cancelled');
});

test('date sort descending puts the latest first', () => {
  const v = computeView(rows, { sort: [{ key: 'dueDate', dir: -1 }] });
  assert.equal(rows[v[0]].dueDate, rows.reduce((m, r) => r.dueDate > m ? r.dueDate : m, ''));
});

test('toggleSort cycles single sort and builds multi sort with shift', () => {
  let s = toggleSort([], 'qty', false); assert.deepEqual(s, [{ key: 'qty', dir: 1 }]);
  s = toggleSort(s, 'qty', false); assert.deepEqual(s, [{ key: 'qty', dir: -1 }]);
  s = toggleSort(s, 'qty', false); assert.deepEqual(s, []);
  s = toggleSort([{ key: 'qty', dir: 1 }], 'status', true);
  assert.deepEqual(s, [{ key: 'qty', dir: 1 }, { key: 'status', dir: 1 }]);
  s = toggleSort(s, 'status', true); assert.deepEqual(s[1], { key: 'status', dir: -1 });
  s = toggleSort(s, 'status', true); assert.deepEqual(s, [{ key: 'qty', dir: 1 }]);
  assert.deepEqual(toggleSort([{ key: 'qty', dir: 1 }, { key: 'status', dir: 1 }], 'item', false), [{ key: 'item', dir: 1 }]);
});

// History -------------------------------------------------------------------------------------

test('history undo and redo move batches between stacks and a new push clears redo', () => {
  const h = new History(3);
  assert.equal(h.push({ changes: [] }), false);
  h.push({ label: 'a', changes: [1] }); h.push({ label: 'b', changes: [1] });
  assert.equal(h.undo().label, 'b');
  assert.ok(h.canRedo);
  assert.equal(h.redo().label, 'b');
  h.undo(); h.push({ label: 'c', changes: [1] });
  assert.equal(h.canRedo, false);
  h.push({ label: 'd', changes: [1] }); h.push({ label: 'e', changes: [1] });
  assert.equal(h.past.length, 3, 'limit drops the oldest');
  assert.equal(h.past[0].label, 'c');
});

// CSV and TSV ----------------------------------------------------------------------------------

test('CSV parser handles quotes, doubled quotes, commas and newlines inside quotes', () => {
  const { rows: r, error } = parseCSV('a,b,c\r\n"x, y","say ""hi""","line1\nline2"\r\n1,,3\r\n');
  assert.equal(error, null);
  assert.deepEqual(r, [['a', 'b', 'c'], ['x, y', 'say "hi"', 'line1\nline2'], ['1', '', '3']]);
});

test('CSV parser strips a BOM, detects semicolons and reports an unclosed quote', () => {
  assert.equal(detectDelimiter('﻿a;b;c\n1;2;3'), ';');
  assert.deepEqual(parseCSV('﻿a;b\n1;2').rows, [['a', 'b'], ['1', '2']]);
  assert.match(parseDelimited('a,b\n"open,2\n3,4', ',').error, /line 2/);
});

test('CSV serializer quotes when needed and round trips', () => {
  const data = [['PO number', 'Notes'], ['PO-1', 'Dock 3, east side'], ['PO-2', 'He said "now"'], ['PO-3', 'two\nlines'], ['PO-4', ' padded ']];
  const text = toCSV(data);
  assert.ok(text.endsWith('\r\n'));
  assert.deepEqual(parseCSV(text).rows, data);
});

test('CSV serializer guards spreadsheet formulas but leaves negative numbers alone', () => {
  assert.equal(csvField('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(csvField('@cmd'), "'@cmd");
  assert.equal(csvField('-12.50'), '-12.50');
  assert.equal(csvField('-dash'), "'-dash");
  assert.equal(csvField('+1'), "'+1");
});

test('TSV round trips a block, including a tab inside a value', () => {
  const block = [['1', 'a\tb'], ['2', 'plain']];
  assert.deepEqual(parseTSV(toTSV(block)), block);
  assert.deepEqual(parseTSV('10\t20\n30\t40\n'), [['10', '20'], ['30', '40']]);
  assert.deepEqual(parseTSV('only'), [['only']]);
});

test('guessMapping matches labels, keys and common aliases', () => {
  const m = guessMapping(['PO #', 'Status', 'Quantity', 'Unit price', 'Due date', 'Mystery', 'notes']);
  assert.deepEqual(m, ['id', 'status', 'qty', 'unitCost', 'dueDate', null, 'notes']);
});

test('sample import file parses and maps every column', () => {
  const { rows: r } = parseCSV(sampleImportCSV(rows));
  assert.equal(r.length, 21);
  assert.ok(guessMapping(r[0]).every(Boolean));
});

// Stats, chips and saved views ---------------------------------------------------------------

test('rangeStats ignores non-numbers and computes count, sum and average', () => {
  assert.deepEqual(rangeStats([2, 'x', 4, null, 6]), { count: 3, sum: 12, avg: 4, min: 2, max: 6 });
  assert.equal(rangeStats([]).count, 0);
});

test('describeFilter writes plain chip text for each filter kind', () => {
  assert.equal(describeFilter('status', { kind: 'enum', values: ['Approved', 'Shipped'] }), 'Status: Approved, Shipped');
  assert.equal(describeFilter('qty', { kind: 'range', min: 10, max: 500 }), 'Qty 10 to 500');
  assert.equal(describeFilter('total', { kind: 'range', min: 100000, max: null }), 'Total at least $1,000.00');
  assert.equal(describeFilter('dueDate', { kind: 'date', from: '', to: '2026-10-19' }), 'Due until 2026-10-19');
  assert.equal(describeFilter('supplier', { kind: 'text', q: ' harl ' }), 'Supplier contains "harl"');
  assert.equal(isFilterActive({ kind: 'text', q: '  ' }), false);
});

test('sanitizeView drops unknown columns and bad filters and fills missing columns', () => {
  const v = sanitizeView({ name: ' Mine ', filters: { status: { kind: 'enum', values: ['Shipped', 'Bogus'] }, qty: { kind: 'text', q: 'x' }, nope: {} }, sort: [{ key: 'qty', dir: -1 }, { key: 'zzz' }], columns: [{ key: 'qty', width: 5000, pinned: true }, { key: 'evil' }] });
  assert.equal(v.name, 'Mine');
  assert.deepEqual(v.filters, { status: { kind: 'enum', values: ['Shipped'] } });
  assert.deepEqual(v.sort, [{ key: 'qty', dir: -1 }]);
  assert.equal(v.columns.length, 15);
  assert.deepEqual(v.columns[0], { key: 'qty', width: 600, hidden: false, pinned: true });
  assert.equal(sanitizeView({ name: '' }), null);
  assert.equal(sanitizeView('junk'), null);
});
