// Work instruction preview. The editor is the opening: a Word page on the left and, in the margin beside each
// paragraph, the JSON object that paragraph becomes. Same parser rules as sop_to_work_instruction.py (sop-bench.mjs).
import { run, buildDocx, classify, INSERTS } from "./sop-bench.mjs";

const $ = id => document.getElementById(id);
const DOC_NAME = "work_instruction.docx";
const FIXTURE_B64 = $("fixture-docx").textContent.trim();
let uid = 0;
const P = (text, flags = []) => ({ id: ++uid, type: "p", text, flags: [...flags] });
const TABLE = () => ({ id: ++uid, type: "table" });

const PRESETS = {
  sample: () => [P("Work Instruction: Review a sample café record"), P("Safety Notes: Synthetic example only.\nNo equipment is involved."), P("Step 1: Open the sample record.\nCheck that the café record ID is present."), P("Step 2: Mark the sample record Complete.")],
  ribbon: () => [P("Work Instruction: Replace the ribbon on a desk label printer"), P(""), P("Safety Notes: Switch the printer off first.\nThe print head can be hot after a long run."), P("Step 1: Open the top cover and lift the print head lever."), P("Step 2: Take out the empty ribbon core and the take-up roll."), P("Step 3: Fit the new ribbon, shiny side away from the labels.\nThread it under the print head."), P("Step 4: Close the lever and the cover."), P("Step 5: Print one test label and check that the text is sharp.")],
  gap: () => [P("Work Instruction: Replace the ribbon"), P("Step 1: Open the cover."), P("Step 3: Close the cover.")],
  loose: () => [P("Work Instruction: Replace the ribbon"), P("Step 1: Open the cover."), P("Remember to wash your hands."), P("Step 2: Close the cover.")],
  late: () => [P("Work Instruction: Replace the ribbon"), P("Step 1: Open the cover."), P("Safety Notes: Switch the printer off first."), P("Step 2: Close the cover.")],
  formula: () => [P("Work Instruction: Count the spare ribbons"), P("Step 1: =SUM(B2:B9) is the total on the sheet."), P("Step 2: -2 from the total for the ones in use."), P("Step 3: @Stores gets the count.")],
  list: () => [P("Work Instruction: Replace the ribbon"), P("Step 1: Open the cover.", ["list"]), P("Step 2: Close the cover.")],
  table: () => [P("Work Instruction: Replace the ribbon"), TABLE(), P("Step 1: Open the cover.")],
  dup: () => [P("Work Instruction: Replace the ribbon"), P("Step 1: Open the cover."), P("Step 1: Lift the lever.")],
  notitle: () => [P("Replace the ribbon"), P("Step 1: Open the cover.")],
  emptystep: () => [P("Work Instruction: Replace the ribbon"), P("Step 1: Open the cover."), P("Step 2:")],
  nosteps: () => [P("Work Instruction: Replace the ribbon"), P("Safety Notes: Switch the printer off first.")],
  multititle: () => [P("Work Instruction: Replace the ribbon\nand clean the head"), P("Step 1: Open the cover.")],
  break: () => [P("Work Instruction: Replace the ribbon"), P("Step 1: Open the cover.", ["pagebreak"])],
};

let blocks = PRESETS.sample();
let mode = "edit";            // "edit" or "file"
let file = null;              // { name, bytes }
let current = null;           // id of the last focused paragraph
let last = null;              // last result
const docEl = $("doc");

// ---------- editor ----------
function paraNumbers() { let n = 0; const map = new Map(); for (const b of blocks) if (b.type === "p") map.set(b.id, ++n); return map; }
function render(focusId, caret) {
  if (!blocks.some(b => b.type === "p")) blocks.push(P(""));
  const nums = paraNumbers();
  docEl.replaceChildren(...blocks.map(b => b.type === "table" ? tableRow(b) : paraRow(b, nums.get(b.id))));
  for (const ta of docEl.querySelectorAll("textarea")) fit(ta);
  if (focusId) { const ta = docEl.querySelector(`[data-id="${focusId}"] textarea`); if (ta) { ta.focus(); const c = caret === "end" ? ta.value.length : caret ?? 0; ta.setSelectionRange(c, c); } }
  update();
}
function paraRow(b, n) {
  const row = document.createElement("div");
  row.className = "para"; row.dataset.id = b.id; row.dataset.n = n;
  const no = document.createElement("span"); no.className = "pno"; no.textContent = n; no.setAttribute("aria-hidden", "true");
  const ta = document.createElement("textarea");
  ta.rows = 1; ta.value = b.text; ta.spellcheck = false; ta.setAttribute("aria-label", `Paragraph ${n}`);
  const tag = document.createElement("span"); tag.className = "read";
  const chips = document.createElement("span"); chips.className = "chips";
  for (const f of b.flags) {
    const c = document.createElement("button"); c.type = "button"; c.className = "chip"; c.dataset.flag = f;
    c.setAttribute("aria-label", `Remove ${INSERTS[f].label} from paragraph ${n}`);
    c.innerHTML = `<span></span><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6"/></svg>`;
    c.firstChild.textContent = INSERTS[f].label;
    chips.append(c);
  }
  const body = document.createElement("div"); body.className = "pbody"; body.append(ta, chips);
  row.append(no, body, tag);
  return row;
}
function tableRow(b) {
  const row = document.createElement("div");
  row.className = "para tbl"; row.dataset.id = b.id;
  row.innerHTML = `<span class="pno" aria-hidden="true">tbl</span><div class="pbody"><div class="fake-table" aria-label="A Word table"><span>Cell</span></div></div><button type="button" class="chip rm-table" aria-label="Remove the table"><span>Table</span><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6"/></svg></button>`;
  return row;
}
function fit(ta) { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; }
const blockOf = el => blocks.find(b => b.id === Number(el.closest("[data-id]").dataset.id));
const idx = b => blocks.indexOf(b);

docEl.addEventListener("input", e => {
  if (e.target.tagName !== "TEXTAREA") return;
  blockOf(e.target).text = e.target.value; fit(e.target); schedule();
});
docEl.addEventListener("focusin", e => { if (e.target.tagName === "TEXTAREA") { current = blockOf(e.target).id; toolState(); } });
docEl.addEventListener("click", e => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  const b = blockOf(chip);
  if (b.type === "table") { const i = idx(b); blocks.splice(i, 1); render(blocks[i]?.id || blocks[i - 1]?.id); return; }
  b.flags = b.flags.filter(f => f !== chip.dataset.flag); render(b.id, "end");
});
docEl.addEventListener("keydown", e => {
  const ta = e.target; if (ta.tagName !== "TEXTAREA") return;
  const b = blockOf(ta), i = idx(b), s = ta.selectionStart, en = ta.selectionEnd;
  if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    const before = ta.value.slice(0, s), after = ta.value.slice(en);
    b.text = before;
    const nb = P(after, []);
    blocks.splice(i + 1, 0, nb); render(nb.id, 0);
  } else if (e.key === "Backspace" && s === 0 && en === 0 && i > 0) {
    const prev = blocks[i - 1]; e.preventDefault();
    if (prev.type === "table") { blocks.splice(i - 1, 1); render(b.id, 0); return; }
    const caret = prev.text.length; prev.text += b.text; prev.flags = [...new Set([...prev.flags, ...b.flags])]; blocks.splice(i, 1); render(prev.id, caret);
  } else if (e.key === "Delete" && s === ta.value.length && en === s && i < blocks.length - 1) {
    const next = blocks[i + 1]; e.preventDefault();
    if (next.type === "table") { blocks.splice(i + 1, 1); render(b.id, s); return; }
    b.text += next.text; b.flags = [...new Set([...b.flags, ...next.flags])]; blocks.splice(i + 1, 1); render(b.id, s);
  } else if (e.key === "ArrowUp" && !ta.value.slice(0, s).includes("\n") && s === en) {
    const prev = blocks.slice(0, i).reverse().find(x => x.type === "p"); if (prev) { e.preventDefault(); docEl.querySelector(`[data-id="${prev.id}"] textarea`).focus(); }
  } else if (e.key === "ArrowDown" && !ta.value.slice(en).includes("\n") && s === en) {
    const next = blocks.slice(i + 1).find(x => x.type === "p"); if (next) { e.preventDefault(); const t = docEl.querySelector(`[data-id="${next.id}"] textarea`); t.focus(); t.setSelectionRange(0, 0); }
  }
});

// insert toolbar
function toolState() {
  const b = blocks.find(x => x.id === current && x.type === "p");
  $("ins-target").textContent = b ? `paragraph ${paraNumbers().get(b.id)}` : "the last paragraph";
}
$("inserts").addEventListener("click", e => {
  const btn = e.target.closest("[data-insert]"); if (!btn) return;
  if (mode !== "edit") toEdit();
  let b = blocks.find(x => x.id === current && x.type === "p") || [...blocks].reverse().find(x => x.type === "p");
  if (!b) { b = P(""); blocks.push(b); }
  const what = btn.dataset.insert;
  if (what === "table") { const t = TABLE(); blocks.splice(idx(b) + 1, 0, t); render(b.id, "end"); }
  else { if (!b.flags.includes(what)) b.flags.push(what); render(b.id, "end"); }
  current = b.id; toolState();
});

// ---------- running ----------
let timer, seq = 0;
function schedule() { clearTimeout(timer); timer = setTimeout(update, 140); }
async function update() {
  const s = ++seq;
  let bytes, name;
  if (mode === "edit") { bytes = buildDocx(blocks); name = DOC_NAME; } else { bytes = file.bytes; name = file.name; }
  const res = await run(bytes, name);
  if (s !== seq) return;
  last = { res, bytes, name };
  show(res, bytes, name);
}

function marginTags() {
  if (mode !== "edit") return;
  for (const row of docEl.querySelectorAll(".para:not(.tbl)")) {
    const b = blockOf(row), c = classify(b.text), tag = row.querySelector(".read");
    tag.textContent = c.label; tag.dataset.kind = c.kind;
  }
}

function show(res, bytes, name) {
  marginTags();
  const out = $("res");
  out.dataset.state = res.ok ? "ok" : "bad";
  $("cmd-file").textContent = name;
  $("src-size").textContent = `${bytes.length.toLocaleString("en-US")} bytes`;
  const line = $("out-line");
  $("exit").textContent = res.ok ? "exit 0" : res.uncaught ? "exit 1" : "exit 2";
  if (res.ok) line.textContent = res.stdout + "\nJSON: out/work_instruction_preview.json\nCSV: out/work_instruction_preview.csv";
  else if (res.uncaught) line.textContent = `Traceback, ${res.uncaught}. The Python tool does not catch this case, so it stops without an ERROR line.`;
  else line.textContent = res.stderr;
  $("stamp").textContent = res.ok ? `Accepted. ${res.parsed.steps.length} step${res.parsed.steps.length === 1 ? "" : "s"}, JSON and CSV written.` : "Refused. Nothing written.";
  for (const r of document.querySelectorAll(".para.err, .fpara.err")) r.classList.remove("err");
  const jump = $("jump");
  jump.hidden = true; jump.dataset.n = ""; jump.dataset.id = "";
  if (!res.ok && res.paragraph) {
    rowFor(res.paragraph)?.classList.add("err");
    jump.hidden = false; jump.textContent = `Go to paragraph ${res.paragraph}`; jump.dataset.n = res.paragraph;
  } else if (!res.ok && mode === "edit") {
    const flagged = flaggedFor(res.code);
    if (flagged) { const row = docEl.querySelector(`[data-id="${flagged.id}"]`); row.classList.add("err"); jump.hidden = false; jump.textContent = flagged.type === "table" ? "Go to the table" : `Go to paragraph ${row.dataset.n}`; jump.dataset.id = flagged.id; }
  }
  notes(res);

  const enc = new TextEncoder();
  $("json-size").textContent = res.ok ? enc.encode(res.json).length.toLocaleString("en-US") : "0";
  $("csv-size").textContent = res.ok ? enc.encode(res.csv).length.toLocaleString("en-US") : "0";
  $("file-out").textContent = res.ok ? ($("tab-csv").getAttribute("aria-selected") === "true" ? res.csv : res.json) : "Nothing written. The run was refused.";
  $("dl-file").disabled = !res.ok;
  $("docx-dl").disabled = mode !== "edit";
}

// The margin: one note per paragraph that made it into the JSON, or one red note where the run stopped.
const pyJson = o => "{" + Object.entries(o).map(([k, v]) => JSON.stringify(k) + ": " + JSON.stringify(v)).join(", ") + "}";
function noteEl(head, n, bad) {
  const a = document.createElement("aside");
  a.className = bad ? "note bad" : "note";
  const h = document.createElement("p"); h.className = "nh";
  const b = document.createElement("b"); b.textContent = head;
  h.append(b);
  if (n) { const s = document.createElement("span"); s.textContent = "¶ " + n; h.append(s); }
  a.append(h);
  return a;
}
function objCode(o) {
  const c = document.createElement("code");
  const parts = Object.entries(o);
  c.append("{");
  parts.forEach(([k, v], i) => {
    const kk = document.createElement("span"); kk.className = "k"; kk.textContent = JSON.stringify(k);
    const vv = document.createElement("span"); vv.className = typeof v === "number" ? "n" : "s"; vv.textContent = JSON.stringify(v);
    c.append(kk, ": ", vv, i < parts.length - 1 ? ", " : "");
  });
  c.append("}");
  return c;
}
function notes(res) {
  const host = mode === "file" ? $("fdoc") : docEl;
  for (const n of document.querySelectorAll("#doc .note, #fdoc .note")) n.remove();
  if (res.ok) {
    const j = JSON.parse(res.json);
    const items = [["title", j.title], ...(j.safety_notes ? [["safety_notes", j.safety_notes]] : []), ...j.steps.map((st, i) => [`steps[${i}]`, st])];
    for (const [path, o] of items) {
      const row = rowFor(o.source_paragraph_index); if (!row) continue;
      const a = noteEl(path, o.source_paragraph_index, false);
      a.append(objCode(o));
      a.setAttribute("aria-label", `JSON for paragraph ${o.source_paragraph_index}: ${path} ${pyJson(o)}`);
      row.append(a);
    }
    return;
  }
  let row = res.paragraph ? rowFor(res.paragraph) : null;
  if (!row && mode === "edit" && !res.uncaught) { const f = flaggedFor(res.code); if (f) row = docEl.querySelector(`[data-id="${f.id}"]`); }
  const a = noteEl(res.uncaught ? "Stopped" : res.code, res.paragraph, true);
  const m = document.createElement("p"); m.className = "nm";
  m.textContent = res.uncaught ? `The Python tool stops here with a traceback (${res.uncaught}).` : res.message;
  const w = document.createElement("p"); w.className = "nw"; w.textContent = "Nothing written.";
  a.append(m, w);
  if (!row) row = host.querySelector(".para, .fpara");
  if (row) row.append(a); else { a.classList.add("solo"); host.append(a); }
}
function flaggedFor(code) {
  const map = { UNSUPPORTED_TABLE: b => b.type === "table", UNSUPPORTED_NUMBERING: b => b.flags?.includes("list"), UNSUPPORTED_WORD_CONTENT: b => b.flags?.some(f => f === "tracked" || f === "field"), UNSUPPORTED_HIDDEN_TEXT: b => b.flags?.includes("hidden"), UNSUPPORTED_BREAK_TYPE: b => b.flags?.includes("pagebreak") };
  return map[code] ? blocks.find(map[code]) : null;
}

// source references
const rowFor = n => (mode === "file" ? $("fdoc") : docEl).querySelector(`[data-n="${n}"]`);
$("jump").addEventListener("click", e => { const t = e.currentTarget; if (t.dataset.n) goTo(t.dataset.n); else { const row = docEl.querySelector(`[data-id="${t.dataset.id}"]`); if (!row || mode !== "edit") return; row.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); row.querySelector("textarea, button")?.focus({ preventScroll: true }); } });
function goTo(n) {
  const row = rowFor(n); if (!row) return;
  row.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  const ta = row.querySelector("textarea"); if (ta) ta.focus({ preventScroll: true }); else { row.tabIndex = -1; row.focus({ preventScroll: true }); }
  row.classList.add("flash"); setTimeout(() => row.classList.remove("flash"), 900);
}

// output tabs and downloads
const tabs = [$("tab-json"), $("tab-csv")];
function selectTab(t) { for (const x of tabs) x.setAttribute("aria-selected", String(x === t)), x.tabIndex = x === t ? 0 : -1; if (last?.res.ok) $("file-out").textContent = t === tabs[1] ? last.res.csv : last.res.json; $("file-out").setAttribute("aria-labelledby", t.id); }
for (const t of tabs) { t.addEventListener("click", () => selectTab(t)); t.addEventListener("keydown", e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); const o = tabs[1 - tabs.indexOf(t)]; selectTab(o); o.focus(); } }); }
function save(data, name, type) { const url = URL.createObjectURL(new Blob([data], { type })); const a = document.createElement("a"); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
$("dl-file").addEventListener("click", () => { if (!last?.res.ok) return; const csv = $("tab-csv").getAttribute("aria-selected") === "true"; save(csv ? last.res.csv : last.res.json, csv ? "work_instruction_preview.csv" : "work_instruction_preview.json", csv ? "text/csv" : "application/json"); });
$("docx-dl").addEventListener("click", () => { if (mode === "edit") save(buildDocx(blocks), DOC_NAME, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"); });

// ---------- presets and files ----------
function setPressed(key) { for (const b of document.querySelectorAll("[data-preset]")) b.setAttribute("aria-pressed", String(b.dataset.preset === key)); }
document.querySelector(".presets").addEventListener("click", e => {
  const b = e.target.closest("[data-preset]"); if (!b) return;
  if (b.dataset.preset === "fixture") { openBytes("synthetic_sop.docx", Uint8Array.from(atob(FIXTURE_B64), c => c.charCodeAt(0))); setPressed("fixture"); return; }
  blocks = PRESETS[b.dataset.preset](); current = null; setPressed(b.dataset.preset); toEdit(true);
});
for (const pb of document.querySelectorAll("[data-try]")) pb.addEventListener("click", () => {
  blocks = PRESETS[pb.dataset.try](); current = null; setPressed(pb.dataset.try); toEdit(true);
  $("bench").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  $("bench").focus({ preventScroll: true });
});
$("open").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return;
  const bytes = new Uint8Array(await f.slice(0, 8 * 1024 * 1024 + 1).arrayBuffer());
  e.target.value = "";
  setPressed(""); openBytes(f.name, bytes);
});
function openBytes(name, bytes) { mode = "file"; file = { name, bytes }; $("paper").dataset.mode = "file"; $("file-name").textContent = name; fileView(null); update().then(() => fileView(last.res)); }
function fileView(res) {
  const list = $("fdoc");
  if (!res) { list.replaceChildren(); return; }
  const ps = res.paragraphs;
  $("file-note").textContent = ps ? `${ps.length} paragraph${ps.length === 1 ? "" : "s"} read from the body. This view is read-only.` : "The parser stopped before it reached the paragraphs, so there is nothing to show from the body.";
  $("copy-edit").hidden = !ps || !ps.length;
  list.replaceChildren(...(ps || []).map(([n, text]) => {
    const row = document.createElement("div"); row.className = "fpara"; row.dataset.n = n;
    const no = document.createElement("span"); no.className = "pno"; no.textContent = n;
    const t = document.createElement("p"); t.textContent = text || " ";
    const c = classify(text), tag = document.createElement("span"); tag.className = "read"; tag.textContent = c.label; tag.dataset.kind = c.kind;
    row.append(no, t, tag); return row;
  }));
  if (!res.ok && res.paragraph) list.querySelector(`[data-n="${res.paragraph}"]`)?.classList.add("err");
  notes(res);
}
function toEdit(fresh) { mode = "edit"; file = null; $("paper").dataset.mode = "edit"; $("fdoc").replaceChildren(); render(); if (fresh) toolState(); }
$("back-edit").addEventListener("click", () => { setPressed(""); toEdit(); });
$("copy-edit").addEventListener("click", () => { const ps = last?.res.paragraphs; if (!ps) return; blocks = ps.map(([, t]) => P(t)); setPressed(""); toEdit(true); });

// recorded files: compare the bench result for the fixture with the recorded bytes
async function parity() {
  const r = await run(Uint8Array.from(atob(FIXTURE_B64), c => c.charCodeAt(0)), "synthetic_sop.docx");
  const same = r.ok && r.json === $("rec-json").textContent && r.csv === $("rec-csv").textContent;
  const el = $("parity"); el.dataset.same = String(same);
  el.textContent = same ? "The editor above gives these same two files, byte for byte, for the test fixture. Checked when this page loaded." : "The editor above gives different files for the test fixture in this browser.";
}

render(); toolState(); parity();
document.documentElement.dataset.bench = "ready";
