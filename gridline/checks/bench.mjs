// Core timings in Node for 20,000 rows. Median of 9 runs after 2 warm-up runs.
// Usage: node checks/bench.mjs
import { generateRows, computeView, toCSV, parseCSV, toPlain, getValue, COLUMNS } from '../src/core.mjs';
import { GridModel } from '../src/model.mjs';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
function time(fn, runs = 9) {
  for (let i = 0; i < 2; i++) fn();
  const t = [];
  for (let i = 0; i < runs; i++) { const t0 = performance.now(); fn(); t.push(performance.now() - t0); }
  t.sort((a, b) => a - b);
  return +t[Math.floor(runs / 2)].toFixed(2);
}

const rows = generateRows();
const csvText = toCSV([COLUMNS.map(c => c.label), ...rows.map(r => COLUMNS.map(c => toPlain(c, getValue(r, c.key))))]);
const results = {
  node: process.version,
  rows: rows.length,
  generateRowsMs: time(() => generateRows(), 5),
  enumFilterMs: time(() => computeView(rows, { filters: { status: { kind: 'enum', values: ['Shipped', 'Approved'] } } })),
  fourFiltersAndSearchMs: time(() => computeView(rows, { filters: { status: { kind: 'enum', values: ['Shipped', 'Received'] }, qty: { kind: 'range', min: 10, max: 400 }, dueDate: { kind: 'date', from: '2026-01-01', to: '2026-09-30' }, supplier: { kind: 'text', q: 'a' } }, search: 'valve' })),
  sortTotalMs: time(() => computeView(rows, { sort: [{ key: 'total', dir: -1 }] })),
  sortSupplierThenDueMs: time(() => computeView(rows, { sort: [{ key: 'supplier', dir: 1 }, { key: 'dueDate', dir: -1 }] })),
  exportCsvMs: time(() => toCSV([COLUMNS.map(c => c.label), ...rows.map(r => COLUMNS.map(c => toPlain(c, getValue(r, c.key))))]), 5),
  exportCsvBytes: csvText.length,
  parseCsvMs: time(() => parseCSV(csvText), 5),
  // Alternates the value so every run validates and changes all 20,000 cells
  validatedBulkEdit20kMs: (() => { const m = new GridModel(generateRows()); let v = 5; return time(() => { v = v === 5 ? 6 : 5; m.edit(m.rows.map(r => ({ id: r.id, key: 'qty', raw: String(v) })), 'Fill down'); }, 5); })(),
  undo20kMs: (() => { const m = new GridModel(generateRows()); m.edit(m.rows.map(r => ({ id: r.id, key: 'qty', raw: '5' }))); const t0 = performance.now(); m.undo(); return +(performance.now() - t0).toFixed(2); })()
};
console.log(JSON.stringify(results, null, 1));
writeFileSync(join(here, 'bench-results.json'), JSON.stringify({ when: new Date().toISOString(), ...results }, null, 1));
