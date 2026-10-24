// ExportCheck bench: a JavaScript port of the row and file checks in exportcheck.py 1.0.0.
// It runs in the browser and in Node, so the same code can be compared with the Python tool.

export const DEFAULT_MAX_ROWS = 10000;
export const DEFAULT_MAX_BYTES = 5000000;
export const DEFAULT_MAX_OUTPUT_BYTES = 20000000;
export const HARD_MAX_ROWS = 100000;
export const HARD_MAX_BYTES = 50000000;
export const HARD_MAX_OUTPUT_BYTES = 50000000;
const MAX_RULES_BYTES = 64000;
const MAX_COLUMNS = 256;
const MAX_FIELD_CHARS = 256000;
const MAX_DECIMAL_CHARS = 64;
const MAX_DECIMAL_SCALE = 12;

const DECIMAL_TEXT = /^[+-]?[0-9]+(?:\.[0-9]+)?$/;
const DATE_TEXT = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const SAFE_SIGNED_NUMBER = /^[+-]?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/;

export class Failure extends Error {
  constructor(kind, code, message) { super(message); this.kind = kind; this.code = code; }
}
const fileFailure = (code, message) => new Failure("file", code, message);

const enc = new TextEncoder();
const utf8Len = (s) => enc.encode(s).length;

// ---------- decimals ----------
function parseDec(text) {
  const neg = text[0] === "-";
  const body = text[0] === "-" || text[0] === "+" ? text.slice(1) : text;
  const [int, frac = ""] = body.split(".");
  return { neg, int, frac };
}
function decCompare(a, b) {
  const A = parseDec(a), B = parseDec(b);
  const scale = Math.max(A.frac.length, B.frac.length);
  const big = (d) => { const v = BigInt(d.int + d.frac.padEnd(scale, "0")); return d.neg ? -v : v; };
  const x = big(A), y = big(B);
  return x < y ? -1 : x > y ? 1 : 0;
}
const decScale = (text) => (text.includes(".") ? text.split(".")[1].length : 0);

// ---------- rules ----------
function stringList(value, label, allowEmpty) {
  if (!Array.isArray(value)) throw new Error(`${label} must be a JSON array of strings`);
  if (!value.length && !allowEmpty) throw new Error(`${label} must contain at least one item`);
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) throw new Error(`${label} items must be non-empty strings`);
    if (seen.has(item)) throw new Error(`${label} contains a duplicate item`);
    seen.add(item);
  }
  return value.slice();
}
function ruleDecimal(value, label) {
  if (typeof value !== "string" || value.length > MAX_DECIMAL_CHARS || !DECIMAL_TEXT.test(value)) throw new Error(`${label} must be a plain finite decimal string`);
  return value;
}
class PyFloat { constructor(v) { this.value = v; } }
const isInt = (v) => typeof v === "number";
const isDict = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof PyFloat);
function positiveLimit(value, label, def, hardMax) {
  if (value === undefined) return def;
  if (!isInt(value) || value < 1 || value > hardMax) throw new Error(`limits.${label} must be an integer from 1 to ${hardMax}`);
  return value;
}
function sortedFirst(keys) { return keys.slice().sort()[0]; }

// JSON.parse with a duplicate key check, like object_pairs_hook in the Python tool.
function parseJsonStrict(text) {
  let i = 0;
  const ws = () => { while (i < text.length && " \t\n\r".includes(text[i])) i++; };
  // same wording and position format as Python's json.JSONDecodeError
  const fail = (m, at = i) => {
    const before = text.slice(0, at);
    const ln = (before.match(/\n/g) || []).length + 1;
    const col = at - (before.lastIndexOf("\n") + 1) + 1;
    throw new SyntaxError(`${m}: line ${ln} column ${col} (char ${at})`);
  };
  function value() {
    ws();
    const c = text[i];
    if (c === "{") {
      i++; const out = {}; ws();
      if (text[i] === "}") { i++; return out; }
      for (;;) {
        ws(); if (text[i] !== '"') fail("Expecting property name enclosed in double quotes");
        const key = str(); ws(); if (text[i] !== ":") fail("Expecting ':' delimiter"); i++;
        const v = value();
        if (Object.prototype.hasOwnProperty.call(out, key)) throw new Error(`duplicate JSON key '${key}'`);
        out[key] = v; ws();
        if (text[i] === ",") { i++; continue; }
        if (text[i] === "}") { i++; return out; }
        fail("Expecting ',' delimiter");
      }
    }
    if (c === "[") {
      i++; const out = []; ws();
      if (text[i] === "]") { i++; return out; }
      for (;;) { out.push(value()); ws(); if (text[i] === ",") { i++; continue; } if (text[i] === "]") { i++; return out; } fail("Expecting ',' delimiter"); }
    }
    if (c === '"') return str();
    const m = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i));
    if (m && m[0]) { i += m[0].length; return /[.eE]/.test(m[0]) ? new PyFloat(Number(m[0])) : Number(m[0]); }
    for (const [lit, v] of [["true", true], ["false", false], ["null", null], ["NaN", new PyFloat(NaN)], ["Infinity", new PyFloat(Infinity)], ["-Infinity", new PyFloat(-Infinity)]]) if (text.startsWith(lit, i)) { i += lit.length; return v; }
    fail("Expecting value");
  }
  function str() {
    const start = i; i++;
    for (;;) {
      if (i >= text.length) fail("Unterminated string starting at", start);
      const c = text[i];
      if (c === "\\") {
        const e = text[i + 1];
        if (e === undefined) fail("Unterminated string starting at", start);
        if (e === "u") { if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) fail("Invalid \\uXXXX escape", i + 1); i += 6; continue; }
        if (!'"\\/bfnrt'.includes(e)) fail("Invalid \\escape", i);
        i += 2; continue;
      }
      if (c === '"') { i++; break; }
      if (c < " ") fail("Invalid control character at", i);
      i++;
    }
    return JSON.parse(text.slice(start, i));
  }
  const v = value(); ws();
  if (i < text.length) fail("Extra data");
  return v;
}

export function loadRules(text) {
  if (utf8Len(text) > MAX_RULES_BYTES) throw fileFailure("rules_too_large", `The rules file exceeds its ${MAX_RULES_BYTES}-byte limit.`);
  let doc;
  try { doc = parseJsonStrict(text.replace(/^﻿/, "")); }
  catch (e) { throw fileFailure("invalid_rules_json", `The rules file is not valid JSON: ${e.message}`); }
  try { return validateRules(doc); }
  catch (e) { throw fileFailure("invalid_rules", e.message); }
}

function validateRules(doc) {
  if (!isDict(doc)) throw new Error("the rules document must be a JSON object");
  const allowed = ["schema_version", "required_headers", "unique_key", "required_values", "string_enums", "iso_dates", "decimals", "limits"];
  const unknown = Object.keys(doc).filter((k) => !allowed.includes(k));
  if (unknown.length) throw new Error(`unknown rules key: ${sortedFirst(unknown)}`);
  if (!isInt(doc.schema_version) || doc.schema_version !== 1) throw new Error("schema_version must be 1");
  const headers = stringList(doc.required_headers, "required_headers", false);
  if (headers.length > MAX_COLUMNS) throw new Error(`required_headers may contain at most ${MAX_COLUMNS} columns`);
  const hset = new Set(headers);
  let uniqueKey = doc.unique_key === undefined ? null : doc.unique_key;
  if (uniqueKey !== null) {
    if (typeof uniqueKey !== "string" || !uniqueKey.trim()) throw new Error("unique_key must be a non-empty header name or null");
    if (!hset.has(uniqueKey)) throw new Error("unique_key must appear in required_headers");
  }
  const requiredValues = stringList(doc.required_values === undefined ? [] : doc.required_values, "required_values", true);
  if (!requiredValues.every((v) => hset.has(v))) throw new Error("every required_values item must appear in required_headers");
  const rawEnums = doc.string_enums === undefined ? {} : doc.string_enums;
  if (!isDict(rawEnums)) throw new Error("string_enums must be a JSON object");
  const enums = {};
  for (const [col, choices] of Object.entries(rawEnums)) {
    if (!hset.has(col)) throw new Error("every string_enums key must appear in required_headers");
    enums[col] = new Set(stringList(choices, `string_enums.${col}`, false));
  }
  const isoDates = stringList(doc.iso_dates === undefined ? [] : doc.iso_dates, "iso_dates", true);
  if (!isoDates.every((v) => hset.has(v))) throw new Error("every iso_dates item must appear in required_headers");
  const rawDec = doc.decimals === undefined ? {} : doc.decimals;
  if (!isDict(rawDec)) throw new Error("decimals must be a JSON object");
  const decimals = {};
  for (const [col, spec] of Object.entries(rawDec)) {
    if (!hset.has(col)) throw new Error("every decimals key must appear in required_headers");
    if (!isDict(spec)) throw new Error(`decimals.${col} must be an object`);
    const keys = Object.keys(spec).sort().join(",");
    if (keys !== "max,max_scale,min") throw new Error(`decimals.${col} must define min, max, and max_scale only`);
    const min = ruleDecimal(spec.min, `decimals.${col}.min`);
    const max = ruleDecimal(spec.max, `decimals.${col}.max`);
    const scale = spec.max_scale;
    if (!isInt(scale) || scale < 0 || scale > MAX_DECIMAL_SCALE) throw new Error(`decimals.${col}.max_scale must be from 0 to ${MAX_DECIMAL_SCALE}`);
    if (decCompare(min, max) > 0) throw new Error(`decimals.${col}.min must be less than or equal to max`);
    if (decScale(min) > scale || decScale(max) > scale) throw new Error(`decimals.${col} bounds may not exceed max_scale`);
    decimals[col] = { min, max, scale };
  }
  const typed = new Set([...Object.keys(enums), ...isoDates, ...Object.keys(decimals)]);
  if (typed.size !== Object.keys(enums).length + isoDates.length + Object.keys(decimals).length) throw new Error("a header may have only one type rule");
  const rawLimits = doc.limits === undefined ? {} : doc.limits;
  if (!isDict(rawLimits)) throw new Error("limits must be a JSON object");
  const unknownLimits = Object.keys(rawLimits).filter((k) => !["max_rows", "max_bytes", "max_output_bytes"].includes(k));
  if (unknownLimits.length) throw new Error(`unknown limit: ${sortedFirst(unknownLimits)}`);
  if (["max_rows", "max_bytes", "max_output_bytes"].some((k) => k in rawLimits && rawLimits[k] === null)) throw new Error("configured limits must be positive integers, not null");
  return {
    headers, uniqueKey, requiredValues, enums, isoDates, decimals,
    maxRows: positiveLimit(rawLimits.max_rows, "max_rows", DEFAULT_MAX_ROWS, HARD_MAX_ROWS),
    maxBytes: positiveLimit(rawLimits.max_bytes, "max_bytes", DEFAULT_MAX_BYTES, HARD_MAX_BYTES),
    maxOutputBytes: positiveLimit(rawLimits.max_output_bytes, "max_output_bytes", DEFAULT_MAX_OUTPUT_BYTES, HARD_MAX_OUTPUT_BYTES),
  };
}

// ---------- CSV reader, following the state machine of Python's csv module (excel dialect, strict) ----------
// Returns records with the physical line each one started on, so the page can point back at the input.
export function* readCsv(text) {
  // split like io.StringIO(newline=""): lines end at \n, \r or \r\n and keep their terminator
  const lines = text.match(/[^\r\n]*(?:\r\n|\r|\n)|[^\r\n]+$/g) || [];
  let state = "START_RECORD", field = "", fields = [], fieldLen = 0, startLine = 1, line = 0;
  const save = () => { fields.push(field); field = ""; fieldLen = 0; };
  const add = (c) => { if (fieldLen >= MAX_FIELD_CHARS) throw new Error(`field larger than field limit (${MAX_FIELD_CHARS})`); field += c; fieldLen++; };
  const EOL = null;
  function proc(c) {
    switch (state) {
      case "START_RECORD":
        if (c === EOL) return "EMPTY";
        if (c === "\n" || c === "\r") { state = "EAT_CRNL"; return; }
        state = "START_FIELD";
      // falls through
      case "START_FIELD":
        if (c === "\n" || c === "\r" || c === EOL) { save(); state = c === EOL ? "START_RECORD" : "EAT_CRNL"; }
        else if (c === '"') state = "IN_QUOTED_FIELD";
        else if (c === ",") save();
        else { add(c); state = "IN_FIELD"; }
        return;
      case "IN_FIELD":
        if (c === "\n" || c === "\r" || c === EOL) { save(); state = c === EOL ? "START_RECORD" : "EAT_CRNL"; }
        else if (c === ",") { save(); state = "START_FIELD"; }
        else add(c);
        return;
      case "IN_QUOTED_FIELD":
        if (c === EOL) return;
        if (c === '"') state = "QUOTE_IN_QUOTED_FIELD";
        else add(c);
        return;
      case "QUOTE_IN_QUOTED_FIELD":
        if (c === '"') { add(c); state = "IN_QUOTED_FIELD"; }
        else if (c === ",") { save(); state = "START_FIELD"; }
        else if (c === "\n" || c === "\r" || c === EOL) { save(); state = c === EOL ? "START_RECORD" : "EAT_CRNL"; }
        else throw new Error(`',' expected after '"'`);
        return;
      case "EAT_CRNL":
        if (c === "\n" || c === "\r") return;
        if (c === EOL) { state = "START_RECORD"; return; }
        throw new Error("new-line character seen in unquoted field - do you need to open the file with newline=''?");
    }
  }
  let li = 0;
  while (li < lines.length) {
    fields = []; startLine = li + 1;
    let empty = false;
    do {
      if (li >= lines.length) {
        if (fieldLen !== 0 || state === "IN_QUOTED_FIELD") throw new Error("unexpected end of data");
        return;
      }
      const l = lines[li++]; line = li;
      for (const c of l) proc(c);
      if (proc(EOL) === "EMPTY") empty = true;
    } while (state !== "START_RECORD");
    yield { cells: empty ? [] : fields, line: startLine, endLine: line };
  }
}

// ---------- CSV writer, QUOTE_MINIMAL with "\n" terminators ----------
function quoteField(v) {
  if (/[",\n\r]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}
export function writeRow(values) {
  if (values.length === 1 && values[0] === "") return '""\n';
  return values.map(quoteField).join(",") + "\n";
}
function formulaSafe(value) {
  const stripped = value.replace(/^\s+/, "");
  if (!stripped || !"=+-@".includes(stripped[0])) return [value, false];
  if (SAFE_SIGNED_NUMBER.test(stripped)) return [value, false];
  return ["'" + value, true];
}
function safeRow(values) {
  let n = 0;
  const out = values.map((v) => { const [s, c] = formulaSafe(String(v)); n += c ? 1 : 0; return s; });
  return { text: writeRow(out), escaped: n };
}

const pyJson = (row) => JSON.stringify(row);

function validDate(v) {
  if (!DATE_TEXT.test(v)) return false;
  const y = +v.slice(0, 4), m = +v.slice(5, 7), d = +v.slice(8, 10);
  if (y < 1 || m < 1 || m > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return d <= dim;
}

function decimalIssue(value, rule) {
  if (value.length > MAX_DECIMAL_CHARS || !DECIMAL_TEXT.test(value)) return ["invalid_decimal", "Use a finite decimal without exponent notation."];
  if (decScale(value) > rule.scale) return ["decimal_scale", `Use no more than ${rule.scale} digits after the decimal point.`];
  if (decCompare(value, rule.min) < 0 || decCompare(value, rule.max) > 0) return ["decimal_out_of_range", "The value is outside the configured inclusive range."];
  return null;
}

function rowIssues(row, headerIndex, width, rules, recordNumber, seenUnique) {
  if (row.length !== width) return [{ row: recordNumber, column: "_row", code: "row_width", message: `Expected ${width} cells, found ${row.length}.`, raw: pyJson(row) }];
  const issues = [];
  const add = (column, code, message, raw) => issues.push({ row: recordNumber, column, code, message, raw });
  for (const col of rules.requiredValues) { const v = row[headerIndex[col]]; if (!v.trim()) add(col, "required_value_missing", "A value is required.", v); }
  if (rules.uniqueKey !== null) {
    const v = row[headerIndex[rules.uniqueKey]];
    if (!v.trim()) { if (!rules.requiredValues.includes(rules.uniqueKey)) add(rules.uniqueKey, "unique_key_missing", "The unique key may not be blank.", v); }
    else if (seenUnique.has(v)) add(rules.uniqueKey, "duplicate_unique_key", `The unique key already appeared on record ${seenUnique.get(v)}.`, v);
    else seenUnique.set(v, recordNumber);
  }
  for (const [col, choices] of Object.entries(rules.enums)) { const v = row[headerIndex[col]]; if (v.trim() && !choices.has(v)) add(col, "enum_value_invalid", "The value is not one of the configured choices.", v); }
  for (const col of rules.isoDates) { const v = row[headerIndex[col]]; if (v.trim() && !validDate(v)) add(col, "iso_date_invalid", "Use a valid date in YYYY-MM-DD form.", v); }
  for (const [col, rule] of Object.entries(rules.decimals)) { const v = row[headerIndex[col]]; if (v.trim()) { const i = decimalIssue(v, rule); if (i) add(col, i[0], i[1], v); } }
  return issues;
}

const TRANSFORMATIONS = {
  formula_safety: "Formula-like text is prefixed with an apostrophe. Strict signed decimal text is left unchanged.",
  cell_normalization: "None. Cell values are preserved except for formula-safe prefixes.",
  csv_serialization: "Rows are reserialized with Python CSV quoting. Quoting style may differ while parsed cell values stay the same.",
  csv_encoding: "UTF-8 without a byte-order mark.",
  csv_record_terminator: "LF. Input line endings are normalized by CSV output writing.",
  rejected_rows: "Every rejected data row appears in row-errors.csv and in the rejected row count.",
};

// bytes: Uint8Array of the input file. sha256: async (Uint8Array) => hex
export async function runExport({ fileName, bytes, rulesText, sha256 }) {
  const rules = loadRules(rulesText);
  if (bytes.length > rules.maxBytes) throw fileFailure("input_too_large", `The input file exceeds its ${rules.maxBytes}-byte limit.`);
  if (!bytes.length) throw fileFailure("empty_input", "The CSV file is empty and has no header row.");
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw fileFailure("invalid_input_encoding", "The CSV file must be UTF-8, with or without a BOM."); }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const reader = readCsv(text);
  let first;
  try { first = reader.next(); } catch (e) { throw fileFailure("invalid_csv", `Could not read the CSV header: ${e.message}`); }
  const header = first.done ? null : first.value.cells;
  if (!header || !header.length) throw fileFailure("missing_header", "The CSV file has no header row.");
  if (header.length > MAX_COLUMNS) throw fileFailure("too_many_columns", `The CSV may contain at most ${MAX_COLUMNS} columns.`);
  if (header.some((n) => !n.trim())) throw fileFailure("empty_header", "Every CSV header must have a non-empty name.");
  if (new Set(header).size !== header.length) throw fileFailure("duplicate_headers", "The CSV header contains duplicate names.");
  const missing = rules.headers.filter((n) => !header.includes(n));
  if (missing.length) throw fileFailure("required_headers_missing", "The CSV is missing required headers: " + missing.join(", "));

  const headerIndex = {}; header.forEach((n, i) => { headerIndex[n] = i; });
  let budget = 0;
  const spend = (s) => { budget += utf8Len(s); if (budget > rules.maxOutputBytes) throw fileFailure("output_byte_limit_exceeded", `The result files exceed their configured ${rules.maxOutputBytes}-byte limit.`); return s; };
  let clean = "", errors = "", escaped = 0;
  let w = safeRow(header); clean += spend(w.text); escaped += w.escaped;
  w = safeRow(["row_number", "column", "code", "message", "raw_value", "original_row_json"]); errors += spend(w.text); escaped += w.escaped;
  let dataRows = 0, accepted = 0, rejected = 0, errorCount = 0;
  const seen = new Map();
  const records = [];
  try {
    for (const rec of reader) {
      dataRows++;
      if (dataRows > rules.maxRows) throw fileFailure("row_limit_exceeded", `The CSV has more than its configured ${rules.maxRows} data rows.`);
      const recordNumber = dataRows + 1;
      const issues = rowIssues(rec.cells, headerIndex, header.length, rules, recordNumber, seen);
      if (issues.length) {
        rejected++;
        const original = pyJson(rec.cells);
        for (const is of issues) { w = safeRow([String(is.row), is.column, is.code, is.message, is.raw, original]); errors += spend(w.text); escaped += w.escaped; errorCount++; }
      } else {
        accepted++;
        w = safeRow(rec.cells); clean += spend(w.text); escaped += w.escaped;
      }
      records.push({ record: recordNumber, line: rec.line, endLine: rec.endLine, cells: rec.cells, issues });
    }
  } catch (e) {
    if (e instanceof Failure) throw e;
    throw fileFailure("invalid_csv", `The CSV structure is invalid: ${e.message}`);
  }
  const summary = {
    summary_version: 1,
    tool: "ExportCheck",
    status: rejected ? "completed_with_rejected_rows" : "completed",
    input: { file_name: fileName, sha256: await sha256(bytes), bytes: bytes.length },
    limits: {
      max_rows: rules.maxRows, max_input_bytes: rules.maxBytes, max_output_bytes: rules.maxOutputBytes,
      hard_max_rows: HARD_MAX_ROWS, hard_max_input_bytes: HARD_MAX_BYTES, hard_max_output_bytes: HARD_MAX_OUTPUT_BYTES,
      max_columns: MAX_COLUMNS, max_field_characters: MAX_FIELD_CHARS,
    },
    records: { data_rows: dataRows, accepted_rows: accepted, rejected_rows: rejected, row_error_entries: errorCount },
    outputs: { clean_csv: "clean.csv", row_errors_csv: "row-errors.csv", summary_json: "summary.json" },
    transformations: { formula_safe_prefixes: escaped, ...TRANSFORMATIONS },
  };
  const summaryText = JSON.stringify(summary, null, 2) + "\n";
  if (budget + utf8Len(summaryText) > rules.maxOutputBytes) throw fileFailure("output_byte_limit_exceeded", `The result files exceed their configured ${rules.maxOutputBytes}-byte limit.`);
  return { exitCode: rejected ? 1 : 0, header, records, clean, errors, summaryText, summary, prefixes: escaped };
}

export function stderrLine(f) { return `ExportCheck file failure [${f.code}]: ${f.message}`; }
