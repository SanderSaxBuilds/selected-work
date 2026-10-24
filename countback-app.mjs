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
  renderTotals(totals);
  renderRows(rows);
  renderAttention(rows, totals);
  renderHistory();
  $("export").disabled = !complete || demoRunning;
  $("print").disabled = !complete || demoRunning;
  $("demo").disabled = demoRunning;
  $("stop-demo").hidden = !demoRunning;
  $("reset").disabled = demoRunning;
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
