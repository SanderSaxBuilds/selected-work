// Webhook receipt preview. The receiver in the browser (same checks as receipt_store.py, from webhook-bench.mjs),
// drawn twice: the opening sequence diagram at the top of the page and the full test form below it.
// Both use one database and one signing key, so what one sends the other sees.
import { createStore, receive, state, signature, ReceiptError, MAX_BODY } from "../../webhook-bench.mjs";

const $ = id => document.getElementById(id);
const enc = new TextEncoder();
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const FIXTURE = { event_id: "evt_demo_001", shipment: "DEMO_1042", status: "in_transit", event_time: "2026-10-18T00:00:00Z" };
const j = o => JSON.stringify(o);
const PRESETS = {
  first: { label: "First delivery", body: j(FIXTURE) },
  retry: { label: "Same again", body: j(FIXTURE) },
  reordered: { label: "Same, keys in another order", body: JSON.stringify({ status: "in_transit", event_time: "2026-10-18T00:00:00Z", shipment: "DEMO_1042", event_id: "evt_demo_001" }, null, 2) },
  conflict: { label: "Same ID, changed status", body: j({ ...FIXTURE, status: "delivered" }) },
  older: { label: "Older update", body: j({ event_id: "evt_demo_older", shipment: "DEMO_1042", status: "created", event_time: "2026-10-17T23:00:00Z" }) },
  newer: { label: "Newer update, delivered", body: j({ event_id: "evt_demo_002", shipment: "DEMO_1042", status: "delivered", event_time: "2026-10-18T02:00:00Z" }) },
  badsig: { label: "Signed with the wrong key", body: j(FIXTURE), sign: "other" },
  stale: { label: "Signed 6 minutes ago", body: j(FIXTURE), skew: "-360" },
  dupkeys: { label: "Duplicate JSON key", body: j(FIXTURE).slice(0, -1) + ',"status":"created"}' },
  baddate: { label: "Date 30 February", body: j({ ...FIXTURE, event_id: "evt_demo_003", event_time: "2026-02-30T00:00:00Z" }) },
};
const STAGES = ["size", "clock", "hmac", "schema", "store"];
const MEANING = {
  recorded: "Saved. The update and the new shipment status were written together.",
  duplicate: "Already saved with the same content. Answered 200, nothing written.",
  event_id_conflict: "This ID is already saved with different content. Refused, nothing written.",
  invalid_signature: "The signature does not match this body and time. Refused before the body is read.",
  expired_signature: "The time header is more than 300 seconds from the receiver's clock. Refused.",
  invalid_timestamp: "The time header is not a whole number of seconds. Refused.",
  invalid_event: "Signed correctly, but the body is not one valid update. Refused, nothing written.",
  body_too_large: "The body is over 65,536 bytes. Refused before anything else.",
};

let store = createStore();
let secret = newKey();
let boots = 1;
let presetName = "first";
let sent = 0;
const journal = [];
function newKey() { return crypto.getRandomValues(new Uint8Array(32)); }
const other = enc.encode("a-key-the-receiver-has-never-seen");
const nowSec = () => Math.floor(Date.now() / 1000);

const bodyEl = $("wh-body"), skewEl = $("wh-skew"), signEl = $("wh-sign");

async function buildRequest() {
  const body = enc.encode(bodyEl.value);
  const ts = String(nowSec() + Number(skewEl.value));
  let sig = "";
  if (signEl.value === "service") sig = await signature(secret, ts, body);
  else if (signEl.value === "other") sig = await signature(other, ts, body);
  else if (signEl.value === "edited") sig = await signature(secret, ts, enc.encode(bodyEl.value ? bodyEl.value.slice(0, -1) : " "));
  return { body, ts, sig };
}

let previewSeq = 0;
async function preview() {
  const seq = ++previewSeq;
  const { body, ts, sig } = await buildRequest();
  if (seq !== previewSeq) return;
  $("wh-ts").textContent = ts;
  $("wh-sig").textContent = sig || "(header missing)";
  $("wh-len").textContent = body.length.toLocaleString("en-US");
  $("wh-len").parentElement.classList.toggle("over", body.length > MAX_BODY);
}

function setPreset(name) {
  presetName = name;
  const p = PRESETS[name];
  bodyEl.value = p.body;
  skewEl.value = p.skew || "0";
  signEl.value = p.sign || "service";
  for (const b of document.querySelectorAll("[data-preset]")) b.setAttribute("aria-pressed", String(b.dataset.preset === name));
  preview();
}

function label() {
  const p = PRESETS[presetName];
  return p && bodyEl.value === p.body && skewEl.value === (p.skew || "0") && signEl.value === (p.sign || "service") ? p.label : "Edited delivery";
}

async function deliver(body, ts, sig) {
  const trace = [];
  try {
    const r = await receive(store, body, ts, sig, secret, nowSec(), trace);
    return { status: 200, json: r, code: r.result, trace };
  } catch (e) {
    if (!(e instanceof ReceiptError)) throw e;
    return { status: e.status, json: { error: e.code }, code: e.code, trace };
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
let running = false;
async function showTrace(trace) {
  const cells = STAGES.map(s => document.querySelector(`.stage[data-stage="${s}"]`));
  for (const c of cells) { c.dataset.state = "idle"; c.querySelector("small").textContent = "not reached"; }
  for (const t of trace) {
    const c = cells[STAGES.indexOf(t.id)];
    c.dataset.state = t.ok ? "pass" : "stop";
    c.querySelector("small").textContent = t.note;
    if (!reduce.matches) await sleep(90);
  }
}

function showResponse(res, title) {
  const kind = res.status === 200 ? (res.code === "recorded" ? "ok" : "dup") : "bad";
  const out = $("wh-response");
  out.dataset.kind = kind;
  $("wh-status").textContent = res.status;
  $("wh-json").textContent = JSON.stringify(res.json);
  $("wh-meaning").textContent = MEANING[res.code] || "";
  $("wh-for").textContent = title;
}

function renderState(top = true) {
  const s = state(store);
  $("wh-count").textContent = s.event_count;
  $("wh-boot").textContent = boots;
  const ev = $("wh-events");
  ev.replaceChildren(...(s.events.length ? s.events.map(e => row([e.event_id, e.shipment, e.status, iso(e.event_at)])) : [empty("Nothing saved yet. Send the first delivery.", 4)]));
  const sh = $("wh-ships");
  sh.replaceChildren(...(s.shipments.length ? s.shipments.map(x => row([x.shipment, x.status, iso(x.latest_event_at), x.latest_event_id])) : [empty("No shipment status yet.", 4)]));
  $("wh-more").hidden = s.event_count <= 30;
  $("wh-more").textContent = `Showing the latest 30 of ${s.event_count} saved updates, as the service's /state does.`;
  if (top) paintNow();
}
const iso = t => new Date(t * 1000).toISOString().replace(".000Z", "Z");
function row(cells) { const tr = document.createElement("tr"); for (const c of cells) { const td = document.createElement("td"); td.textContent = c; tr.append(td); } return tr; }
function empty(text, n) { const tr = document.createElement("tr"); const td = document.createElement("td"); td.colSpan = n; td.className = "empty"; td.textContent = text; tr.append(td); return tr; }

function log(entry) {
  journal.unshift(entry);
  if (journal.length > 60) journal.pop();
  const ol = $("wh-journal");
  ol.replaceChildren(...journal.map(e => {
    const li = document.createElement("li");
    li.dataset.kind = e.kind;
    const t = document.createElement("time"); t.textContent = e.time;
    const s = document.createElement("b"); s.textContent = e.status;
    const c = document.createElement("code"); c.textContent = e.code;
    const l = document.createElement("span"); l.textContent = e.label;
    li.append(t, s, c, l);
    return li;
  }));
  $("wh-journal-empty").hidden = journal.length > 0;
}
// Capture next to the form: one frame per delivery on the Sender, Receiver and SQLite lifelines.
let frames = 0;
const STAGE_NAME = { size: "size", clock: "clock", hmac: "signature", schema: "schema", store: "store" };
function msg(cls, text, i) {
  const d = document.createElement("div");
  d.className = "msg " + cls;
  d.style.setProperty("--d", (i * 0.14).toFixed(2) + "s");
  const lb = document.createElement("span"); lb.className = "lb"; lb.textContent = text;
  const ln = document.createElement("span"); ln.className = "ln";
  d.append(lb, ln);
  return d;
}
function noteRow(text, i, stop) {
  const d = document.createElement("div");
  d.className = "msg";
  d.style.setProperty("--d", (i * 0.14).toFixed(2) + "s");
  if (stop) { const x = document.createElement("span"); x.className = "stopmark"; x.setAttribute("aria-hidden", "true"); d.append(x); }
  const n = document.createElement("span"); n.className = stop ? "note" : "note sys"; n.textContent = text;
  d.append(n);
  return d;
}
const replyKind = res => res.status === 200 ? (res.code === "recorded" ? "c-ok" : "c-dup") : "c-bad";
function frame(rows) {
  const host = $("wh-seq-body");
  $("wh-seq-empty").hidden = true;
  const f = document.createElement("div");
  f.className = "frame";
  const tag = document.createElement("span"); tag.className = "frame-tag"; tag.textContent = "#" + (++frames) + " " + clock();
  f.append(tag, ...rows);
  host.append(f);
  while (host.querySelectorAll(".frame").length > 40) host.querySelector(".frame").remove();
  const box = $("wh-seq");
  box.scrollTo({ top: box.scrollHeight, behavior: reduce.matches ? "auto" : "smooth" });
}
const idOf = text => { try { return JSON.parse(text).event_id || ""; } catch { return ""; } };
function capture(res, title, copies, bodyText) {
  const id = idOf(bodyText);
  const rows = [msg("sr c-req", (copies > 1 ? copies + "x " : "") + "POST " + (id || title), 0)];
  const last = res.trace[res.trace.length - 1];
  if (res.status !== 200 && last && last.id !== "store") {
    rows.push(noteRow("stopped at " + STAGE_NAME[last.id], 1, true));
  } else {
    const dbNote = res.code === "recorded" ? "new ID, insert, commit" : res.code === "duplicate" ? "same content already saved" : res.code === "event_id_conflict" ? "content differs, rollback" : "lookup";
    rows.push(msg("rd c-db", "BEGIN IMMEDIATE, lookup", 1));
    rows.push(msg("rd back c-db", dbNote, 2));
  }
  rows.push(msg("sr back " + replyKind(res), copies > 1 ? title : res.status + " " + res.code, rows.length));
  frame(rows);
}

const clock = () => new Date().toTimeString().slice(0, 8);
const kindOf = res => res.status === 200 ? (res.code === "recorded" ? "ok" : "dup") : res.status === 0 ? "sys" : "bad";

async function send() {
  if (running) return; running = true;
  try {
    const title = label();
    const { body, ts, sig } = await buildRequest();
    const res = await deliver(body, ts, sig);
    sent++;
    showResponse(res, title);
    capture(res, title, 1, bodyEl.value);
    opFromForm([res], title, bodyEl.value);
    renderState();
    log({ time: clock(), status: res.status, code: res.code, label: title, kind: kindOf(res) });
    await showTrace(res.trace);
  } finally { running = false; preview(); }
}

const tally = all => { const count = {}; for (const r of all) count[r.code] = (count[r.code] || 0) + 1; return count; };
async function burst() {
  if (running) return; running = true;
  try {
    const title = label();
    const { body, ts, sig } = await buildRequest();
    const all = await Promise.all(Array.from({ length: 24 }, () => deliver(body, ts, sig)));
    const count = tally(all);
    const summary = Object.entries(count).map(([k, v]) => `${v} ${k}`).join(", ");
    const first = all.find(r => r.code === "recorded") || all[0];
    sent += 24;
    showResponse(first, `24 copies at once: ${summary}`);
    capture(first, summary, 24, bodyEl.value);
    opFromForm(all, "24 copies of: " + title, bodyEl.value);
    $("wh-meaning").textContent = count.recorded === 1 ? "One copy was saved and 23 were answered as duplicates. The check and the save happen in one step, so no two copies can both find an empty table." : MEANING[first.code] || "";
    renderState();
    log({ time: clock(), status: first.status, code: summary, label: "24 copies of: " + title, kind: kindOf(first) });
    await showTrace(first.trace);
  } finally { running = false; preview(); }
}

function restart() {
  secret = newKey(); boots++;
  renderState();
  frame([noteRow("restart, saved updates kept, new key", 0, false)]);
  opNote("Service restarted. Saved updates kept, new signing key.");
  log({ time: clock(), status: "", code: "restart", label: "Service restarted. Saved updates kept, new signing key.", kind: "sys" });
  preview();
}
function wipe(fromTop) {
  store = createStore(); sent = 0;
  for (const c of document.querySelectorAll(".stage")) { c.dataset.state = "idle"; c.querySelector("small").textContent = "not reached"; }
  $("wh-response").dataset.kind = "none";
  $("wh-status").textContent = "...";
  $("wh-for").textContent = "Database wiped";
  $("wh-json").textContent = "Nothing is saved. The next delivery is a first delivery.";
  $("wh-meaning").textContent = "";
  frame([noteRow("database wiped", 0, false)]);
  if (!fromTop) opNote("Database wiped from the form.");
  log({ time: clock(), status: "", code: "wipe", label: "Database wiped.", kind: "sys" });
  renderState();
}

document.querySelector(".presets").addEventListener("click", e => { const b = e.target.closest("[data-preset]"); if (b) setPreset(b.dataset.preset); });
let t; bodyEl.addEventListener("input", () => { for (const b of document.querySelectorAll("[data-preset]")) b.setAttribute("aria-pressed", "false"); clearTimeout(t); t = setTimeout(preview, 120); });
skewEl.addEventListener("change", preview); signEl.addEventListener("change", preview);
bodyEl.addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
$("wh-send").addEventListener("click", send);
$("wh-burst").addEventListener("click", burst);
$("wh-restart").addEventListener("click", restart);
$("wh-wipe").addEventListener("click", () => wipe(false));
setInterval(() => { if (!running && document.visibilityState === "visible") preview(); }, 1000);

// ---------------------------------------------------------------------------------------------
// Opening: the sequence diagram. Every arrow comes from a real call to receive(), so the labels
// say what the receiver actually answered. The first three deliveries run once on load.
const opScroll = $("op-scroll"), opInner = $("op-inner");
const SHIP = "DEMO_2207";
const STEP = .34;                  // seconds between arrows
let opN = 0;                       // frames drawn in the diagram
let cur = null;                    // the update the sender last sent: { n, status, hour }
let lastNew = 7781;
const human = s => s.replace("_", " ");
const STOP_NAME = { size: "size", clock: "time", hmac: "signature", schema: "format", store: "store" };
const evOf = c => ({ event_id: "evt_" + c.n, shipment: SHIP, status: c.status, event_time: new Date(Date.UTC(2026, 9, 18) + c.hour * 3600e3).toISOString().replace(".000Z", "Z") });

async function opSend(event, copies = 1) {
  const body = enc.encode(JSON.stringify(event)), ts = String(nowSec());
  const sig = await signature(secret, ts, body);
  const all = await Promise.all(Array.from({ length: copies }, () => deliver(body, ts, sig)));
  sent += copies;
  return all;
}

// A snapshot of the database, painted when the arrow that changed it has been drawn.
let stamp = 0, painted = 0;
function snap() { const s = state(store); return { id: ++stamp, recv: sent, saved: s.event_count, events: s.events.slice(0, 5), more: Math.max(0, s.event_count - 5), ships: s.shipments.slice(0, 3) }; }
function paint(sn) {
  if (sn.id < painted) return;
  painted = sn.id;
  $("op-recv").textContent = sn.recv.toLocaleString("en-US");
  $("op-saved").textContent = sn.saved.toLocaleString("en-US");
  const ol = $("op-rows");
  ol.replaceChildren(...(sn.events.length ? sn.events.map(e => { const li = document.createElement("li"); const c = document.createElement("code"); c.textContent = e.event_id; const s = document.createElement("span"); s.textContent = human(e.status); li.append(c, s); return li; }) : [Object.assign(document.createElement("li"), { className: "none", textContent: "Nothing saved yet." })]));
  $("op-more").hidden = !sn.more;
  $("op-more").textContent = `and ${sn.more} more`;
  $("op-ship").textContent = sn.ships.length ? sn.ships.map(x => `${x.shipment}: ${human(x.status)}`).join(". ") : "No shipment status yet.";
}
function paintAt(sn, delay) { if (reduce.matches || delay <= 0) paint(sn); else setTimeout(() => paint(sn), delay * 1000); }
function paintNow() { if ($("op-recv")) paint(snap()); }

function arrow(kind, text, color, d) {
  const m = document.createElement("div");
  m.className = "m " + kind;
  m.style.setProperty("--c", `var(--${color})`);
  m.style.setProperty("--d", d.toFixed(2) + "s");
  const lb = document.createElement("span"); lb.className = "lb"; lb.textContent = text;
  const ln = document.createElement("span"); ln.className = "ln"; ln.setAttribute("aria-hidden", "true");
  m.append(lb, ln);
  if (kind === "lost") { const x = document.createElement("span"); x.className = "x"; x.setAttribute("aria-hidden", "true"); m.append(x); }
  return m;
}
function stopRow(text, d) {
  const m = document.createElement("div");
  m.className = "m stop"; m.style.setProperty("--d", d.toFixed(2) + "s");
  const x = document.createElement("span"); x.className = "x"; x.setAttribute("aria-hidden", "true");
  const lb = document.createElement("span"); lb.className = "lb"; lb.textContent = text;
  m.append(x, lb);
  return m;
}
function opFrame(title, rows, d) {
  const f = document.createElement("div");
  f.className = "of";
  const h = document.createElement("p"); h.className = "fh"; h.style.setProperty("--d", d.toFixed(2) + "s");
  const n = document.createElement("b"); n.textContent = ++opN;
  const s = document.createElement("span"); s.textContent = title;
  h.append(n, s);
  f.append(h, ...rows);
  opInner.append(f);
  while (opInner.querySelectorAll(".of").length > 30) opInner.querySelector(".of").remove();
  return f;
}
function follow() { opScroll.scrollTo({ top: opScroll.scrollHeight, behavior: reduce.matches ? "auto" : "smooth" }); }

// Rows for one delivery (or a burst of copies), from what the receiver answered.
function rowsFor(all, sendText, d, lost) {
  const rows = [arrow("sr", sendText, "text", d)];
  const r = all.find(x => x.code === "recorded") || all[0];
  const last = r.trace[r.trace.length - 1];
  if (all.length > 1) {
    const c = tally(all);
    const parts = [c.recorded && `${c.recorded} saved`, c.duplicate && `${c.duplicate} already there`, c.event_id_conflict && `${c.event_id_conflict} refused`].filter(Boolean).join(", ");
    rows.push(arrow("rd", parts || "nothing saved", "probe", d + STEP));
    const ok = all.filter(x => x.status === 200).length;
    rows.push(arrow("rs", ok === all.length ? `200 for all ${all.length}. ${c.recorded || 0} saved, ${c.duplicate || 0} duplicates` : `${ok} of ${all.length} answered 200`, ok === all.length ? "dup" : "bad", d + 2 * STEP));
    return rows;
  }
  if (r.status !== 200 && last && last.id !== "store") {
    rows.push(stopRow(`Stopped at the ${STOP_NAME[last.id]} check`, d + STEP));
    rows.push(arrow("rs", `${r.status} ${r.code}`, "bad", d + 2 * STEP));
    return rows;
  }
  const db = r.code === "recorded" ? "New ID, saved" : r.code === "duplicate" ? "Same as saved copy" : "Differs from saved copy";
  rows.push(arrow("rd", db, "probe", d + STEP));
  const reply = r.code === "recorded" ? "200 saved" : r.code === "duplicate" ? "200 duplicate, nothing saved" : r.code === "event_id_conflict" ? "409 refused, nothing saved" : `${r.status} ${r.code}`;
  if (lost) rows.push(arrow("lost", reply + ", reply lost", "ok", d + 2 * STEP));
  else rows.push(arrow("rs", reply, r.code === "recorded" ? "ok" : r.code === "duplicate" ? "dup" : "bad", d + 2 * STEP));
  return rows;
}

let busy = false;
async function story() {
  busy = true;
  try {
    opInner.querySelectorAll(".of").forEach(f => f.remove());
    opN = 0;
    cur = { n: 7781, status: "in_transit", hour: 9 };
    lastNew = 7781;
    const base = reduce.matches ? 0 : .15, gap = 3 * STEP + .25;
    const plan = [
      ["First delivery", ev => opSend(ev), "Update #7781: in transit", true],
      ["No reply, so the sender tries again", ev => opSend(ev), "#7781 again, same content", false],
      ["Same ID, different content", ev => opSend({ ...ev, status: "delivered" }), "#7781 again, now delivered", false],
    ];
    let d = base;
    for (const [title, go, text, lost] of plan) {
      const sn0 = snap();
      const all = await go(evOf(cur));
      const sn = snap();
      opFrame(title, rowsFor(all, text, d, lost), d);
      paintAt({ ...sn0, recv: sn.recv, id: sn0.id }, d + .2);
      paintAt(sn, d + STEP + .25);
      d += reduce.matches ? 0 : gap;
    }
    paintAt(snap(), d);
    renderState(false);
  } finally { busy = false; }
}

async function act(kind) {
  if (busy || running) return; busy = true;
  try {
    let all, title, text;
    if (kind === "again") { all = await opSend(evOf(cur)); title = "Same update again"; text = `#${cur.n} again, same content`; }
    else if (kind === "changed") {
      const status = cur.status === "delivered" ? "in_transit" : "delivered";
      all = await opSend({ ...evOf(cur), status }); title = "Same ID, changed status"; text = `#${cur.n} again, now ${human(status)}`;
    } else {
      const status = cur.status === "in_transit" ? "delivered" : "in_transit";
      cur = { n: ++lastNew, status, hour: cur.hour + 1 };
      if (kind === "new") { all = await opSend(evOf(cur)); title = "A new update"; text = `Update #${cur.n}: ${human(status)}`; }
      else { all = await opSend(evOf(cur), 24); title = "A new update, 24 copies at the same moment"; text = `24 copies of update #${cur.n}`; }
    }
    const sn = snap();
    opFrame(title, rowsFor(all, text, 0, false), 0);
    follow();
    paintAt(sn, STEP + .2);
    renderState(false);
  } finally { busy = false; }
}

function opNote(text) {
  const f = document.createElement("div"); f.className = "of note";
  const p = document.createElement("p"); p.className = "fh"; p.textContent = text;
  f.append(p); opInner.append(f); follow();
}
function opFromForm(all, title, bodyText) {
  const id = idOf(bodyText);
  const text = (all.length > 1 ? `${all.length} copies of ` : "") + (id ? `update ${id}` : "an edited body");
  opFrame("From the form: " + title, rowsFor(all, text, 0, false), 0);
  follow();
}

$("op-try").addEventListener("click", e => {
  const b = e.target.closest("[data-op]"); if (!b) return;
  if (b.dataset.op === "reset") { if (busy || running) return; wipe(true); story(); return; }
  act(b.dataset.op);
});

setPreset("first");
renderState();
story().then(() => { document.documentElement.dataset.bench = "ready"; });
