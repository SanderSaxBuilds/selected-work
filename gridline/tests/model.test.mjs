import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRows, parseCSV, guessMapping, sampleImportCSV, getValue, computeView } from '../src/core.mjs';
import { GridModel } from '../src/model.mjs';

const fresh = (n = 2000) => new GridModel(generateRows(n));

test('a valid edit applies, marks the cell dirty and updates the computed total', () => {
  const m = fresh();
  const r = m.rows[0];
  const { errors, batch } = m.edit([{ id: r.id, key: 'qty', raw: '250' }]);
  assert.deepEqual(errors, []);
  assert.equal(batch.changes.length, 1);
  assert.equal(r.qty, 250);
  assert.equal(getValue(r, 'total'), 250 * r.unitCost);
  assert.ok(m.isDirty(r.id, 'qty'));
  assert.equal(m.changeCount, 1);
});

test('an invalid edit is not committed and reports why', () => {
  const m = fresh();
  const r = m.rows[0], before = r.qty;
  const { errors, batch } = m.edit([{ id: r.id, key: 'qty', raw: 'lots' }]);
  assert.equal(batch, null);
  assert.equal(r.qty, before);
  assert.match(errors[0].message, /whole number/);
  assert.equal(m.changeCount, 0);
  assert.equal(m.history.canUndo, false);
});

test('editing a value back to the original clears the dirty mark', () => {
  const m = fresh();
  const r = m.rows[1], orig = r.status;
  m.edit([{ id: r.id, key: 'status', raw: orig === 'Draft' ? 'Approved' : 'Draft' }]);
  assert.ok(m.isDirty(r.id, 'status'));
  m.edit([{ id: r.id, key: 'status', raw: orig }]);
  assert.equal(m.isDirty(r.id, 'status'), false);
  assert.equal(m.changeCount, 0);
});

test('a no-op edit creates no undo step', () => {
  const m = fresh();
  const r = m.rows[2];
  const { batch } = m.edit([{ id: r.id, key: 'qty', raw: String(r.qty) }]);
  assert.equal(batch, null);
  assert.equal(m.history.canUndo, false);
});

test('undo and redo restore a bulk edit as one step', () => {
  const m = fresh();
  const ids = m.rows.slice(0, 50).map(r => r.id);
  const before = m.rows.slice(0, 50).map(r => r.qty);
  m.edit(ids.map(id => ({ id, key: 'qty', raw: '7' })), 'Fill down');
  assert.ok(m.rows.slice(0, 50).every(r => r.qty === 7));
  const b = m.undo();
  assert.equal(b.label, 'Fill down');
  assert.deepEqual(m.rows.slice(0, 50).map(r => r.qty), before);
  assert.equal(m.changeCount, 0);
  m.redo();
  assert.ok(m.rows.slice(0, 50).every(r => r.qty === 7));
  assert.equal(m.changeCount, before.filter(q => q !== 7).length);
});

test('undo walks back through several batches in order', () => {
  const m = fresh();
  const r = m.rows[3];
  const q0 = r.qty;
  m.edit([{ id: r.id, key: 'qty', raw: '11' }]);
  m.edit([{ id: r.id, key: 'qty', raw: '12' }]);
  m.edit([{ id: r.id, key: 'qty', raw: '13' }]);
  m.undo(); assert.equal(r.qty, 12);
  m.undo(); assert.equal(r.qty, 11);
  m.undo(); assert.equal(r.qty, q0);
  assert.equal(m.undo(), null);
  m.redo(); m.redo(); assert.equal(r.qty, 12);
});

test('a mixed batch commits valid cells and skips invalid ones', () => {
  const m = fresh();
  const [a, b] = m.rows;
  const expected = (a.qty !== 5 ? 1 : 0) + (b.warehouse !== 'Tacoma' ? 1 : 0);
  const { changes, errors } = m.edit([
    { id: a.id, key: 'qty', raw: '5' },
    { id: b.id, key: 'qty', raw: '-3' },
    { id: a.id, key: 'total', raw: '1' },
    { id: b.id, key: 'warehouse', raw: 'tacoma' }
  ], 'Paste');
  assert.equal(errors.length, 2);
  assert.ok(errors.some(e => /can't be edited/.test(e.message)));
  assert.equal(a.qty, 5);
  assert.equal(b.warehouse, 'Tacoma');
  assert.equal(changes.length, expected);
  assert.equal(m.history.past.length, expected ? 1 : 0, 'one undo step for the whole paste');
});

test('edits in one batch see each other for the date rule', () => {
  const m = fresh();
  const r = m.rows[4];
  // Moving both dates a year later works only if the order date sees the new due date.
  const res = m.edit([{ id: r.id, key: 'dueDate', raw: '2029-06-30' }, { id: r.id, key: 'orderDate', raw: '2029-06-01' }]);
  assert.deepEqual(res.errors, []);
  assert.equal(r.orderDate, '2029-06-01');
  const bad = m.edit([{ id: r.id, key: 'dueDate', raw: '2029-05-01' }]);
  assert.match(bad.errors[0].message, /before the order date/);
  assert.equal(r.dueDate, '2029-06-30');
});

test('changes() lists old and new values sorted by row and column order', () => {
  const m = fresh();
  const [a, b] = m.rows;
  const oldQty = b.qty, oldStatus = b.status;
  m.edit([{ id: b.id, key: 'qty', raw: String(oldQty + 1) }, { id: b.id, key: 'status', raw: oldStatus === 'Draft' ? 'Approved' : 'Draft' }, { id: a.id, key: 'notes', raw: 'Check' }]);
  const ch = m.changes();
  assert.deepEqual(ch.map(c => [c.id, c.key]), [[a.id, 'notes'], [b.id, 'status'], [b.id, 'qty']]);
  assert.equal(ch[2].old, oldQty);
  assert.equal(ch[2].now, oldQty + 1);
});

test('revert one change restores it and is itself undoable', () => {
  const m = fresh();
  const r = m.rows[5], q = r.qty;
  m.edit([{ id: r.id, key: 'qty', raw: String(q + 9) }, { id: r.id, key: 'notes', raw: 'Revert me later' }]);
  m.revert([{ id: r.id, key: 'qty' }]);
  assert.equal(r.qty, q);
  assert.equal(m.changeCount, 1);
  m.undo();
  assert.equal(r.qty, q + 9);
  assert.equal(m.changeCount, 2);
});

test('revert all clears every change in one undo step', () => {
  const m = fresh();
  m.edit(m.rows.slice(0, 30).map(r => ({ id: r.id, key: 'priority', raw: r.priority === 'Rush' ? 'Low' : 'Rush' })));
  assert.equal(m.changeCount, 30);
  const b = m.revertAll();
  assert.equal(b.label, 'Revert all');
  assert.equal(m.changeCount, 0);
  m.undo();
  assert.equal(m.changeCount, 30);
});

test('changesTable formats money as plain decimals for export', () => {
  const m = fresh();
  const r = m.rows[6];
  m.edit([{ id: r.id, key: 'unitCost', raw: '12.5' }]);
  const t = m.changesTable();
  assert.deepEqual(t[0], ['PO number', 'Column', 'Old value', 'New value']);
  assert.equal(t[1][0], r.id);
  assert.equal(t[1][1], 'Unit cost');
  assert.equal(t[1][3], '12.50');
});

test('import plan applies valid rows and rejects bad rows with line numbers and reasons', () => {
  const m = fresh();
  const { rows: recs } = parseCSV(sampleImportCSV(m.rows));
  const mapping = guessMapping(recs[0]);
  const plan = m.planImport(recs.slice(1), mapping);
  assert.equal(plan.rejected.length, 4);
  const byLine = Object.fromEntries(plan.rejected.map(r => [r.line, r]));
  assert.match(byLine[18].problems[0].message, /PO-999999 is not in this order list/);
  assert.match(byLine[19].problems[0].message, /whole number/);
  assert.match(byLine[20].problems[0].message, /before the order date/);
  assert.match(byLine[21].problems[0].message, /one of/);
  assert.equal(plan.updatedRows + plan.unchangedRows, 16);
  assert.ok(plan.changes.length >= 16);
  assert.equal(m.changeCount, 0, 'planning does not change data');
  m.apply(plan.changes, 'Import');
  assert.equal(m.changeCount, plan.changes.length);
  m.undo();
  assert.equal(m.changeCount, 0);
});

test('import plan needs a PO number column and rejects duplicate ids', () => {
  const m = fresh();
  assert.match(m.planImport([['5']], ['qty']).error, /PO number/);
  const id = m.rows[0].id;
  const plan = m.planImport([[id, '3'], [id, '4']], ['id', 'qty']);
  assert.equal(plan.rejected.length, 1);
  assert.match(plan.rejected[0].problems[0].message, /more than once/);
});

test('edited rows are found by the filter pipeline after an edit', () => {
  const m = fresh();
  const r = m.rows[7];
  m.edit([{ id: r.id, key: 'notes', raw: 'Zebra crossing at dock' }]);
  const v = computeView(m.rows, { search: 'zebra' });
  assert.deepEqual(v.map(i => m.rows[i].id), [r.id]);
});
