// Gridline core: pure logic with no DOM access.
// Data generation, column schema, parsing and validation, filtering, sorting,
// the undo history, CSV and TSV parsing and serializing, and range statistics.

export const REF_DATE = '2026-10-19';
export const ROW_COUNT = 20000;
export const SEED = 20261019;

export const CATEGORIES = ['Fasteners', 'Electrical', 'Plumbing', 'Safety', 'Packaging', 'Tools', 'HVAC', 'Janitorial'];
export const WAREHOUSES = ['Reno', 'Dayton', 'Tacoma', 'Savannah', 'Joliet'];
export const STATUSES = ['Draft', 'Submitted', 'Approved', 'Shipped', 'Received', 'Cancelled'];
export const PRIORITIES = ['Low', 'Normal', 'High', 'Rush'];
export const BUYERS = ['M. Okafor', 'J. Lindqvist', 'R. Takahashi', 'S. Moreno', 'A. Petrov', 'L. Haddad', 'D. Novak', 'K. Mensah'];

// Column schema. Order here is the default column order.
export const COLUMNS = [
  { key: 'id', label: 'PO number', type: 'id', readonly: true, width: 118 },
  { key: 'supplier', label: 'Supplier', type: 'text', required: true, max: 60, width: 200 },
  { key: 'item', label: 'Item', type: 'text', required: true, max: 80, width: 250 },
  { key: 'status', label: 'Status', type: 'enum', options: STATUSES, width: 124 },
  { key: 'priority', label: 'Priority', type: 'enum', options: PRIORITIES, width: 100 },
  { key: 'qty', label: 'Qty', type: 'int', min: 1, max: 100000, width: 88 },
  { key: 'unitCost', label: 'Unit cost', type: 'money', min: 1, max: 9999999, width: 108 },
  { key: 'total', label: 'Total', type: 'money', readonly: true, computed: true, width: 124 },
  { key: 'dueDate', label: 'Due', type: 'date', min: '2020-01-01', max: '2030-12-31', width: 114 },
  { key: 'orderDate', label: 'Ordered', type: 'date', min: '2020-01-01', max: '2030-12-31', width: 114 },
  { key: 'category', label: 'Category', type: 'enum', options: CATEGORIES, width: 120 },
  { key: 'warehouse', label: 'Warehouse', type: 'enum', options: WAREHOUSES, width: 116 },
  { key: 'sku', label: 'SKU', type: 'text', required: true, pattern: /^[A-Z]{3}-\d{5}$/, patternHint: 'three letters, a dash and five digits, like FST-20418', upper: true, width: 108 },
  { key: 'buyer', label: 'Buyer', type: 'text', required: true, max: 40, width: 130 },
  { key: 'notes', label: 'Notes', type: 'text', required: false, max: 120, width: 220 }
];
export const COLUMN_BY_KEY = Object.fromEntries(COLUMNS.map(c => [c.key, c]));
export const isNumericType = type => type === 'int' || type === 'money';

// Deterministic generator ------------------------------------------------

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATALOG = {
  Fasteners: { prefix: 'FST', cost: [4, 90], suppliers: ['Harlow Fastener Co.', 'Atlas Ridge Hardware', 'Pinecrest Bolt Works'],
    items: ['Hex bolt M8 x 40, zinc', 'Lock washer M10, box of 500', 'Carriage bolt 3/8 x 4 in', 'Self-tapping screw #10, box of 1,000', 'Nylon insert nut M12', 'Anchor bolt 1/2 x 6 in', 'Stainless rivet 3/16 in, box of 250'] },
  Electrical: { prefix: 'ELC', cost: [6, 420], suppliers: ['Brightwater Electric Supply', 'Tamarack Wire and Cable', 'Meridian Controls'],
    items: ['THHN wire 12 AWG, 500 ft', 'LED high bay 150 W', 'GFCI outlet 20 A', 'EMT conduit 3/4 in x 10 ft', 'Breaker 2-pole 30 A', 'Cable tray 12 in x 10 ft', 'Photocell sensor 120 V'] },
  Plumbing: { prefix: 'PLB', cost: [5, 680], suppliers: ['Granite Valley Plumbing', 'Pinecrest Fittings'],
    items: ['PEX tubing 3/4 in x 100 ft', 'Ball valve 1 in brass', 'Copper elbow 1/2 in, box of 50', 'Backflow preventer 2 in', 'PVC pipe 4 in x 10 ft', 'Floor drain 3 in'] },
  Safety: { prefix: 'SAF', cost: [8, 240], suppliers: ['Redline Safety Products', 'Foxglove Safety'],
    items: ['Nitrile gloves L, case of 1,000', 'Hard hat type II', 'Safety glasses clear, box of 12', 'Hi-vis vest class 2', 'Earplugs, box of 200', 'Fall arrest harness'] },
  Packaging: { prefix: 'PKG', cost: [9, 130], suppliers: ['Cobalt Packaging Works', 'Bluestem Packaging'],
    items: ['Stretch film 18 in x 1,500 ft', 'Corrugated box 18 x 12 x 12, bundle of 25', 'Packing tape 2 in, case of 36', 'Pallet 48 x 40, heat treated', 'Void fill paper roll', 'Poly mailer 12 x 15, case of 500'] },
  Tools: { prefix: 'TLS', cost: [12, 520], suppliers: ['Ironbark Tool Co.', 'Summit Abrasives', 'Atlas Ridge Hardware'],
    items: ['Cordless drill 20 V kit', 'Torque wrench 1/2 in drive', 'Socket set, 72 piece', 'Bandsaw blade 93 in', 'Impact driver bits, set of 40', 'Utility knife, pack of 10'] },
  HVAC: { prefix: 'HVC', cost: [18, 760], suppliers: ['Westmere HVAC Parts', 'Meridian Controls'],
    items: ['Pleated filter 20 x 25 x 4, case of 6', 'Condensate pump 115 V', 'Refrigerant R-454B, 25 lb', 'Programmable thermostat', 'Duct sealant, 1 gal', 'Blower motor 1/2 HP'] },
  Janitorial: { prefix: 'JAN', cost: [6, 95], suppliers: ['Clearview Janitorial', 'Oakhurst Industrial'],
    items: ['Trash liner 55 gal, case of 100', 'Floor cleaner concentrate, 5 gal', 'Paper towel roll, case of 12', 'Microfiber mop pad, pack of 12', 'Hand soap refill 1,000 ml, case of 6'] }
};
const NOTES = ['Split delivery allowed', 'Call before delivery', 'Dock 3 only', 'Confirm lead time with supplier', 'Price locked through Q4', 'Replaces a backordered line', 'Hold for inspection on arrival'];

const DAY = 86400000;
export const dateToDays = iso => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY);
export const daysToDate = days => new Date(days * DAY).toISOString().slice(0, 10);

function pickWeighted(rng, entries) {
  const total = entries.reduce((s, e) => s + e[1], 0);
  let x = rng() * total;
  for (const [v, w] of entries) { x -= w; if (x < 0) return v; }
  return entries[entries.length - 1][0];
}

export function generateRows(count = ROW_COUNT, seed = SEED) {
  const rng = mulberry32(seed);
  const start = dateToDays('2025-07-01');
  const end = dateToDays('2026-10-16');
  const ref = dateToDays(REF_DATE);
  const rows = new Array(count);
  for (let i = 0; i < count; i++) {
    const category = CATEGORIES[Math.floor(rng() * CATEGORIES.length)];
    const cat = CATALOG[category];
    const itemIdx = Math.floor(rng() * cat.items.length);
    const supplier = cat.suppliers[Math.floor(rng() * cat.suppliers.length)];
    const [lo, hi] = cat.cost;
    const unitCost = Math.round((lo + (hi - lo) * rng() * rng()) * 100);
    const maxQty = unitCost < 2000 ? 800 : unitCost < 10000 ? 200 : 40;
    const qty = 1 + Math.floor(maxQty * rng() * rng());
    const orderDays = start + Math.floor(rng() * (end - start + 1));
    const dueDays = orderDays + 5 + Math.floor(rng() * 36);
    let status;
    if (dueDays < ref - 30) status = pickWeighted(rng, [['Received', 82], ['Shipped', 6], ['Cancelled', 5], ['Approved', 4], ['Submitted', 3]]);
    else if (orderDays > ref - 45) status = pickWeighted(rng, [['Draft', 15], ['Submitted', 25], ['Approved', 30], ['Shipped', 25], ['Cancelled', 5]]);
    else status = pickWeighted(rng, [['Approved', 15], ['Shipped', 40], ['Received', 40], ['Cancelled', 5]]);
    rows[i] = {
      id: 'PO-' + (240001 + i),
      supplier,
      item: cat.items[itemIdx],
      status,
      priority: pickWeighted(rng, [['Low', 15], ['Normal', 60], ['High', 18], ['Rush', 7]]),
      qty,
      unitCost,
      dueDate: daysToDate(dueDays),
      orderDate: daysToDate(orderDays),
      category,
      warehouse: WAREHOUSES[Math.floor(rng() * WAREHOUSES.length)],
      sku: cat.prefix + '-' + (10000 + ((CATEGORIES.indexOf(category) * 7919 + itemIdx * 1373 + 97) % 89999)),
      buyer: BUYERS[Math.floor(rng() * BUYERS.length)],
      notes: rng() < 0.14 ? NOTES[Math.floor(rng() * NOTES.length)] : ''
    };
  }
  return rows;
}

// Values ------------------------------------------------------------------

export function getValue(row, key) {
  if (key === 'total') return row.qty * row.unitCost;
  return row[key];
}

const intFmt = new Intl.NumberFormat('en-US');
const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const formatInt = n => intFmt.format(n);
export const formatMoney = cents => moneyFmt.format(cents / 100);
export const centsToPlain = cents => {
  const neg = cents < 0; const a = Math.abs(cents);
  return (neg ? '-' : '') + Math.floor(a / 100) + '.' + String(a % 100).padStart(2, '0');
};

// Human display text for a value
export function formatValue(col, v) {
  if (v === '' || v === null || v === undefined) return '';
  if (col.type === 'int') return formatInt(v);
  if (col.type === 'money') return formatMoney(v);
  return String(v);
}

// Plain text used for editing, copy, TSV and CSV
export function toPlain(col, v) {
  if (v === '' || v === null || v === undefined) return '';
  if (col.type === 'money') return centsToPlain(v);
  return String(v);
}

function isValidIsoDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

// Parse raw text into a stored value. Returns { ok, value } or { ok: false, error }.
export function parseValue(col, raw) {
  const s = String(raw ?? '').trim();
  const name = col.label;
  if (col.readonly) return { ok: false, error: `${name} can't be edited.` };
  switch (col.type) {
    case 'int': {
      const t = s.replace(/[,\s]/g, '');
      if (!/^-?\d+$/.test(t)) return { ok: false, error: `${name} must be a whole number from ${formatInt(col.min)} to ${formatInt(col.max)}.` };
      const n = Number(t);
      if (n < col.min || n > col.max) return { ok: false, error: `${name} must be from ${formatInt(col.min)} to ${formatInt(col.max)}.` };
      return { ok: true, value: n };
    }
    case 'money': {
      const t = s.replace(/[$,\s]/g, '');
      const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(t);
      if (!m) return { ok: false, error: `${name} must be an amount like 12.50 with at most two decimals.` };
      const cents = (m[1] ? -1 : 1) * (Number(m[2]) * 100 + Number((m[3] || '').padEnd(2, '0')));
      if (cents < col.min || cents > col.max) return { ok: false, error: `${name} must be from ${formatMoney(col.min)} to ${formatMoney(col.max)}.` };
      return { ok: true, value: cents };
    }
    case 'date': {
      if (!isValidIsoDate(s)) return { ok: false, error: `${name} must be a real date written like 2026-03-14.` };
      if (s < col.min || s > col.max) return { ok: false, error: `${name} must be between ${col.min} and ${col.max}.` };
      return { ok: true, value: s };
    }
    case 'enum': {
      const hit = col.options.find(o => o.toLowerCase() === s.toLowerCase());
      if (!hit) return { ok: false, error: `${name} must be one of ${col.options.join(', ')}.` };
      return { ok: true, value: hit };
    }
    case 'text': {
      const t = col.upper ? s.toUpperCase() : s;
      if (!t && col.required) return { ok: false, error: `${name} is required.` };
      if (col.max && t.length > col.max) return { ok: false, error: `${name} can be at most ${col.max} characters.` };
      if (t && col.pattern && !col.pattern.test(t)) return { ok: false, error: `${name} must be ${col.patternHint}.` };
      return { ok: true, value: t };
    }
    default:
      return { ok: false, error: `${name} can't be edited.` };
  }
}

// Parse and check rules that depend on other fields of the same row.
// `row` must already contain any other pending values for that row.
export function validateCell(col, raw, row) {
  const r = parseValue(col, raw);
  if (!r.ok) return r;
  if (col.key === 'dueDate' && row && row.orderDate && r.value < row.orderDate) return { ok: false, error: `Due date can't be before the order date, ${row.orderDate}.` };
  if (col.key === 'orderDate' && row && row.dueDate && r.value > row.dueDate) return { ok: false, error: `Order date can't be after the due date, ${row.dueDate}.` };
  return r;
}

// Search and filters -------------------------------------------------------

const SEARCH_KEYS = ['id', 'supplier', 'item', 'status', 'priority', 'category', 'warehouse', 'sku', 'buyer', 'notes'];
const searchCache = new WeakMap();
export function searchText(row) {
  let s = searchCache.get(row);
  if (s === undefined) {
    s = SEARCH_KEYS.map(k => row[k]).join('\u0001').toLowerCase();
    searchCache.set(row, s);
  }
  return s;
}
export function invalidateRow(row) { searchCache.delete(row); }

export function isFilterActive(f) {
  if (!f) return false;
  if (f.kind === 'text') return !!(f.q && f.q.trim());
  if (f.kind === 'range') return Number.isFinite(f.min) || Number.isFinite(f.max);
  if (f.kind === 'date') return !!(f.from || f.to);
  if (f.kind === 'enum') return Array.isArray(f.values);
  return false;
}

export function filterKindFor(col) {
  if (col.type === 'enum') return 'enum';
  if (isNumericType(col.type)) return 'range';
  if (col.type === 'date') return 'date';
  return 'text';
}

function compileFilter(key, f) {
  const col = COLUMN_BY_KEY[key];
  if (!col || !isFilterActive(f)) return null;
  if (f.kind === 'text') {
    const q = f.q.trim().toLowerCase();
    return row => String(row[key]).toLowerCase().includes(q);
  }
  if (f.kind === 'range') {
    const min = Number.isFinite(f.min) ? f.min : -Infinity;
    const max = Number.isFinite(f.max) ? f.max : Infinity;
    return row => { const v = getValue(row, key); return v >= min && v <= max; };
  }
  if (f.kind === 'date') {
    const from = f.from || '0000-00-00', to = f.to || '9999-99-99';
    return row => { const v = row[key]; return v >= from && v <= to; };
  }
  if (f.kind === 'enum') {
    const set = new Set(f.values);
    return row => set.has(row[key]);
  }
  return null;
}

export function compilePredicate(filters = {}, search = '') {
  const preds = Object.entries(filters).map(([k, f]) => compileFilter(k, f)).filter(Boolean);
  const tokens = String(search || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length) preds.push(row => { const s = searchText(row); return tokens.every(t => s.includes(t)); });
  if (!preds.length) return null;
  return row => { for (const p of preds) if (!p(row)) return false; return true; };
}

// Sorting ------------------------------------------------------------------

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

// Build a numeric key per row index so the comparator only compares numbers.
// Empty strings sort last in both directions.
function sortKeys(rows, indices, key) {
  const col = COLUMN_BY_KEY[key];
  const keys = new Float64Array(rows.length);
  if (isNumericType(col.type)) {
    for (const i of indices) keys[i] = getValue(rows[i], key);
    return { keys, empty: null };
  }
  if (col.type === 'enum') {
    // Enums sort in list order, so Draft comes before Shipped and Rush after High.
    const rank = new Map(col.options.map((o, n) => [o, n]));
    for (const i of indices) keys[i] = rank.has(rows[i][key]) ? rank.get(rows[i][key]) : col.options.length;
    return { keys, empty: null };
  }
  const uniq = new Set();
  for (const i of indices) uniq.add(rows[i][key]);
  const sorted = [...uniq].filter(v => v !== '');
  if (col.type === 'date') sorted.sort(); else sorted.sort(collator.compare);
  const rank = new Map(sorted.map((v, n) => [v, n]));
  const empty = new Uint8Array(rows.length);
  for (const i of indices) {
    const v = rows[i][key];
    if (v === '') { empty[i] = 1; keys[i] = 0; } else keys[i] = rank.get(v);
  }
  return { keys, empty };
}

export function sortIndices(rows, indices, sort = []) {
  const specs = sort.filter(s => COLUMN_BY_KEY[s.key]).map(s => ({ dir: s.dir === -1 ? -1 : 1, ...sortKeys(rows, indices, s.key) }));
  const out = Array.from(indices);
  if (!specs.length) return out;
  out.sort((a, b) => {
    for (const s of specs) {
      if (s.empty) {
        const ea = s.empty[a], eb = s.empty[b];
        if (ea !== eb) return ea - eb;
        if (ea) continue;
      }
      const d = s.keys[a] - s.keys[b];
      if (d) return d * s.dir;
    }
    return a - b;
  });
  return out;
}

export function computeView(rows, { filters = {}, search = '', sort = [] } = {}) {
  const pred = compilePredicate(filters, search);
  let idx;
  if (pred) { idx = []; for (let i = 0; i < rows.length; i++) if (pred(rows[i])) idx.push(i); }
  else { idx = new Array(rows.length); for (let i = 0; i < rows.length; i++) idx[i] = i; }
  return sort.length ? sortIndices(rows, idx, sort) : idx;
}

// Sort spec helpers used by header clicks
export function toggleSort(sort, key, additive) {
  const cur = sort.find(s => s.key === key);
  if (!additive) {
    if (!cur || sort.length > 1) return [{ key, dir: cur && sort.length === 1 ? -cur.dir : 1 }];
    return cur.dir === 1 ? [{ key, dir: -1 }] : [];
  }
  if (!cur) return [...sort, { key, dir: 1 }];
  if (cur.dir === 1) return sort.map(s => s.key === key ? { key, dir: -1 } : s);
  return sort.filter(s => s.key !== key);
}

// Undo history --------------------------------------------------------------

export class History {
  constructor(limit = 500) { this.limit = limit; this.past = []; this.future = []; }
  push(batch) {
    if (!batch || !batch.changes || !batch.changes.length) return false;
    this.past.push(batch);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
    return true;
  }
  undo() { const b = this.past.pop(); if (b) this.future.push(b); return b || null; }
  redo() { const b = this.future.pop(); if (b) this.past.push(b); return b || null; }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  peekUndo() { return this.past[this.past.length - 1] || null; }
  peekRedo() { return this.future[this.future.length - 1] || null; }
}

// CSV and TSV ---------------------------------------------------------------

export function detectDelimiter(text) {
  const first = text.replace(/^﻿/, '').split(/\r?\n/, 1)[0] || '';
  const count = ch => { let n = 0, q = false; for (const c of first) { if (c === '"') q = !q; else if (!q && c === ch) n++; } return n; };
  const options = [[',', count(',')], [';', count(';')], ['\t', count('\t')]];
  options.sort((a, b) => b[1] - a[1]);
  return options[0][1] > 0 ? options[0][0] : ',';
}

// RFC 4180 style parser. Handles quotes, doubled quotes, CRLF and newlines inside quotes.
export function parseDelimited(text, delimiter = ',') {
  const src = String(text).replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', i = 0, inQuotes = false, quotedLine = 0, line = 1;
  while (i < src.length) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      if (c === '\n') line++;
      field += c; i++; continue;
    }
    if (c === '"' && field === '') { inQuotes = true; quotedLine = line; i++; continue; }
    if (c === delimiter) { row.push(field); field = ''; i++; continue; }
    if (c === '\r' || c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
      if (c === '\r' && src[i + 1] === '\n') i++;
      i++; line++; continue;
    }
    field += c; i++;
  }
  if (inQuotes) return { rows: [], error: `A quoted value that starts on line ${quotedLine} is never closed.` };
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return { rows: rows.filter(r => !(r.length === 1 && r[0] === '')), error: null };
}

export const parseCSV = text => parseDelimited(text, detectDelimiter(text));

// Quote a CSV field when needed. Text that a spreadsheet would run as a formula gets a leading apostrophe.
export function csvField(value, { guardFormulas = true } = {}) {
  let s = value === null || value === undefined ? '' : String(value);
  if (guardFormulas && /^[=+@\t\r]/.test(s)) s = "'" + s;
  else if (guardFormulas && /^-/.test(s) && !/^-\d+(\.\d+)?$/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export const toCSV = rows => rows.map(r => r.map(v => csvField(v)).join(',')).join('\r\n') + '\r\n';

export const parseTSV = text => {
  const t = String(text).replace(/\r?\n$/, '');
  return parseDelimited(t, '\t').rows;
};
export const toTSV = rows => rows.map(r => r.map(v => {
  const s = String(v ?? '');
  return /[\t\r\n"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}).join('\t')).join('\n');

// Import mapping --------------------------------------------------------------

const ALIASES = {
  id: ['po', 'po number', 'po no', 'po #', 'purchase order', 'order id', 'id'],
  unitCost: ['unit cost', 'unit price', 'price', 'cost'],
  qty: ['qty', 'quantity', 'units'],
  dueDate: ['due', 'due date', 'needed by'],
  orderDate: ['ordered', 'order date', 'date ordered'],
  sku: ['sku', 'part number', 'item code'],
  item: ['item', 'description', 'item description'],
  total: ['total', 'line total', 'amount']
};
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9#]+/g, ' ').trim();

export function guessMapping(headers) {
  const used = new Set();
  return headers.map(h => {
    const n = norm(h);
    let hit = COLUMNS.find(c => !used.has(c.key) && (norm(c.label) === n || norm(c.key) === n || (ALIASES[c.key] || []).includes(n)));
    if (!hit) return null;
    used.add(hit.key);
    return hit.key;
  });
}

// A small import file to try the importer: mostly valid updates plus four rows with problems.
export function sampleImportCSV(rows) {
  const out = [['PO number', 'Status', 'Quantity', 'Unit price', 'Due date', 'Notes']];
  const pick = [12, 40, 77, 103, 150, 222, 301, 415, 518, 640, 777, 903, 1040, 1200, 1333, 1500];
  pick.forEach((i, n) => {
    const r = rows[i];
    out.push([r.id, n % 3 === 0 ? 'Approved' : r.status, String(r.qty + 10), centsToPlain(r.unitCost), r.dueDate, n % 4 === 0 ? 'Updated from supplier confirmation' : r.notes]);
  });
  out.push(['PO-999999', 'Approved', '5', '10.00', '2026-11-30', '']);
  out.push([rows[60].id, 'Shipped', 'twelve', centsToPlain(rows[60].unitCost), rows[60].dueDate, '']);
  out.push([rows[61].id, 'Shipped', String(rows[61].qty), centsToPlain(rows[61].unitCost), '2020-01-01', 'Due date before the order date']);
  out.push([rows[62].id, 'Lost', String(rows[62].qty), centsToPlain(rows[62].unitCost), rows[62].dueDate, '']);
  return toCSV(out);
}

// Statistics -------------------------------------------------------------------

export function rangeStats(values) {
  let count = 0, sum = 0, min = Infinity, max = -Infinity;
  for (const v of values) {
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    count++; sum += v; if (v < min) min = v; if (v > max) max = v;
  }
  return count ? { count, sum, avg: sum / count, min, max } : { count: 0, sum: 0, avg: 0, min: 0, max: 0 };
}

// Filter descriptions for chips ---------------------------------------------------

export function describeFilter(key, f) {
  const col = COLUMN_BY_KEY[key];
  if (!col || !isFilterActive(f)) return '';
  const fmt = v => col.type === 'money' ? formatMoney(v) : formatInt(v);
  if (f.kind === 'text') return `${col.label} contains "${f.q.trim()}"`;
  if (f.kind === 'enum') return f.values.length ? `${col.label}: ${f.values.join(', ')}` : `${col.label}: none selected`;
  if (f.kind === 'range') {
    const lo = Number.isFinite(f.min), hi = Number.isFinite(f.max);
    if (lo && hi) return `${col.label} ${fmt(f.min)} to ${fmt(f.max)}`;
    return lo ? `${col.label} at least ${fmt(f.min)}` : `${col.label} at most ${fmt(f.max)}`;
  }
  if (f.kind === 'date') {
    if (f.from && f.to) return `${col.label} ${f.from} to ${f.to}`;
    return f.from ? `${col.label} from ${f.from}` : `${col.label} until ${f.to}`;
  }
  return '';
}

// Saved view validation ------------------------------------------------------------

export function sanitizeView(v) {
  if (!v || typeof v !== 'object' || typeof v.name !== 'string' || !v.name.trim()) return null;
  const filters = {};
  for (const [k, f] of Object.entries(v.filters || {})) {
    const col = COLUMN_BY_KEY[k];
    if (!col || !f || f.kind !== filterKindFor(col)) continue;
    if (f.kind === 'text' && typeof f.q === 'string') filters[k] = { kind: 'text', q: f.q };
    if (f.kind === 'range') filters[k] = { kind: 'range', min: Number.isFinite(f.min) ? f.min : null, max: Number.isFinite(f.max) ? f.max : null };
    if (f.kind === 'date') filters[k] = { kind: 'date', from: isValidIsoDate(f.from) ? f.from : '', to: isValidIsoDate(f.to) ? f.to : '' };
    if (f.kind === 'enum' && Array.isArray(f.values)) filters[k] = { kind: 'enum', values: f.values.filter(x => col.options.includes(x)) };
    if (filters[k] && !isFilterActive(filters[k])) delete filters[k];
  }
  const sort = (Array.isArray(v.sort) ? v.sort : []).filter(s => s && COLUMN_BY_KEY[s.key]).map(s => ({ key: s.key, dir: s.dir === -1 ? -1 : 1 }));
  const seen = new Set();
  const columns = (Array.isArray(v.columns) ? v.columns : []).filter(c => c && COLUMN_BY_KEY[c.key] && !seen.has(c.key) && seen.add(c.key))
    .map(c => ({ key: c.key, width: Math.min(600, Math.max(60, Number(c.width) || COLUMN_BY_KEY[c.key].width)), hidden: !!c.hidden, pinned: !!c.pinned }));
  for (const c of COLUMNS) if (!seen.has(c.key)) columns.push({ key: c.key, width: c.width, hidden: false, pinned: false });
  return { name: v.name.trim().slice(0, 40), filters, sort, search: typeof v.search === 'string' ? v.search : '', columns };
}
