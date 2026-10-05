import { order, createLedger, summarize, applyCount, toCSV } from "./countback-ledger.mjs";
import { walkthroughSteps } from "./countback-walkthrough.mjs";

const $ = id => document.getElementById(id);
let ledger = createLedger();
let messages = [];
let editSku = null;
let demoRunning = false;
let runToken = 0;
let manualSequence = 0;

function status(text) {
  $("walkthrough-status").textContent = text;
}

function appendMessage(role, text) {
  const entry = document.createElement("article");
  entry.className = "utterance " + (role === "system" ? "is-agent" : "is-user");
  const label = document.createElement("span");
  label.className = "utterance-label";
  label.textContent = role === "system" ? "COUNTBACK READBACK" : "SYNTHETIC DELIVERY NOTE";
  const copy = document.createElement("p");
  copy.textContent = text;
  entry.append(label, copy);
  $("transcript").append(entry);
  messages.push({ role, text });
  $("message-count").textContent = messages.length + (messages.length === 1 ? " entry" : " entries");
  $("transcript").scrollTop = $("transcript").scrollHeight;
}

function makeCell(row, className, content) {
  const cell = document.createElement(row ? "td" : "th");
  if (className) cell.className = className;
  if (content instanceof Node) cell.append(content);
  else cell.textContent = content;
  return cell;
}

function renderRows(rows) {
  const body = $("rows");
  body.replaceChildren();
  for (const row of rows) {
    const tr = document.createElement("tr");
    const product = document.createElement("div");
    product.className = "product-cell";
    const name = document.createElement("strong");
    name.textContent = row.name;
    const pack = document.createElement("small");
    pack.textContent = row.perCarton + " " + row.unit + " per carton · " + row.sku;
    product.append(name, pack);
    tr.append(makeCell(true, "", product));
    tr.append(makeCell(true, "number-cell", String(row.ordered)));

    const received = document.createElement("div");
    received.className = "received-cell";
    const total = document.createElement("strong");
    total.textContent = row.checked ? String(row.received) : "Not counted";
    received.append(total);
    if (row.checked) {
      const detail = document.createElement("small");
      detail.textContent = row.cartons + " cartons + " + row.loose + " loose";
      received.append(detail);
    }
    tr.append(makeCell(true, "", received));
    tr.append(makeCell(true, "number-cell", row.checked ? String(row.usable) : "-"));

    let exception = "Waiting for count";
    let warning = !row.checked;
    if (row.checked) {
      const parts = [];
      if (row.shortage) parts.push(row.shortage + " short");
      if (row.damaged) parts.push(row.damaged + " damaged");
      if (row.overage) parts.push(row.overage + " extra");
      exception = parts.length ? parts.join(" · ") : "Matches order";
      warning = parts.length > 0;
    }
    tr.append(makeCell(true, "exception-text" + (warning ? " is-warning" : ""), exception));
    const action = document.createElement("button");
    action.className = "row-action";
    action.type = "button";
    action.dataset.edit = row.sku;
    action.textContent = row.checked ? "Edit count" : "Count line";
    action.setAttribute("aria-label", (row.checked ? "Edit" : "Count") + " " + row.name);
    action.disabled = demoRunning;
    action.addEventListener("click", () => openEdit(row.sku));
    tr.append(makeCell(true, "", action));
    body.append(tr);
  }
}

function renderExceptions(rows) {
  const list = $("exceptions");
  list.replaceChildren();
  const pending = rows.filter(row => !row.checked).map(row => ({
    text: row.name + " has not been counted.",
    clear: false
  }));
  for (const row of rows.filter(item => item.checked)) {
    if (row.shortage) pending.push({ text: row.name + ": " + row.shortage + " units short.", clear: false });
    if (row.damaged) pending.push({ text: row.name + ": " + row.damaged + " units marked damaged.", clear: false });
    if (row.overage) pending.push({ text: row.name + ": " + row.overage + " units above the order.", clear: false });
    if (!row.shortage && !row.damaged && !row.overage) pending.push({ text: row.name + " matches the ordered quantity.", clear: true });
  }
  $("exception-count").textContent = pending.length + (pending.length === 1 ? " item" : " items");
  for (const item of pending) {
    const li = document.createElement("li");
    if (item.clear) li.className = "is-clear";
    li.textContent = item.text;
    list.append(li);
  }
}

function renderHistory() {
  const body = $("history");
  body.replaceChildren();
  const events = [...ledger.events].reverse();
  $("revision").textContent = ledger.revision ? ledger.revision + (ledger.revision === 1 ? " recorded count" : " recorded counts") : "No changes yet";
  if (!events.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.className = "history-empty";
    cell.colSpan = 4;
    cell.textContent = "Counts and corrections will remain listed here.";
    row.append(cell);
    body.append(row);
    return;
  }
  for (const event of events) {
    const item = order.items.find(product => product.sku === event.sku);
    const row = document.createElement("tr");
    const rev = document.createElement("span");
    rev.className = "history-revision";
    rev.textContent = String(event.revision).padStart(2, "0");
    row.append(makeCell(true, "", rev));
    row.append(makeCell(true, "", item.name));
    row.append(makeCell(true, "number-cell", event.cartons + " cartons + " + event.loose + " loose, " + event.damaged + " damaged"));
    row.append(makeCell(true, "history-note", event.evidence));
    body.append(row);
  }
}

function render() {
  const rows = summarize(ledger);
  const checked = rows.filter(row => row.checked).length;
  const shortage = rows.reduce((sum, row) => sum + (row.shortage || 0), 0);
  const damaged = rows.reduce((sum, row) => sum + row.damaged, 0);
  const overage = rows.reduce((sum, row) => sum + (row.overage || 0), 0);
  $("checked").textContent = String(checked);
  $("short").textContent = checked ? String(shortage) : "-";
  $("damage").textContent = checked ? String(damaged) : "-";
  $("overage").textContent = checked ? String(overage) : "-";
  $("export").disabled = checked !== order.items.length || demoRunning;
  $("demo").disabled = demoRunning;
  $("stop-demo").hidden = !demoRunning;
  $("reset").disabled = demoRunning;
  $("review-note").textContent = checked === order.items.length
    ? "All product lines have a count. Review each source note before export."
    : "Check all " + order.items.length + " product lines before exporting.";
  renderRows(rows);
  renderExceptions(rows);
  renderHistory();
}

function openEdit(sku) {
  if (demoRunning) return;
  editSku = sku;
  const row = summarize(ledger).find(item => item.sku === sku);
  $("edit-title").textContent = "Review " + row.name;
  for (const field of ["cartons", "loose", "damaged"]) $(field).value = String(row[field]);
  $("edit-error").textContent = "";
  $("edit-dialog").showModal();
}

function wait(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function playWalkthrough() {
  if (demoRunning) return;
  demoRunning = true;
  const token = ++runToken;
  ledger = createLedger();
  messages = [];
  $("transcript").replaceChildren();
  const empty = document.createElement("p");
  empty.className = "empty-state";
  empty.textContent = "The example and readback will appear here.";
  $("transcript").append(empty);
  $("message-count").textContent = "0 entries";
  status("Playing a scripted sample. No microphone or API is used.");
  render();
  for (let index = 0; index < walkthroughSteps.length; index++) {
    await wait(420);
    if (token !== runToken) return;
    const step = walkthroughSteps[index];
    appendMessage("user", step.text);
    applyCount(ledger, { ...step, evidence: step.text }, "guided-" + index, [step.text]);
    render();
    await wait(360);
    if (token !== runToken) return;
    appendMessage("system", step.reply);
  }
  demoRunning = false;
  status("Guided sample complete. Review exceptions, edit a count or export the draft.");
  render();
}

$("demo").addEventListener("click", playWalkthrough);
$("stop-demo").addEventListener("click", () => {
  if (!demoRunning) return;
  runToken++;
  demoRunning = false;
  status("Walkthrough stopped. Current draft remains available.");
  render();
});
$("reset").addEventListener("click", () => {
  if (demoRunning) return;
  ledger = createLedger();
  messages = [];
  $("transcript").replaceChildren();
  const empty = document.createElement("p");
  empty.className = "empty-state";
  empty.textContent = "The example and readback will appear here.";
  $("transcript").append(empty);
  $("message-count").textContent = "0 entries";
  status("New sample receipt ready.");
  render();
});
$("cancel-edit").addEventListener("click", () => $("edit-dialog").close());
$("edit-form").addEventListener("submit", event => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  const args = { sku: editSku };
  for (const field of ["cartons", "loose", "damaged"]) args[field] = Number($(field).value);
  args.evidence = "Manual review: " + args.cartons + " cartons, " + args.loose + " loose, " + args.damaged + " damaged.";
  try {
    manualSequence++;
    applyCount(ledger, args, "manual-" + Date.now() + "-" + manualSequence, [args.evidence]);
    $("edit-dialog").close();
    status("Manual count saved to the local draft history.");
    render();
  } catch (error) {
    $("edit-error").textContent = error.message;
  }
});
$("export").addEventListener("click", () => {
  if ($("export").disabled) return;
  const file = new Blob([toCSV(ledger)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = "countback-PO-1048.csv";
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  status("CSV draft created in this browser. No receipt was sent.");
});

render();
