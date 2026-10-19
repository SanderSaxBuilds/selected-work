// Gridline edit model: pure, no DOM.
// Holds the rows, validates batches of edits, tracks dirty cells against their
// original values and keeps the undo and redo history.
import { COLUMNS, COLUMN_BY_KEY, History, validateCell, invalidateRow, toPlain } from './core.mjs';

const cellKey = (id, key) => id + '\u0000' + key;
const COL_ORDER = Object.fromEntries(COLUMNS.map((c, i) => [c.key, i]));

export class GridModel {
  constructor(rows) {
    this.rows = rows;
    this.byId = new Map(rows.map(r => [r.id, r]));
    this.original = new Map();
    this.history = new History(500);
    this.version = 0;
  }

  get changeCount() { return this.original.size; }
  isDirty(id, key) { return this.original.has(cellKey(id, key)); }
  originalValue(id, key) { return this.original.get(cellKey(id, key)); }
  rowIsDirty(id) {
    for (const c of COLUMNS) if (this.original.has(cellKey(id, c.key))) return true;
    return false;
  }

  // Validate edits without applying them. Each edit is { id, key, raw }.
  // Edits to the same row see each other, so a paste that moves both dates checks the pair.
  propose(edits) {
    const overlay = new Map();
    const changes = [], errors = [];
    for (const e of edits) {
      const col = COLUMN_BY_KEY[e.key];
      const row = this.byId.get(e.id);
      if (!row) { errors.push({ ...e, message: `${e.id || 'This row'} was not found.` }); continue; }
      if (!col) { errors.push({ ...e, message: `Unknown column ${e.key}.` }); continue; }
      if (col.readonly) { errors.push({ ...e, message: `${col.label} can't be edited.` }); continue; }
      let pending = overlay.get(e.id);
      if (!pending) { pending = {}; overlay.set(e.id, pending); }
      const view = Object.assign({}, row, pending);
      const res = validateCell(col, e.raw, view);
      if (!res.ok) { errors.push({ ...e, message: res.error }); continue; }
      pending[e.key] = res.value;
    }
    for (const [id, pending] of overlay) {
      const row = this.byId.get(id);
      for (const [key, value] of Object.entries(pending)) {
        if (row[key] !== value) changes.push({ id, key, before: row[key], after: value });
      }
    }
    return { changes, errors };
  }

  set(id, key, value) {
    const row = this.byId.get(id);
    const k = cellKey(id, key);
    if (!this.original.has(k)) this.original.set(k, row[key]);
    row[key] = value;
    if (this.original.get(k) === value) this.original.delete(k);
    invalidateRow(row);
  }

  apply(changes, label = 'Edit') {
    if (!changes.length) return null;
    for (const c of changes) this.set(c.id, c.key, c.after);
    const batch = { label, changes };
    this.history.push(batch);
    this.version++;
    return batch;
  }

  // Validate and apply in one step. Valid cells are applied as one undo step.
  edit(edits, label = 'Edit') {
    const { changes, errors } = this.propose(edits);
    const batch = this.apply(changes, label);
    return { batch, changes, errors };
  }

  undo() {
    const b = this.history.undo();
    if (!b) return null;
    for (let i = b.changes.length - 1; i >= 0; i--) { const c = b.changes[i]; this.set(c.id, c.key, c.before); }
    this.version++;
    return b;
  }

  redo() {
    const b = this.history.redo();
    if (!b) return null;
    for (const c of b.changes) this.set(c.id, c.key, c.after);
    this.version++;
    return b;
  }

  // All cells whose value differs from the loaded data, ordered by row then column.
  changes() {
    const out = [];
    for (const [k, old] of this.original) {
      const [id, key] = k.split('\u0000');
      out.push({ id, key, old, now: this.byId.get(id)[key] });
    }
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : COL_ORDER[a.key] - COL_ORDER[b.key]));
    return out;
  }

  // Reverting is itself an undoable step. Cross-field rules are not re-checked
  // because every reverted value was valid when it was loaded.
  revert(cells, label = 'Revert') {
    const changes = [];
    for (const { id, key } of cells) {
      const k = cellKey(id, key);
      if (!this.original.has(k)) continue;
      changes.push({ id, key, before: this.byId.get(id)[key], after: this.original.get(k) });
    }
    return this.apply(changes, label);
  }
  revertAll() { return this.revert(this.changes(), 'Revert all'); }

  // Rows for the "changes only" export
  changesTable() {
    const header = ['PO number', 'Column', 'Old value', 'New value'];
    return [header, ...this.changes().map(c => {
      const col = COLUMN_BY_KEY[c.key];
      return [c.id, col.label, toPlain(col, c.old), toPlain(col, c.now)];
    })];
  }

  // Plan a CSV import. `records` are data rows without the header, `mapping` gives a column key or null per CSV column.
  // A row with any invalid value is rejected as a whole. Rows are matched by PO number.
  planImport(records, mapping, { firstLine = 2 } = {}) {
    const idCol = mapping.indexOf('id');
    const plan = { changes: [], rejected: [], updatedRows: 0, unchangedRows: 0, ignoredColumns: [] };
    mapping.forEach((key, i) => { if (key && COLUMN_BY_KEY[key].readonly && key !== 'id') plan.ignoredColumns.push(i); });
    if (idCol < 0) { plan.error = 'Map one column to PO number so rows can be matched.'; return plan; }
    const seen = new Set();
    records.forEach((rec, n) => {
      const line = firstLine + n;
      const id = String(rec[idCol] ?? '').trim().toUpperCase();
      const reject = problems => plan.rejected.push({ line, id, problems });
      if (!id) return reject([{ column: 'PO number', value: '', message: 'PO number is empty.' }]);
      if (!this.byId.has(id)) return reject([{ column: 'PO number', value: id, message: `${id} is not in this order list.` }]);
      if (seen.has(id)) return reject([{ column: 'PO number', value: id, message: `${id} appears more than once in the file.` }]);
      seen.add(id);
      const edits = [];
      mapping.forEach((key, i) => {
        if (!key || key === 'id' || COLUMN_BY_KEY[key].readonly) return;
        edits.push({ id, key, raw: rec[i] ?? '' });
      });
      const { changes, errors } = this.propose(edits);
      if (errors.length) return reject(errors.map(e => ({ column: COLUMN_BY_KEY[e.key].label, value: String(e.raw), message: e.message })));
      if (changes.length) { plan.updatedRows++; plan.changes.push(...changes); } else plan.unchangedRows++;
    });
    return plan;
  }
}
