import { runExport, loadRules, Failure, stderrLine } from "./exportcheck-bench.mjs";

const proof = JSON.parse(document.getElementById("proof-data").textContent);
const $ = (id) => document.getElementById(id);
const enc = new TextEncoder();
const BIG = 400000;
const SHOW_RECORDS = 300;

async function sha256(bytes) {
  if (!globalThis.crypto || !crypto.subtle) return "unavailable";
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
const plural = (n, one, many) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

const state = {
  name: "clean.csv",
  bytes: null,          // exact bytes of an opened file, until the text is edited
  sampleKey: "clean",
  rulesText: proof.rules.text,
  result: null,
  failure: null,
  tab: "clean",
  hot: null,
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
    const g = el("span", status.get(n) === "on" ? "on" : "", String(n));
    gut.append(g);
    const m = el("i", hot && n >= hot[0] && n <= hot[1] ? "hot" : "", ln);
    mir.append(m);
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
  $("in-hash").textContent = h === "unavailable" ? "SHA-256 unavailable here" : "SHA-256 " + h.slice(0, 16) + "…";
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
  if (!document.getElementById("bench-box").classList.contains("is-big")) paintEditor();
  updateStats();
}
let timer;
const runSoon = () => { clearTimeout(timer); timer = setTimeout(run, 140); };

const VERDICT = {
  0: ["Every row passed", "clean.csv holds every row. row-errors.csv holds only its header."],
  1: ["Some rows were rejected", "The good rows still go through. The rest are listed with every reason."],
  2: ["Stopped before any row", "The file can't be checked as it stands, so no result folder is created."],
};
const CODE_BG = { 0: "var(--pass)", 1: "var(--reject)", 2: "var(--fail)" };

function stem(name) { return name.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "input"; }
function outputDir() {
  const c = proof.cases[state.sampleKey];
  if (c && c.output_directory && !state.edited) return c.output_directory;
  return "runs/" + stem(state.name);
}

function renderResult() {
  const r = state.result, f = state.failure;
  const code = f ? 2 : r.exitCode;
  const num = $("code-num");
  num.textContent = String(code);
  num.style.background = CODE_BG[code];
  $("verdict-title").textContent = VERDICT[code][0];
  $("out-dir").textContent = f ? "no output folder" : outputDir();
  const err = $("verdict-err");
  if (f) {
    $("verdict-text").textContent = VERDICT[2][1];
    err.hidden = false; err.textContent = stderrLine(f);
  } else {
    err.hidden = true;
    const n = r.summary.records;
    $("verdict-text").textContent = code === 0
      ? (n.data_rows ? VERDICT[0][1] : "The file has a header and no data rows. Every result file is still written.")
      : `${plural(n.accepted_rows, "row goes", "rows go")} to clean.csv. ${plural(n.rejected_rows, "row is", "rows are")} held back with ${plural(n.row_error_entries, "reason", "reasons")}.`;
  }
  // tally
  const tally = $("tally");
  tally.replaceChildren();
  const t = (label, value, cls) => { const d = el("div", cls); d.append(el("b", "", value), el("span", "", label)); tally.append(d); };
  if (f) { t("data rows read", "0"); t("accepted", "0", "g"); t("rejected", "0", "r"); t("files written", "0"); }
  else {
    const n = r.summary.records;
    t("data rows", n.data_rows.toLocaleString("en-US")); t("accepted", n.accepted_rows.toLocaleString("en-US"), "g");
    t("rejected", n.rejected_rows.toLocaleString("en-US"), n.rejected_rows ? "r" : ""); t("issues", n.row_error_entries.toLocaleString("en-US"), n.row_error_entries ? "r" : "");
  }
  renderLedger();
  renderOut();
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
      ? "The header itself is the problem, so no row was read. Fix the header line and the rows appear here."
      : "Nothing was written. The message above is exactly what the command line prints.";
    box.append(p); return;
  }
  const head = el("div", "ledger-head");
  head.append(el("span", "", "Record"), el("span", "", "Cells, and where the row went"));
  box.append(head);
  if (!r.records.length) { box.append(el("p", "ledger-empty", "No data rows yet. Add a line under the header.")); return; }
  const width = r.header.length;
  for (const rec of r.records.slice(0, SHOW_RECORDS)) {
    const row = el("div", "rec " + (rec.issues.length ? "rej" : "pass"));
    row.tabIndex = 0;
    row.dataset.line = rec.line;
    row.dataset.end = rec.endLine;
    const no = el("div", "no", String(rec.record));
    no.append(el("small", "", rec.endLine > rec.line ? `lines ${rec.line}–${rec.endLine}` : `line ${rec.line}`));
    const body = el("div");
    const bad = new Set(rec.issues.map((i) => i.column));
    body.append(cellsLine(rec.cells, bad, r.header));
    if (rec.issues.length) {
      const ul = el("ul", "issues");
      for (const is of rec.issues) {
        const li = el("li");
        li.append(el("code", "", `${is.column === "_row" ? "row" : is.column} · ${is.code}`), el("span", "", is.message));
        ul.append(li);
      }
      body.append(ul);
      if (rec.cells.length !== width) row.setAttribute("aria-label", `Record ${rec.record}, rejected`);
    } else {
      body.append(el("span", "dest", "→ clean.csv"));
    }
    row.setAttribute("aria-label", `Record ${rec.record}, ${rec.issues.length ? "rejected, " + plural(rec.issues.length, "issue", "issues") : "accepted"}`);
    row.append(no, body);
    box.append(row);
  }
  if (r.records.length > SHOW_RECORDS) box.append(el("p", "more-rows", `Showing the first ${SHOW_RECORDS} of ${r.records.length.toLocaleString("en-US")} records. The result files below hold all of them.`));
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
  const lh = 22;
  csv.scrollTop = Math.max(0, (a - 3) * lh);
  if (window.matchMedia("(max-width: 1019px)").matches) $("in-pane").scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  syncScroll();
  setHot([a, b]);
}

// caret in the input lights the record it belongs to
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

// ---------- output files ----------
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
  state.name = name; state.bytes = null; state.sampleKey = key; state.edited = false; state.hot = null;
  $("bench-box").classList.remove("is-big");
  csv.value = text; csv.scrollTop = 0; csv.scrollLeft = 0;
  $("in-name").textContent = name;
  run();
}
for (const b of document.querySelectorAll("[data-file]")) {
  b.addEventListener("click", () => {
    setPressed(b.dataset.file);
    if (b.dataset.file === "blank") return loadText("empty.csv", "", "blank");
    const c = proof.cases[b.dataset.file];
    loadText(c.input.name, c.input.text, b.dataset.file);
  });
}
$("open-file").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const bytes = new Uint8Array(await file.arrayBuffer());
  setPressed(null);
  state.name = file.name; state.sampleKey = null; state.edited = false; state.hot = null;
  $("in-name").textContent = file.name;
  if (bytes.length > BIG) {
    state.bytes = bytes;
    $("bench-box").classList.add("is-big");
    $("bigfile").textContent = `${file.name} is ${plural(bytes.length, "byte", "bytes")}, too large to edit here comfortably. It is checked as it is, and the result files hold every row.`;
    csv.value = "";
  } else {
    $("bench-box").classList.remove("is-big");
    let text = null;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { text = null; }
    if (text === null) {
      state.bytes = bytes; csv.value = new TextDecoder("utf-8").decode(bytes);
    } else {
      // keep the exact bytes, so CRLF, a BOM and the hash stay true until the text is edited
      state.bytes = bytes; csv.value = text.replace(/^﻿/, "");
    }
  }
  e.target.value = "";
  run();
});

// ---------- rules ----------
function describeRules(rt) {
  const list = $("rule-list");
  list.replaceChildren();
  let rules;
  try { rules = loadRules(rt); } catch { list.append(el("div", "", "")); list.lastChild.append(el("dt", "", "rules.json"), el("dd", "", "The rules don't load. The verdict shows the exact error.")); return false; }
  const row = (k, v) => { const d = el("div"); d.append(el("dt", "", k), el("dd", "", v)); list.append(d); };
  row("headers", rules.headers.join(", ") + ". All must be present, matched exactly.");
  if (rules.uniqueKey) row("unique key", `${rules.uniqueKey} must be unique across data rows.`);
  if (rules.requiredValues.length) row("required", rules.requiredValues.join(", ") + " can't be blank.");
  for (const [c, s] of Object.entries(rules.enums)) row(c, "one of " + [...s].join(", ") + ".");
  for (const c of rules.isoDates) row(c, "a real calendar date, YYYY-MM-DD.");
  for (const [c, d] of Object.entries(rules.decimals)) row(c, `a plain decimal from ${d.min} to ${d.max}, at most ${d.scale} decimal places.`);
  row("limits", `${rules.maxRows.toLocaleString("en-US")} rows, ${rules.maxBytes.toLocaleString("en-US")} input bytes, ${rules.maxOutputBytes.toLocaleString("en-US")} output bytes.`);
  return true;
}
const rulesText = $("rules-text");
rulesText.value = proof.rules.text;
async function rulesChanged() {
  state.rulesText = rulesText.value;
  const ok = describeRules(state.rulesText);
  const same = state.rulesText === proof.rules.text;
  $("rules-state").textContent = same ? "sample rules, unchanged" : ok ? "edited" : "edited, invalid";
  $("rules-reset").disabled = same;
  const h = await sha256(enc.encode(state.rulesText));
  $("rules-hash").textContent = h === "unavailable" ? "" : "SHA-256 " + h.slice(0, 16) + "…";
  runSoon();
}
rulesText.addEventListener("input", rulesChanged);
$("rules-reset").addEventListener("click", () => { rulesText.value = proof.rules.text; rulesChanged(); });

// ---------- recorded parity ----------
async function parity() {
  const body = $("parity-table").tBodies[0];
  body.replaceChildren();
  let allSame = true;
  for (const [key, c] of Object.entries(proof.cases)) {
    const tr = el("tr");
    const th = el("th"); th.scope = "row"; th.append(el("code", "", c.input.name)); tr.append(th);
    let res = null, fail = null;
    try { res = await runExport({ fileName: c.input.name, bytes: enc.encode(c.input.text), rulesText: proof.rules.text, sha256 }); }
    catch (e) { fail = e; }
    const exit = fail ? 2 : res.exitCode;
    const exitSame = exit === c.exit_code && (!fail || stderrLine(fail) === c.file_failure.exact_stderr);
    const tdE = el("td"); tdE.dataset.label = "Exit";
    tdE.append(el("span", "st " + (exitSame ? "same" : "diff"), `${exit} ${exitSame ? "same" : "differs"}`));
    tr.append(tdE);
    for (const [label, mine, theirs] of [["clean.csv", res && res.clean, c.outputs && c.outputs.clean_csv], ["row-errors.csv", res && res.errors, c.outputs && c.outputs.row_errors_csv], ["summary.json", res && res.summaryText, c.outputs && c.outputs.summary_json]]) {
      const td = el("td"); td.dataset.label = label;
      if (!theirs && !mine) { td.append(el("span", "st same", "not written, same")); }
      else {
        const same = mine === theirs;
        allSame = allSame && same;
        const h = await sha256(enc.encode(theirs || ""));
        td.append(el("span", "st " + (same ? "same" : "diff"), same ? `identical, ${plural(enc.encode(theirs).length, "byte", "bytes")}` : "differs"), el("br"), el("code", "", h.slice(0, 24) + "…"));
      }
      tr.append(td);
    }
    allSame = allSame && exitSame;
    body.append(tr);
  }
  $("parity-table").dataset.allSame = String(allSame);
}

// ---------- refusal ----------
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
loadText(proof.cases.clean.input.name, proof.cases.clean.input.text, "clean");
parity();
