// ExportCheck preview page. Same bench as exportcheck-page.mjs, plus the split sheet at the top of the page:
// the input rows, the good ones kept in place, the failed ones pulled out to the right with the reason.
import { runExport, loadRules, Failure, stderrLine } from "../../exportcheck-bench.mjs";

const proof = JSON.parse(document.getElementById("proof-data").textContent);
const $ = (id) => document.getElementById(id);
const enc = new TextEncoder();
const BIG = 400000;
const SHOW_RECORDS = 300;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

// A made-up order export with four typical problems. It is checked live by the same code as the bench.
const ORDERS = {
  name: "orders.csv",
  output_directory: "runs/orders",
  text: "order_id,customer,status,ordered_on,amount,notes\n"
    + "ORD-5001,Harbor Cafe,paid,2026-10-02,412.00,\n"
    + "ORD-5002,Northside Bakery,open,2026-10-03,88.50,Deliver before 9\n"
    + "ORD-5003,Lotus Spa,paid,2026-10-03,1250.00,\n"
    + "ORD-5004,,open,2026-10-04,64.00,\n"
    + "ORD-5005,Green Fork,shipped,2026-10-05,230.00,\n"
    + "ORD-5006,Blue Door Hostel,paid,2026-10-06,975.20,Invoice by email\n"
    + "ORD-5007,Sea Breeze Tours,open,2026-02-30,310.00,\n"
    + "ORD-5008,Hilltop Market,cancelled,2026-10-07,0,Customer cancelled\n"
    + "ORD-5009,Rice and Co,paid,2026-10-08,58.125,\n"
    + "ORD-5010,Kata Surf Shop,paid,2026-10-08,140.00,\n"
    + "ORD-5011,Old Town Print,open,2026-10-09,36.00,\n"
    + "ORD-5012,Palm Laundry,paid,2026-10-09,22.50,Weekly\n",
};
function sample(key) {
  if (key === "orders") return { name: ORDERS.name, text: ORDERS.text, dir: ORDERS.output_directory };
  const c = proof.cases[key];
  return c ? { name: c.input.name, text: c.input.text, dir: c.output_directory } : null;
}

async function sha256(bytes) {
  if (!globalThis.crypto || !crypto.subtle) return "unavailable";
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const plural = (n, one, many) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

const state = {
  name: "orders.csv",
  bytes: null,          // exact bytes of an opened file, until the text is edited
  sampleKey: "orders",
  rulesText: proof.rules.text,
  result: null,
  failure: null,
  tab: "clean",
  hot: null,
  animate: true,
};

const csv = $("csv"), mirror = $("mirror"), gutter = $("gutter");

// ---------- input editor ----------
function lineCount(text) { return text === "" ? 1 : text.split("\n").length; }
function paintEditor() {
  const text = csv.value;
  const lines = text.split("\n");
  const gut = document.createDocumentFragment();
  const mir = document.createDocumentFragment();
  const hot = state.hot;
  const status = new Map();
  if (state.result) for (const r of state.result.records) for (let l = r.line; l <= r.endLine; l++) status.set(l, r.issues.length ? "on" : "ok");
  lines.forEach((ln, i) => {
    const n = i + 1;
    gut.append(el("span", status.get(n) === "on" ? "on" : "", String(n)));
    mir.append(el("i", hot && n >= hot[0] && n <= hot[1] ? "hot" : "", ln));
  });
  gutter.replaceChildren(gut);
  mirror.replaceChildren(mir);
  syncScroll();
}
function syncScroll() { mirror.scrollTop = csv.scrollTop; mirror.scrollLeft = csv.scrollLeft; gutter.scrollTop = csv.scrollTop; }
csv.addEventListener("scroll", syncScroll);

function setHot(range) {
  state.hot = range;
  for (const i of mirror.children) i.classList.remove("hot");
  if (range) for (let n = range[0]; n <= range[1]; n++) mirror.children[n - 1]?.classList.add("hot");
  for (const r of document.querySelectorAll(".rec")) r.classList.toggle("hot", !!range && +r.dataset.line === range[0]);
}

function currentBytes() { return state.bytes || enc.encode(csv.value); }

async function updateStats() {
  const b = currentBytes();
  $("in-stats").textContent = `${plural(b.length, "byte", "bytes")}, ${plural(lineCount(csv.value), "line", "lines")}`;
  const h = await sha256(b);
  $("in-hash").textContent = h === "unavailable" ? "SHA-256 not available here" : "SHA-256 " + h.slice(0, 16) + "…";
  $("in-hash").title = h;
}

// ---------- run ----------
let runId = 0;
async function run() {
  const id = ++runId;
  const bytes = currentBytes();
  let result = null, failure = null;
  try { result = await runExport({ fileName: state.name, bytes, rulesText: state.rulesText, sha256 }); }
  catch (e) { if (e instanceof Failure) failure = e; else { failure = new Failure("file", "unexpected_error", String(e && e.message || e)); } }
  if (id !== runId) return;
  state.result = result; state.failure = failure;
  renderResult();
  if (!$("bench-box").classList.contains("is-big")) paintEditor();
  updateStats();
}
let timer;
const runSoon = () => { clearTimeout(timer); timer = setTimeout(run, 140); };

const VERDICT = {
  0: ["Every row passed", "All rows are in clean.csv. row-errors.csv has only its header line."],
  1: ["Some rows were set aside", ""],
  2: ["Stopped before reading any row", "The file cannot be checked as it is, so no result folder is made."],
};
const CODE_BG = { 0: "var(--pass)", 1: "var(--reject)", 2: "var(--fail)" };

function stem(name) { return name.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "input"; }
function outputDir() {
  const s = sample(state.sampleKey);
  if (s && s.dir && !state.edited) return s.dir;
  return "runs/" + stem(state.name);
}

function renderResult() {
  const r = state.result, f = state.failure;
  const code = f ? 2 : r.exitCode;
  const num = $("code-num");
  num.textContent = String(code);
  num.style.background = CODE_BG[code];
  $("verdict-title").textContent = VERDICT[code][0];
  $("out-dir").textContent = f ? "no result folder" : outputDir();
  const err = $("verdict-err");
  if (f) {
    $("verdict-text").textContent = VERDICT[2][1];
    err.hidden = false; err.textContent = stderrLine(f);
  } else {
    err.hidden = true;
    const n = r.summary.records;
    $("verdict-text").textContent = code === 0
      ? (n.data_rows ? VERDICT[0][1] : "The file has a header and no rows. The three result files are still written.")
      : `${plural(n.accepted_rows, "row goes", "rows go")} to clean.csv. ${plural(n.rejected_rows, "row is", "rows are")} set aside with ${plural(n.row_error_entries, "reason", "reasons")}.`;
  }
  const tally = $("tally");
  tally.replaceChildren();
  const t = (label, value, cls) => { const d = el("div", cls); d.append(el("b", "", value), el("span", "", label)); tally.append(d); };
  if (f) { t("rows read", "0"); t("kept", "0", "g"); t("set aside", "0", "r"); t("files written", "0"); }
  else {
    const n = r.summary.records;
    t("rows", n.data_rows.toLocaleString("en-US")); t("kept", n.accepted_rows.toLocaleString("en-US"), "g");
    t("set aside", n.rejected_rows.toLocaleString("en-US"), n.rejected_rows ? "r" : ""); t("problems", n.row_error_entries.toLocaleString("en-US"), n.row_error_entries ? "r" : "");
  }
  renderLedger();
  renderOut();
  renderSplit();
  for (const g of document.querySelectorAll("[data-gate]")) g.setAttribute("aria-current", String(!state.edited && g.dataset.gate === state.sampleKey));
}

// ---------- split sheet: one row per record, failed rows pulled out to the right ----------
const SPLIT_MAX = 14;
function shortReason(is) {
  const col = is.column === "_row" ? "row" : is.column;
  const v = is.raw;
  switch (is.code) {
    case "required_value_missing": case "unique_key_missing": return `${col} is blank`;
    case "duplicate_unique_key": return `${v} is listed twice`;
    case "enum_value_invalid": return `"${v}" is not an allowed ${col}`;
    case "iso_date_invalid": return `${v} is not a real date`;
    case "decimal_scale": return `${v} has too many decimals`;
    case "decimal_out_of_range": return `${v} is outside the allowed range`;
    case "invalid_decimal": return `${v} is not a number`;
    case "row_width": { const m = /Expected (\d+) cells, found (\d+)/.exec(is.message); return m ? `${m[2]} cells instead of ${m[1]}` : "wrong number of cells"; }
    default: return is.message;
  }
}
// how many columns fit, and whether the record number shows
function splitLayout() {
  const w = $("split-sheet").clientWidth;
  return w >= 980 ? { n: 6, sn: true, cap: 18 } : w >= 560 ? { n: 5, sn: true, cap: 18 } : { n: 4, sn: false, cap: 14 };
}
// columns with a problem come first in the choice, then the first columns, shown in file order
function chooseCols(header, hotIdx, n) {
  const pick = new Set();
  for (const i of hotIdx) if (pick.size < n) pick.add(i);
  if (pick.size < n) pick.add(0);
  for (let i = 0; i < header.length && pick.size < n; i++) pick.add(i);
  return [...pick].sort((a, b) => a - b);
}
let splitTimers = [];
let splitShape = "";
function renderSplit() {
  const sheet = $("split-sheet");
  const r = state.result, f = state.failure;
  splitTimers.forEach(clearTimeout); splitTimers = [];
  const animate = state.animate && !reduced.matches;
  state.animate = false;
  sheet.classList.toggle("stopped", !!f);
  $("split-cmd-file").textContent = /\s/.test(state.name) ? `"${state.name}"` : state.name;
  $("split-cmd-out").textContent = outputDir();
  const exit = $("split-exit");
  const code = f ? 2 : r.exitCode;
  exit.textContent = "exit " + code;
  exit.dataset.code = String(code);

  const header = r ? r.header : (csv.value.split(/\r\n|\n|\r/)[0] || "").split(",");
  const recs = r ? r.records.slice(0, SPLIT_MAX) : [];
  const L = splitLayout();
  const hot = new Set();
  if (f) header.forEach((h, i) => { if (h && header.indexOf(h) !== i) { hot.add(header.indexOf(h)); hot.add(i); } });
  for (const rec of recs) for (const is of rec.issues) { const i = header.indexOf(is.column); if (i >= 0) hot.add(i); }
  const cols = header.length ? chooseCols(header, [...hot].sort((a, b) => a - b), L.n) : [];
  splitShape = `${L.n}|${L.sn}`;
  // column widths follow the longest value shown in each column
  const weights = cols.map((i) => {
    let m = (header[i] || "").length;
    for (const rec of recs) m = Math.max(m, (rec.cells[i] || "").length);
    return Math.min(L.cap, Math.max(4, m));
  });
  // short columns keep their full width, long ones share what is left
  sheet.style.setProperty("--tpl", (L.sn ? "1.6em " : "") + (weights.length ? weights.map((w) => `minmax(${Math.min(w, 10)}ch, ${w}fr)`).join(" ") : "minmax(0, 1fr)"));

  const head = $("split-head");
  head.replaceChildren();
  if (L.sn) head.append(el("span", "sn", ""));
  cols.forEach((i) => head.append(el("span", "sc" + (f && hot.has(i) ? " bad" : ""), header[i] || "(blank)")));
  $("split-head2").replaceChildren(...[...head.childNodes].map((n) => n.cloneNode(true)));

  const kept = r ? r.records.filter((x) => !x.issues.length).length : 0;
  const out = r ? r.records.length - kept : 0;
  $("split-kept").textContent = r ? `clean.csv, ${plural(kept, "row", "rows")}` : "clean.csv, not written";
  $("split-out").textContent = r ? `row-errors.csv, ${plural(out, "row", "rows")}` : "row-errors.csv, not written";

  const note = $("split-note");
  note.hidden = true;
  if (f) {
    note.hidden = false;
    note.textContent = f.code === "duplicate_headers"
      ? "Stopped at the header. Two columns have the same name, so no row is checked and nothing is written."
      : `Stopped. ${f.message} Nothing is written.`;
  } else if (!r.records.length) {
    note.hidden = false;
    note.textContent = "The file has a header and no rows.";
  }

  const list = $("split-rows");
  list.replaceChildren();
  const rows = [];
  for (const rec of recs) {
    const bad = new Set(rec.issues.map((x) => x.column));
    const wide = bad.has("_row");
    const row = el("div", "srow " + (rec.issues.length ? "fail" : "pass"));
    row.setAttribute("role", "listitem");
    if (L.sn) row.append(el("span", "sn", String(rec.record)));
    cols.forEach((i, k) => {
      const v = rec.cells[i];
      const isBad = bad.has(header[i]) || (wide && k === 0);
      const shown = v === undefined ? "" : v === "" ? (isBad ? "blank" : "") : v.replace(/\r\n|\n|\r/g, " ");
      const c = el("span", "sc" + (isBad ? " bad" : "") + (v === "" && isBad ? " empty" : ""), shown);
      if (v && v.length > 12) c.title = v;
      row.append(c);
    });
    if (rec.issues.length) {
      const text = shortReason(rec.issues[0]) + (rec.issues.length > 1 ? `, and ${rec.issues.length - 1} more` : "");
      const why = el("span", "why"); why.append(el("span", "", text));
      row.append(why);
      row.setAttribute("aria-label", `Row ${rec.record}, set aside, ${text}`);
    } else row.setAttribute("aria-label", `Row ${rec.record}, kept`);
    list.append(row);
    rows.push(row);
  }
  if (r && r.records.length > SPLIT_MAX) {
    const more = el("p", "smore", `and ${(r.records.length - SPLIT_MAX).toLocaleString("en-US")} more rows, all in the result files`);
    more.setAttribute("role", "listitem");
    list.append(more);
  }

  $("split-tally").textContent = f ? "Exit code 2. Nothing written."
    : !r.records.length ? "Exit code 0. The three result files are written, with no rows in them."
    : `${plural(r.records.length, "row", "rows")} checked. ${kept.toLocaleString("en-US")} kept, ${out.toLocaleString("en-US")} set aside.`;

  placeSplit();
  // the check goes down the file once: kept rows get a tick, failed rows move out
  if (animate && rows.length) {
    sheet.classList.add("pending");
    rows.forEach((row, i) => splitTimers.push(setTimeout(() => row.classList.add("done"), 300 + i * 110)));
    splitTimers.push(setTimeout(() => sheet.classList.remove("pending"), 300 + rows.length * 110 + 600));
  } else {
    sheet.classList.remove("pending");
    rows.forEach((row) => row.classList.add("done"));
  }
}
// on a wide sheet, failed rows move across to the right half
function placeSplit() {
  const sheet = $("split-sheet");
  if (matchMedia("(min-width: 1020px)").matches) {
    const row = $("split-head");
    sheet.style.setProperty("--shift", Math.max(24, sheet.clientWidth - row.offsetWidth) + "px");
  } else sheet.style.removeProperty("--shift");
}
new ResizeObserver(() => {
  const L = splitLayout();
  if (`${L.n}|${L.sn}` !== splitShape && (state.result || state.failure)) renderSplit();
  else placeSplit();
}).observe($("split-sheet"));
$("split-again").addEventListener("click", () => { state.animate = true; renderSplit(); });

// ---------- exit-code buttons run their sample ----------
for (const g of document.querySelectorAll("[data-gate]")) {
  g.addEventListener("click", () => {
    const smooth = reduced.matches ? "auto" : "smooth";
    if (g.dataset.gate === "refusal") { $("refusal").scrollIntoView({ behavior: smooth, block: "start" }); return; }
    document.querySelector(`[data-file="${g.dataset.gate}"]`).click();
    $("split").scrollIntoView({ behavior: smooth, block: "start" });
  });
}

function cellsLine(cells, badCols, header) {
  const wrap = el("div", "cells");
  if (!cells.length) { wrap.textContent = "(blank line, no cells)"; return wrap; }
  cells.forEach((c, i) => {
    if (i) { const s = el("span", "sep"); s.append(el("span", "sr", ", ")); wrap.append(s); }
    const shown = c === "" ? "∅" : c.replace(/\r?\n|\r/g, "↵");
    if (badCols.has(header[i])) { const m = el("mark", "", shown); m.title = header[i]; wrap.append(m); }
    else wrap.append(document.createTextNode(shown));
  });
  return wrap;
}

function renderLedger() {
  const box = $("ledger");
  box.replaceChildren();
  const r = state.result, f = state.failure;
  if (f) {
    const p = el("p", "ledger-empty");
    p.textContent = f.code === "duplicate_headers" || f.code.includes("header")
      ? "The header line is the problem, so no row was read. Fix the header and the rows show up here."
      : "Nothing was written. The message above is exactly what the command line prints.";
    box.append(p); return;
  }
  const head = el("div", "ledger-head");
  head.append(el("span", "", "Row"), el("span", "", "Cells, and where the row went"));
  box.append(head);
  if (!r.records.length) { box.append(el("p", "ledger-empty", "No rows yet. Add a line under the header.")); return; }
  const width = r.header.length;
  for (const rec of r.records.slice(0, SHOW_RECORDS)) {
    const row = el("div", "rec " + (rec.issues.length ? "rej" : "pass"));
    row.tabIndex = 0;
    row.dataset.line = rec.line;
    row.dataset.end = rec.endLine;
    const no = el("div", "no", String(rec.record));
    no.append(el("small", "", rec.endLine > rec.line ? `lines ${rec.line}-${rec.endLine}` : `line ${rec.line}`));
    const body = el("div");
    const bad = new Set(rec.issues.map((i) => i.column));
    body.append(cellsLine(rec.cells, bad, r.header));
    if (rec.issues.length) {
      const ul = el("ul", "issues");
      for (const is of rec.issues) {
        const li = el("li");
        li.append(el("code", "", `${is.column === "_row" ? "row" : is.column}, ${is.code}`), el("span", "", is.message));
        ul.append(li);
      }
      body.append(ul);
    } else {
      body.append(el("span", "dest", "kept in clean.csv"));
    }
    row.setAttribute("aria-label", `Row ${rec.record}, ${rec.issues.length ? "set aside, " + plural(rec.issues.length, "problem", "problems") : "kept"}`);
    row.append(no, body);
    box.append(row);
    if (rec.cells.length !== width) row.dataset.width = "off";
  }
  if (r.records.length > SHOW_RECORDS) box.append(el("p", "more-rows", `Showing the first ${SHOW_RECORDS} of ${r.records.length.toLocaleString("en-US")} rows. The result files below have all of them.`));
}

function recRange(row) { return [+row.dataset.line, +row.dataset.end]; }
$("ledger").addEventListener("pointerover", (e) => { const row = e.target.closest(".rec"); if (row) setHot(recRange(row)); });
$("ledger").addEventListener("pointerleave", () => setHot(null));
$("ledger").addEventListener("focusin", (e) => { const row = e.target.closest(".rec"); if (row) setHot(recRange(row)); });
$("ledger").addEventListener("click", (e) => { const row = e.target.closest(".rec"); if (row) jumpTo(recRange(row)); });
$("ledger").addEventListener("keydown", (e) => {
  const row = e.target.closest(".rec"); if (!row) return;
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); jumpTo(recRange(row)); }
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const next = e.key === "ArrowDown" ? row.nextElementSibling : row.previousElementSibling; if (next && next.classList.contains("rec")) next.focus(); }
});

function jumpTo([a, b]) {
  if ($("bench-box").classList.contains("is-big")) return;
  const lines = csv.value.split("\n");
  let start = 0; for (let i = 0; i < a - 1; i++) start += lines[i].length + 1;
  let end = start; for (let i = a - 1; i < b; i++) end += (lines[i] || "").length + (i < b - 1 ? 1 : 0);
  csv.focus({ preventScroll: true });
  csv.setSelectionRange(start, end);
  const lh = parseFloat(getComputedStyle(csv).lineHeight) || 22;
  csv.scrollTop = Math.max(0, (a - 3) * lh);
  if (window.matchMedia("(max-width: 1019px)").matches) $("in-pane").scrollIntoView({ block: "start", behavior: reduced.matches ? "auto" : "smooth" });
  syncScroll();
  setHot([a, b]);
}

// the caret in the input lights the record it belongs to
function caretLine() { return csv.value.slice(0, csv.selectionStart).split("\n").length; }
function followCaret() {
  if (!state.result) return;
  const ln = caretLine();
  const rec = state.result.records.find((r) => ln >= r.line && ln <= r.endLine);
  setHot(rec ? [rec.line, rec.endLine] : null);
  if (rec) { const row = document.querySelector(`.rec[data-line="${rec.line}"]`); if (row) { const lb = $("ledger"); const top = row.offsetTop - lb.offsetTop; if (top < lb.scrollTop || top > lb.scrollTop + lb.clientHeight - 40) lb.scrollTop = top - 40; } }
}
csv.addEventListener("keyup", (e) => { if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End" || e.key === "PageUp" || e.key === "PageDown") followCaret(); });
csv.addEventListener("click", followCaret);
csv.addEventListener("input", () => { state.bytes = null; state.edited = true; $("in-name").textContent = state.name + " (edited)"; runSoon(); });

// ---------- result files ----------
const TABS = { clean: ["ot-clean", "clean.csv"], errors: ["ot-errors", "row-errors.csv"], summary: ["ot-summary", "summary.json"] };
function renderOut() {
  const pre = $("out-file");
  const r = state.result;
  for (const [k, [id]] of Object.entries(TABS)) { const b = $(id); const on = k === state.tab; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; }
  pre.setAttribute("aria-labelledby", TABS[state.tab][0]);
  if (!r) { pre.textContent = "No result folder, so there are no result files."; $("download").disabled = true; return; }
  pre.textContent = state.tab === "clean" ? r.clean : state.tab === "errors" ? r.errors : r.summaryText;
  $("download").disabled = false;
}
for (const [k, [id]] of Object.entries(TABS)) {
  const b = $(id);
  b.addEventListener("click", () => { state.tab = k; renderOut(); });
  b.addEventListener("keydown", (e) => {
    const keys = Object.keys(TABS); let i = keys.indexOf(k);
    if (e.key === "ArrowRight") i = (i + 1) % 3; else if (e.key === "ArrowLeft") i = (i + 2) % 3; else if (e.key === "Home") i = 0; else if (e.key === "End") i = 2; else return;
    e.preventDefault(); state.tab = keys[i]; renderOut(); $(TABS[keys[i]][0]).focus();
  });
}
$("download").addEventListener("click", () => {
  const r = state.result; if (!r) return;
  const text = state.tab === "clean" ? r.clean : state.tab === "errors" ? r.errors : r.summaryText;
  const blob = new Blob([text], { type: state.tab === "summary" ? "application/json" : "text/csv" });
  const a = el("a"); a.href = URL.createObjectURL(blob); a.download = TABS[state.tab][1];
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  const lab = $("download").querySelector("span"); lab.textContent = "Saved " + TABS[state.tab][1];
  setTimeout(() => { lab.textContent = "Download"; }, 1800);
});

// ---------- file choice ----------
function setPressed(key) { for (const b of document.querySelectorAll("[data-file]")) b.setAttribute("aria-pressed", String(b.dataset.file === key)); }
function loadText(name, text, key) {
  state.name = name; state.bytes = null; state.sampleKey = key; state.edited = false; state.hot = null; state.animate = true;
  $("bench-box").classList.remove("is-big");
  csv.value = text; csv.scrollTop = 0; csv.scrollLeft = 0;
  $("in-name").textContent = name;
  run();
}
for (const b of document.querySelectorAll("[data-file]")) {
  b.addEventListener("click", () => {
    setPressed(b.dataset.file);
    if (b.dataset.file === "blank") return loadText("empty.csv", "", "blank");
    const s = sample(b.dataset.file);
    loadText(s.name, s.text, b.dataset.file);
  });
}
$("open-file").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const bytes = new Uint8Array(await file.arrayBuffer());
  setPressed(null);
  state.name = file.name; state.sampleKey = null; state.edited = false; state.hot = null; state.animate = true;
  $("in-name").textContent = file.name;
  if (bytes.length > BIG) {
    state.bytes = bytes;
    $("bench-box").classList.add("is-big");
    $("bigfile").textContent = `${file.name} is ${plural(bytes.length, "byte", "bytes")}, too large to edit here. It is checked as it is, and the result files have every row.`;
    csv.value = "";
  } else {
    $("bench-box").classList.remove("is-big");
    let text = null;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { text = null; }
    // keep the exact bytes, so CRLF, a BOM and the hash stay true until the text is edited
    state.bytes = bytes;
    csv.value = text === null ? new TextDecoder("utf-8").decode(bytes) : text.replace(/^﻿/, "");
  }
  e.target.value = "";
  await run();
  if (!document.getElementById("split").contains(document.activeElement)) $("split").scrollIntoView({ block: "start", behavior: reduced.matches ? "auto" : "smooth" });
});

// ---------- rules ----------
function describeRules(rt) {
  const list = $("rule-list");
  list.replaceChildren();
  let rules;
  try { rules = loadRules(rt); } catch { const d = el("div"); d.append(el("dt", "", "rules.json"), el("dd", "", "The rules do not load. The result shows the exact error.")); list.append(d); return false; }
  const row = (k, v) => { const d = el("div"); d.append(el("dt", "", k), el("dd", "", v)); list.append(d); };
  row("headers", rules.headers.join(", ") + ". All must be there, spelled exactly.");
  if (rules.uniqueKey) row("unique", `${rules.uniqueKey} must not repeat.`);
  if (rules.requiredValues.length) row("required", rules.requiredValues.join(", ") + " cannot be blank.");
  for (const [c, s] of Object.entries(rules.enums)) row(c, "one of " + [...s].join(", ") + ".");
  for (const c of rules.isoDates) row(c, "a real date, written YYYY-MM-DD.");
  for (const [c, d] of Object.entries(rules.decimals)) row(c, `a number from ${d.min} to ${d.max}, at most ${d.scale} decimals.`);
  row("limits", `${rules.maxRows.toLocaleString("en-US")} rows, ${rules.maxBytes.toLocaleString("en-US")} bytes in, ${rules.maxOutputBytes.toLocaleString("en-US")} bytes out.`);
  return true;
}
const rulesText = $("rules-text");
rulesText.value = proof.rules.text;
async function rulesChanged() {
  state.rulesText = rulesText.value;
  const ok = describeRules(state.rulesText);
  const same = state.rulesText === proof.rules.text;
  $("rules-state").textContent = same ? "sample rules" : ok ? "changed" : "changed, not valid";
  $("rules-reset").disabled = same;
  const h = await sha256(enc.encode(state.rulesText));
  $("rules-hash").textContent = h === "unavailable" ? "" : "SHA-256 " + h.slice(0, 16) + "…";
  runSoon();
}
rulesText.addEventListener("input", rulesChanged);
$("rules-reset").addEventListener("click", () => { rulesText.value = proof.rules.text; rulesChanged(); });

// ---------- recorded runs compared with this page ----------
async function parity() {
  const body = $("parity-table").tBodies[0];
  body.replaceChildren();
  let allSame = true;
  for (const [, c] of Object.entries(proof.cases)) {
    const tr = el("tr");
    const th = el("th"); th.scope = "row"; th.append(el("code", "", c.input.name)); tr.append(th);
    let res = null, fail = null;
    try { res = await runExport({ fileName: c.input.name, bytes: enc.encode(c.input.text), rulesText: proof.rules.text, sha256 }); }
    catch (e) { fail = e; }
    const exit = fail ? 2 : res.exitCode;
    const exitSame = exit === c.exit_code && (!fail || stderrLine(fail) === c.file_failure.exact_stderr);
    const tdE = el("td"); tdE.dataset.label = "Exit code";
    tdE.append(el("span", "st " + (exitSame ? "same" : "diff"), `${exit}, ${exitSame ? "same" : "different"}`));
    tr.append(tdE);
    for (const [label, mine, theirs] of [["clean.csv", res && res.clean, c.outputs && c.outputs.clean_csv], ["row-errors.csv", res && res.errors, c.outputs && c.outputs.row_errors_csv], ["summary.json", res && res.summaryText, c.outputs && c.outputs.summary_json]]) {
      const td = el("td"); td.dataset.label = label;
      if (!theirs && !mine) { td.append(el("span", "st same", "not written in both")); }
      else {
        const same = mine === theirs;
        allSame = allSame && same;
        const h = await sha256(enc.encode(theirs || ""));
        td.append(el("span", "st " + (same ? "same" : "diff"), same ? `same, ${plural(enc.encode(theirs).length, "byte", "bytes")}` : "different"), el("br"), el("code", "", h.slice(0, 24) + "…"));
      }
      tr.append(td);
    }
    allSame = allSame && exitSame;
    body.append(tr);
  }
  $("parity-table").dataset.allSame = String(allSame);
  const v = $("parity-verdict");
  v.dataset.ok = String(allSame);
  v.querySelector("b").textContent = allSame ? "Same" : "Different";
  v.querySelector("span").textContent = allSame ? "Same exit codes and the same files for all three." : "At least one file is different from the saved Python output.";
}

// ---------- second run into the same folder ----------
function refusal() {
  const r = proof.existing_output_refusal;
  $("refusal-exit").textContent = "exit " + r.exit_code;
  const pre = $("refusal-msg");
  pre.replaceChildren(el("span", "p", "second run, same --output runs/clean\n"), el("span", "e", r.exact_stderr));
  const tb = $("hashes").tBodies[0];
  for (const f of r.files) {
    const tr = el("tr");
    const a = el("td"); a.append(el("code", "", f.path));
    const b = el("td", "num", String(f.bytes));
    const c = el("td"); c.append(el("code", "", f.sha256));
    tr.append(a, b, c); tb.append(tr);
  }
}

refusal();
describeRules(state.rulesText);
$("rules-reset").disabled = true;
setPressed("orders");
loadText(ORDERS.name, ORDERS.text, "orders");
parity();
