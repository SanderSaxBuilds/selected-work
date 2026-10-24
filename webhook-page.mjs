import { createStore, receive, state, signature, ReceiptError, MAX_BODY } from "./webhook-bench.mjs";

const $ = id => document.getElementById(id);
const enc = new TextEncoder();
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const FIXTURE = { event_id: "evt_demo_001", shipment: "DEMO_1042", status: "in_transit", event_time: "2026-10-18T00:00:00Z" };
const j = o => JSON.stringify(o);
const PRESETS = {
  first: { label: "First delivery", body: j(FIXTURE) },
  retry: { label: "Identical retry", body: j(FIXTURE) },
  reordered: { label: "Retry, keys reordered", body: JSON.stringify({ status: "in_transit", event_time: "2026-10-18T00:00:00Z", shipment: "DEMO_1042", event_id: "evt_demo_001" }, null, 2) },
  conflict: { label: "Same ID, changed status", body: j({ ...FIXTURE, status: "delivered" }) },
  older: { label: "Older, distinct event", body: j({ event_id: "evt_demo_older", shipment: "DEMO_1042", status: "created", event_time: "2026-10-17T23:00:00Z" }) },
  newer: { label: "Newer event, delivered", body: j({ event_id: "evt_demo_002", shipment: "DEMO_1042", status: "delivered", event_time: "2026-10-18T02:00:00Z" }) },
  badsig: { label: "Signed with another key", body: j(FIXTURE), sign: "other" },
  stale: { label: "Sent 6 minutes ago", body: j(FIXTURE), skew: "-360" },
  dupkeys: { label: "Duplicate JSON key", body: j(FIXTURE).slice(0, -1) + ',"status":"created"}' },
  baddate: { label: "30 February", body: j({ ...FIXTURE, event_id: "evt_demo_003", event_time: "2026-02-30T00:00:00Z" }) },
};
const STAGES = ["size", "clock", "hmac", "schema", "store"];
const MEANING = {
  recorded: "Stored. The receipt and the shipment update were written together.",
  duplicate: "Already stored with the same content. Acknowledged, nothing written.",
  event_id_conflict: "This event ID is stored with different content. Refused, nothing written.",
  invalid_signature: "The signature does not match this body and timestamp. Refused before reading the body.",
  expired_signature: "The timestamp is more than 300 seconds from the receiver's clock. Refused.",
  invalid_timestamp: "The timestamp header is not a whole number of seconds. Refused.",
  invalid_event: "Signed correctly, but the body is not one valid event. Refused, nothing written.",
  body_too_large: "The body is over 65,536 bytes. Refused before anything else.",
};

let store = createStore();
let secret = newKey();
let boots = 1;
let presetName = "first";
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

function renderState() {
  const s = state(store);
  $("wh-count").textContent = s.event_count;
  $("wh-boot").textContent = boots;
  const ev = $("wh-events");
  ev.replaceChildren(...(s.events.length ? s.events.map(e => row([e.event_id, e.shipment, e.status, iso(e.event_at)])) : [empty("No receipts yet. Send the first delivery.", 4)]));
  const sh = $("wh-ships");
  sh.replaceChildren(...(s.shipments.length ? s.shipments.map(x => row([x.shipment, x.status, iso(x.latest_event_at), x.latest_event_id])) : [empty("No shipment state yet.", 4)]));
  $("wh-more").hidden = s.event_count <= 30;
  $("wh-more").textContent = `Showing the latest 30 of ${s.event_count} receipts, as the service's /state does.`;
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
const clock = () => new Date().toTimeString().slice(0, 8);
const kindOf = res => res.status === 200 ? (res.code === "recorded" ? "ok" : "dup") : res.status === 0 ? "sys" : "bad";

async function send() {
  if (running) return; running = true;
  try {
    const title = label();
    const { body, ts, sig } = await buildRequest();
    const res = await deliver(body, ts, sig);
    showResponse(res, title);
    renderState();
    log({ time: clock(), status: res.status, code: res.code, label: title, kind: kindOf(res) });
    await showTrace(res.trace);
  } finally { running = false; preview(); }
}

async function burst() {
  if (running) return; running = true;
  try {
    const title = label();
    const { body, ts, sig } = await buildRequest();
    const all = await Promise.all(Array.from({ length: 24 }, () => deliver(body, ts, sig)));
    const count = {};
    for (const r of all) count[r.code] = (count[r.code] || 0) + 1;
    const summary = Object.entries(count).map(([k, v]) => `${v} ${k}`).join(", ");
    const first = all.find(r => r.code === "recorded") || all[0];
    showResponse(first, `24 copies at once: ${summary}`);
    $("wh-meaning").textContent = count.recorded === 1 ? "One copy was stored and 23 were acknowledged as duplicates. The check and the insert happen in one step, so no two copies can both see an empty table." : MEANING[first.code] || "";
    renderState();
    log({ time: clock(), status: first.status, code: summary, label: "24 copies of: " + title, kind: kindOf(first) });
    await showTrace(first.trace);
  } finally { running = false; preview(); }
}

function restart() {
  secret = newKey(); boots++;
  renderState();
  log({ time: clock(), status: "", code: "restart", label: "Service restarted. Receipts kept, new signing key.", kind: "sys" });
  preview();
}
function wipe() {
  store = createStore();
  renderState();
  for (const c of document.querySelectorAll(".stage")) { c.dataset.state = "idle"; c.querySelector("small").textContent = "not reached"; }
  $("wh-response").dataset.kind = "none";
  $("wh-status").textContent = "...";
  $("wh-for").textContent = "Database wiped";
  $("wh-json").textContent = "No receipts are stored. The next delivery is a first delivery.";
  $("wh-meaning").textContent = "";
  log({ time: clock(), status: "", code: "wipe", label: "Database wiped.", kind: "sys" });
}

document.querySelector(".presets").addEventListener("click", e => { const b = e.target.closest("[data-preset]"); if (b) setPreset(b.dataset.preset); });
let t; bodyEl.addEventListener("input", () => { for (const b of document.querySelectorAll("[data-preset]")) b.setAttribute("aria-pressed", "false"); clearTimeout(t); t = setTimeout(preview, 120); });
skewEl.addEventListener("change", preview); signEl.addEventListener("change", preview);
bodyEl.addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
$("wh-send").addEventListener("click", send);
$("wh-burst").addEventListener("click", burst);
$("wh-restart").addEventListener("click", restart);
$("wh-wipe").addEventListener("click", wipe);
setInterval(() => { if (!running && document.visibilityState === "visible") preview(); }, 1000);
setPreset("first");
renderState();
document.documentElement.dataset.bench = "ready";
