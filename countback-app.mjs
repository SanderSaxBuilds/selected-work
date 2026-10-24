import { order, createLedger, summarize, applyCount, toCSV, rowExceptions, receiptTotals } from "./countback-ledger.mjs";
import { walkthroughSteps } from "./countback-walkthrough.mjs";

const $ = id => document.getElementById(id);
let ledger = createLedger();
let messages = 0;
let editSku = null;
let freshSku = null;
let demoRunning = false;
let runToken = 0;
let manualSequence = 0;
const sources = new Map();

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const unitWord = (row, n) => n === 1 ? row.unit.replace(/s$/, "") : row.unit;

function status(text) { $("walkthrough-status").textContent = text; }

// The draft is kept in this browser only, so a refresh or a closed tab does not lose the counts.
const DRAFT_KEY = `countback-draft-${order.id}`;
function saveDraft() {
  try {
    if (!ledger.events.length) { localStorage.removeItem(DRAFT_KEY); return; }
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ledger, sources: [...sources], savedAt: new Date().toISOString() }));
  } catch {}
}
function loadDraft() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch { return null; }
  if (!data || !data.ledger || !Array.isArray(data.ledger.events) || !Array.isArray(data.ledger.seen)) return null;
  const known = new Set(order.items.map(item => item.sku));
  const whole = n => Number.isSafeInteger(n) && n >= 0 && n <= 10000;
  for (const [i, e] of data.ledger.events.entries()) {
    const item = order.items.find(product => product.sku === e.sku);
    if (!known.has(e.sku) || !whole(e.cartons) || !whole(e.loose) || !whole(e.damaged) || e.damaged > e.cartons * item.perCarton + e.loose || e.revision !== i + 1 || typeof e.evidence !== "string") return null;
  }
  if (data.ledger.revision !== data.ledger.events.length) return null;
  return data;
}

function resetLog() {
  messages = 0;
  $("transcript").replaceChildren(el("p", "empty-log", "Spoken counts and readbacks appear here while the walkthrough plays."));
  $("message-count").textContent = "No entries";
}

function appendMessage(role, text) {
  if (!messages) $("transcript").replaceChildren();
  const entry = el("article", "utterance" + (role === "system" ? " is-agent" : ""));
  entry.append(el("span", "utterance-label", role === "system" ? "Countback" : "Receiver"), el("p", "", text));
  $("transcript").append(entry);
  messages++;
  $("message-count").textContent = plural(messages, "entry", "entries");
  $("transcript").scrollTop = $("transcript").scrollHeight;
}

function renderDelivery(rows, totals) {
  const cartons = order.items.reduce((n, item) => n + Math.ceil(item.ordered / item.perCarton), 0);
  const meta = $("delivery-meta");
  if (!meta.childElementCount) {
    for (const [term, value] of [["Arrived", "7:42 AM"], ["Drop-off", order.dock], ["Expected", plural(cartons, "carton", "cartons")], ["Lines", String(order.items.length)]]) {
      const group = el("div"); group.append(el("dt", "", term), el("dd", "", value)); meta.append(group);
    }
    $("route").textContent = `${order.supplier} to ${order.store}`;
    $("po-title").textContent = order.id;
  }
  $("progress-count").textContent = `${totals.checked} of ${totals.lines}`;
  const track = $("progress-track");
  track.style.setProperty("--lines", String(rows.length));
  track.replaceChildren(...rows.map(row => {
    const flags = rowExceptions(row);
    return el("span", !row.checked ? "" : flags[0].kind === "match" ? "is-match" : "is-flag");
  }));
}

// The pallet: one isometric stack per line. Expected cartons are outlines, counted cartons are kraft,
// a short line keeps red outlines where cartons are missing, extras are blue, damage marks the top carton red.
const SVGNS = "http://www.w3.org/2000/svg";
const S = 22, CH = 0.78, GAP = 1.75, CAP = 9;
const iso = (x, y, z) => [(x - y) * S * 0.866, (x + y) * S * 0.5 - z * S];
const pts = list => list.map(p => iso(...p).map(n => n.toFixed(1)).join(",")).join(" ");
function svg(tag, attrs = {}) { const n = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; }
function boxShape(x, y, z, w, d, h, cls) {
  const g = svg("g", { class: cls });
  const t = z + h;
  g.append(
    svg("polygon", { class: "l", points: pts([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, t], [x, y + d, t]]) }),
    svg("polygon", { class: "r", points: pts([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, t], [x + w, y, t]]) }),
    svg("polygon", { class: "t", points: pts([[x, y, t], [x + w, y, t], [x + w, y + d, t], [x, y + d, t]]) }),
  );
  return g;
}
let palletSku = null;
function palletCaption(row) {
  const cap = $("pallet-cap");
  if (!row) { cap.textContent = "Each stack is one line, each box one carton. Choose a stack to count it."; return; }
  const expected = Math.ceil(row.ordered / row.perCarton);
  cap.replaceChildren(el("b", "", row.name), document.createTextNode(row.checked
    ? `, ${plural(row.cartons, "carton", "cartons")} and ${row.loose} loose of ${expected} expected. ${rowExceptions(row).map(f => f.text).join(", ")}.`
    : `, ${expected} cartons expected, not counted yet. Enter or click to count.`));
}
function renderPallet(rows) {
  const host = $("pallet");
  if (!host) return;
  host.replaceChildren();
  const cols = 3, rowsN = Math.ceil(rows.length / cols);
  const spanX = (cols - 1) * GAP + 1, spanY = (rowsN - 1) * GAP + 1;
  const base = svg("g", { class: "base" });
  base.append(boxShape(-0.35, -0.35, -0.42, spanX + 0.7, spanY + 0.7, 0.42, "slab"));
  host.append(base);
  let tallest = 0;
  const order3 = rows.map((row, i) => ({ row, gx: i % cols, gy: Math.floor(i / cols) }))
    .sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy) || a.gy - b.gy);
  for (const { row, gx, gy } of order3) {
    const x = gx * GAP, y = gy * GAP;
    const expected = Math.ceil(row.ordered / row.perCarton);
    const have = row.checked ? row.cartons + (row.loose > 0 ? 1 : 0) : 0;
    const height = Math.min(CAP, Math.max(expected, have));
    tallest = Math.max(tallest, height);
    const g = svg("g", { class: "stack" + (row.sku === freshSku ? " is-fresh" : "") + (row.sku === palletSku ? " is-on" : ""), tabindex: demoRunning ? "-1" : "0", role: "button" });
    g.setAttribute("aria-label", `${row.name}: ${row.checked ? `${row.received} ${row.unit} counted, ${rowExceptions(row).map(f => f.text).join(", ")}` : "not counted"}. ${row.checked ? "Recount" : "Count"} this line.`);
    g.append(svg("polygon", { class: "hit", points: pts([[x - 0.1, y - 0.1, height * CH + 0.2], [x + 1.1, y - 0.1, height * CH + 0.2], [x + 1.1, y - 0.1, -0.1], [x + 1.1, y + 1.1, -0.1], [x - 0.1, y + 1.1, -0.1], [x - 0.1, y + 1.1, height * CH + 0.2]]) }));
    for (let z = 0; z < height; z++) {
      let cls = "ghost";
      if (row.checked) cls = z < Math.min(have, expected) ? "counted" : z < expected ? "missing" : "extra";
      if (row.checked && row.damaged > 0 && z === Math.min(have, expected) - 1) cls = "damaged";
      const b = boxShape(x + 0.04, y + 0.04, z * CH, 0.92, 0.92, CH - 0.04, "box " + cls);
      b.style.setProperty("--z", String(z));
      if (cls === "counted" || cls === "extra") b.append(svg("polyline", { class: "tape", points: pts([[x + 0.5, y + 0.04, (z + 1) * CH], [x + 0.5, y + 0.96, (z + 1) * CH]]) }));
      g.append(b);
    }
    if (Math.max(expected, have) > CAP) {
      const [tx, ty] = iso(x + 0.5, y + 0.5, CAP * CH + 0.5);
      g.append(Object.assign(svg("text", { class: "more", x: tx.toFixed(1), y: ty.toFixed(1), "text-anchor": "middle" }), { textContent: `+${Math.max(expected, have) - CAP}` }));
    }
    g.addEventListener("click", () => openEdit(row.sku));
    g.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openEdit(row.sku); } });
    const on = () => { palletSku = row.sku; for (const s of host.querySelectorAll(".stack")) s.classList.toggle("is-on", s === g); palletCaption(row); };
    g.addEventListener("pointerenter", on);
    g.addEventListener("focus", on);
    host.append(g);
  }
  // Fixed frame for up to seven cartons, taller only when a stack needs it, so the pallet does not jump.
  const top = Math.max(7, tallest) * CH + 0.6;
  const xs = [iso(-0.35, spanY + 0.35, 0)[0], iso(spanX + 0.35, -0.35, 0)[0]];
  const yTop = iso(-0.35, -0.35, top)[1], yBot = iso(spanX + 0.35, spanY + 0.35, -0.42)[1];
  host.setAttribute("viewBox", `${(xs[0] - 4).toFixed(1)} ${(yTop - 4).toFixed(1)} ${(xs[1] - xs[0] + 8).toFixed(1)} ${(yBot - yTop + 8).toFixed(1)}`);
  palletCaption(rows.find(r => r.sku === palletSku));
}
$("pallet")?.addEventListener("pointerleave", () => { palletSku = null; for (const s of $("pallet").querySelectorAll(".stack")) s.classList.remove("is-on"); palletCaption(null); });

function renderTotals(totals) {
  const box = $("totals");
  const any = totals.checked > 0;
  const tiles = [
    ["", "Received", any ? String(totals.received) : "0", any ? `of ${totals.orderedChecked} ordered on counted lines` : `${totals.ordered} units on order`],
    ["is-short", "Short", any ? String(totals.shortage) : "0", "units below the order"],
    ["is-damaged", "Damaged", any ? String(totals.damaged) : "0", "included in received"],
    ["is-extra", "Extra", any ? String(totals.overage) : "0", "units above the order"],
  ];
  box.replaceChildren(...tiles.map(([cls, label, value, note]) => {
    const tile = el("div", `total ${Number(value) > 0 ? cls : ""}`);
    tile.append(el("p", "total-label", label), el("p", "total-value", value), el("p", "total-note", note));
    return tile;
  }));
}

function cell(className, label) {
  const td = el("td", className);
  if (label) td.dataset.label = label;
  return td;
}

function renderRows(rows) {
  const body = $("rows");
  body.replaceChildren();
  const firstOpen = rows.find(row => !row.checked)?.sku;
  for (const row of rows) {
    const tr = el("tr", row.sku === freshSku ? "is-fresh" : "");
    const product = cell("product-cell");
    const meta = el("span", "product-meta", `${row.size}, ${row.perCarton} ${row.unit} per carton, `);
    meta.append(el("span", "sku", row.sku));
    product.append(el("span", "product-name", row.name), meta);
    const ordered = cell("num-col", "Ordered"); ordered.textContent = String(row.ordered);
    const received = cell("num-col", "Received");
    if (row.checked) {
      received.append(document.createTextNode(String(row.received)), el("span", "count-detail", `${plural(row.cartons, "carton", "cartons")} and ${row.loose} loose`));
    } else received.append(el("span", "not-counted", "Not yet"));
    const usable = cell("num-col", "Usable");
    usable.textContent = row.checked ? String(row.usable) : "0";
    const statusCell = cell("status-cell", "Status");
    const chips = el("div", "chips");
    for (const flag of rowExceptions(row)) chips.append(el("span", `chip ${flag.kind}`, flag.text));
    statusCell.append(chips);
    const actionCell = cell("action-cell");
    const action = el("button", "row-action" + (row.sku === firstOpen ? " is-first" : ""), row.checked ? "Recount" : "Count");
    action.type = "button";
    action.dataset.edit = row.sku;
    action.setAttribute("aria-label", `${row.checked ? "Recount" : "Count"} ${row.name}`);
    action.disabled = demoRunning;
    action.addEventListener("click", () => openEdit(row.sku));
    actionCell.append(action);
    tr.append(product, ordered, received, usable, statusCell, actionCell);
    body.append(tr);
  }
}

function renderAttention(rows, totals) {
  const list = $("attention");
  const items = [];
  for (const row of rows) {
    for (const flag of rowExceptions(row)) {
      if (flag.kind === "short") items.push(["short", `${row.name}: ${flag.units} ${unitWord(row, flag.units)} short of the ${row.ordered} ordered.`]);
      if (flag.kind === "damaged") items.push(["damaged", `${row.name}: ${flag.units} ${unitWord(row, flag.units)} damaged. Set aside for a supplier credit.`]);
      if (flag.kind === "extra") items.push(["extra", `${row.name}: ${flag.units} ${unitWord(row, flag.units)} more than ordered.`]);
    }
  }
  const open = rows.filter(row => !row.checked);
  if (open.length) items.push(["pending", `${plural(open.length, "line", "lines")} still to count: ${open.map(row => row.name).join(", ")}.`]);
  if (!items.length) items.push(["clear", "Every line matches the order."]);
  list.replaceChildren(...items.map(([kind, text]) => el("li", kind, text)));
  $("attention-count").textContent = totals.checked ? plural(totals.attention, "line flagged", "lines flagged") : "";
}

function renderHistory() {
  const list = $("history");
  $("revision").textContent = ledger.revision ? plural(ledger.revision, "count", "counts") : "";
  if (!ledger.events.length) { list.replaceChildren(el("li", "history-empty", "Every count and correction will be listed here. Nothing is overwritten.")); list.querySelector("li").style.display = "block"; return; }
  const latest = new Map(ledger.events.map(event => [event.sku, event.revision]));
  list.replaceChildren(...[...ledger.events].reverse().map(event => {
    const item = order.items.find(product => product.sku === event.sku);
    const li = el("li", latest.get(event.sku) === event.revision ? "" : "is-replaced");
    li.append(el("span", "history-rev", String(event.revision).padStart(2, "0")));
    const body = el("div");
    const main = el("span", "history-main");
    main.append(el("strong", "", item.name), document.createTextNode(`, ${plural(event.cartons, "carton", "cartons")} and ${event.loose} loose, ${event.damaged} damaged = ${event.cartons * item.perCarton + event.loose} ${item.unit}`));
    if (latest.get(event.sku) !== event.revision) main.append(el("span", "replaced-tag", "Replaced"));
    body.append(main, el("span", "history-quote", `${sources.get(event.revision) ?? "Count"}: ${event.evidence}`));
    li.append(body);
    return li;
  }));
}

function render() {
  const rows = summarize(ledger);
  const totals = receiptTotals(rows);
  const complete = totals.checked === totals.lines;
  renderDelivery(rows, totals);
  renderPallet(rows);
  renderTotals(totals);
  renderRows(rows);
  renderAttention(rows, totals);
  renderHistory();
  $("export").disabled = !complete || demoRunning;
  $("print").disabled = !complete || demoRunning;
  $("demo").disabled = demoRunning;
  $("stop-demo").hidden = !demoRunning;
  $("reset").disabled = demoRunning;
  const next = rows.find(row => !row.checked);
  $("hero-demo").disabled = demoRunning;
  $("hero-count").disabled = demoRunning;
  $("hero-count").textContent = next ? `Count ${next.name}` : "Recount a line";
  $("hero-count").dataset.sku = (next || rows[0]).sku;
  $("draft-chip").textContent = complete ? "Ready to export" : "Draft";
  $("draft-chip").classList.toggle("is-ready", complete);
  $("review-note").textContent = complete
    ? `All ${totals.lines} lines counted. ${totals.attention ? `${plural(totals.attention, "line needs", "lines need")} a note to the supplier.` : "Everything matches the order."}`
    : `Count all ${totals.lines} lines to export the receipt. ${plural(totals.lines - totals.checked, "line", "lines")} left.`;
}

function record(args, callId, evidence, source) {
  const result = applyCount(ledger, args, callId, [evidence]);
  if (result.revision) sources.set(result.revision, source);
  freshSku = args.sku;
  return result;
}

function openEdit(sku) {
  if (demoRunning) return;
  editSku = sku;
  const row = summarize(ledger).find(item => item.sku === sku);
  $("edit-title").textContent = `${row.checked ? "Recount" : "Count"} ${row.name}`;
  $("edit-intro").textContent = `${row.perCarton} ${row.unit} per carton, ${row.ordered} ordered. Damaged units are part of the received total.`;
  $("cartons").value = row.checked ? String(row.cartons) : "";
  $("loose").value = String(row.loose);
  $("damaged").value = String(row.damaged);
  $("edit-error").textContent = "";
  updateLiveTotal();
  $("edit-dialog").showModal();
  $("cartons").focus();
  $("cartons").select();
}

function readField(id) {
  const raw = $(id).value.trim();
  return /^\d+$/.test(raw) ? Number(raw) : NaN;
}

function updateLiveTotal() {
  const row = order.items.find(item => item.sku === editSku);
  if (!row) return;
  const cartons = readField("cartons"), loose = readField("loose"), damaged = readField("damaged");
  if ([cartons, loose, damaged].some(Number.isNaN)) { $("live-total").textContent = "Enter whole numbers to see the total."; return; }
  const received = cartons * row.perCarton + loose;
  const diff = received - row.ordered;
  $("live-total").textContent = `${received} ${row.unit} received, ${Math.max(0, received - damaged)} usable. ${diff === 0 ? "Matches the order." : diff < 0 ? `${-diff} short.` : `${diff} extra.`}`;
}

const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms));

async function playWalkthrough() {
  if (demoRunning) return;
  demoRunning = true;
  const token = ++runToken;
  ledger = createLedger(); sources.clear(); freshSku = null;
  resetLog();
  status("Playing the scripted delivery.");
  render();
  saveDraft();
  $("stop-demo").focus();
  for (let index = 0; index < walkthroughSteps.length; index++) {
    await wait(700);
    if (token !== runToken) return;
    const step = walkthroughSteps[index];
    appendMessage("user", step.text);
    record({ ...step, evidence: step.text }, "guided-" + index, step.text, "Walkthrough");
    render();
    saveDraft();
    await wait(550);
    if (token !== runToken) return;
    appendMessage("system", step.reply);
  }
  demoRunning = false;
  status("Walkthrough finished. Recount any line, then print or export the receipt.");
  const hadFocus = document.activeElement === document.body || document.activeElement === $("stop-demo");
  render();
  if (hadFocus) $("demo").focus();
}

$("demo").addEventListener("click", playWalkthrough);
// Hero shortcuts: start the walkthrough beside its readback, or count the next open line straight away.
$("hero-demo").addEventListener("click", () => {
  const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (matchMedia("(max-width: 860px)").matches) $("walkthrough-title").scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
  playWalkthrough();
});
$("hero-count").addEventListener("click", () => openEdit($("hero-count").dataset.sku));
$("stop-demo").addEventListener("click", () => {
  if (!demoRunning) return;
  runToken++;
  demoRunning = false;
  status("Stopped. The counts so far stay on the receipt.");
  render();
  $("demo").focus();
});
$("reset").addEventListener("click", () => {
  if (demoRunning) return;
  if (ledger.events.length && !window.confirm("Start a new receipt? The counts on this one will be cleared.")) return;
  ledger = createLedger(); sources.clear(); freshSku = null;
  resetLog();
  status("New receipt. Play the walkthrough or count a line yourself.");
  render();
  saveDraft();
});
for (const id of ["cartons", "loose", "damaged"]) $(id).addEventListener("input", updateLiveTotal);
// Glove steppers: big minus and plus buttons either side of each count.
for (const id of ["cartons", "loose", "damaged"]) {
  const input = $(id);
  const name = input.parentElement.firstChild.textContent.trim().toLowerCase();
  const wrap = el("div", "stepper");
  const step = delta => {
    const now = /^\d+$/.test(input.value.trim()) ? Number(input.value) : 0;
    input.value = String(Math.min(10000, Math.max(0, now + delta)));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const minus = el("button", "", "−"), plus = el("button", "", "+");
  minus.type = plus.type = "button";
  minus.setAttribute("aria-label", `One fewer, ${name}`);
  plus.setAttribute("aria-label", `One more, ${name}`);
  minus.addEventListener("click", () => step(-1));
  plus.addEventListener("click", () => step(1));
  input.replaceWith(wrap);
  wrap.append(minus, input, plus);
}
$("fill-order").addEventListener("click", () => {
  const row = order.items.find(item => item.sku === editSku);
  if (!row) return;
  $("cartons").value = String(Math.floor(row.ordered / row.perCarton));
  $("loose").value = String(row.ordered % row.perCarton);
  if (!$("damaged").value.trim()) $("damaged").value = "0";
  $("edit-error").textContent = "";
  updateLiveTotal();
  $("cartons").focus();
});
$("cancel-edit").addEventListener("click", () => $("edit-dialog").close());
$("edit-dialog").addEventListener("close", () => {
  const button = document.querySelector(`[data-edit="${editSku}"]`);
  if (button) button.focus();
});
$("edit-form").addEventListener("submit", event => {
  event.preventDefault();
  const args = { sku: editSku };
  for (const field of ["cartons", "loose", "damaged"]) {
    args[field] = readField(field);
    if (Number.isNaN(args[field])) { $("edit-error").textContent = "Use whole numbers of 0 or more in every field."; $(field).focus(); return; }
  }
  const evidence = `Manual count: ${args.cartons} cartons, ${args.loose} loose, ${args.damaged} damaged.`;
  try {
    manualSequence++;
    record({ ...args, evidence }, "manual-" + Date.now() + "-" + manualSequence, evidence, "Manual count");
    render();
    saveDraft();
    $("edit-dialog").close();
    status(`${order.items.find(item => item.sku === editSku).name} saved. The history keeps every earlier count.`);
  } catch (error) {
    $("edit-error").textContent = error.message;
  }
});
function download(text, name, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url; link.download = name; link.hidden = true;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("export").addEventListener("click", () => {
  if ($("export").disabled) return;
  download(toCSV(ledger), `countback-${order.id}.csv`, "text/csv;charset=utf-8");
  status("CSV saved to this device. Nothing was sent.");
});
$("print").addEventListener("click", () => { if (!$("print").disabled) window.print(); });

resetLog();
const draft = loadDraft();
if (draft) {
  ledger = draft.ledger;
  for (const [rev, source] of draft.sources || []) if (Number.isSafeInteger(rev) && typeof source === "string") sources.set(rev, source);
  const at = new Date(draft.savedAt);
  status(`Restored the draft saved in this browser${Number.isNaN(at.getTime()) ? "" : ` at ${at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}. New receipt clears it.`);
}
render();
