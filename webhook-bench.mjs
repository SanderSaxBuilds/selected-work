// Browser model of receipt_store.py (webhook receipt study). Same checks, same order,
// same status codes and error codes. SQLite is replaced by an in-memory store, which
// survives a simulated restart and is cleared only by wiping it.
export const MAX_BODY = 65536;
const IDENTIFIER = /^[A-Za-z0-9_-]{1,64}$/;
const STATUSES = new Set(["created", "in_transit", "delivered"]);
const enc = new TextEncoder();
const subtle = globalThis.crypto.subtle;

export class ReceiptError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const concat = (a, b) => { const o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; };

export async function signature(secret, timestamp, body) {
  const key = await subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await subtle.sign("HMAC", key, concat(enc.encode(String(timestamp) + "."), body)));
}

// Python's \d matches any Unicode decimal digit, and int() reads them. Digits come in runs of ten.
const ND = /^\p{Nd}$/u;
function digitValue(ch) {
  let cp = ch.codePointAt(0), k = 0;
  while (ND.test(String.fromCodePoint(cp - k - 1))) k++;
  return k % 10;
}
const num = s => [...s].reduce((n, c) => n * 10 + digitValue(c), 0);

const TIME = /^(\p{Nd}{4})-(\p{Nd}{2})-(\p{Nd}{2})T(\p{Nd}{2}):(\p{Nd}{2}):(\p{Nd}{2})Z$/u;
// datetime.strptime("%Y-%m-%dT%H:%M:%SZ"): its field patterns mix ASCII classes and \d.
function strptimeUTC(text) {
  const m = TIME.exec(text); if (!m) return null;
  const [, Y, mo, d, H, Mi, S] = m.map(x => x && [...x]);
  if (!/^(1[0-2]|0[1-9])$/.test(mo.join(""))) return null;
  if (!(d[0] === "3" && /[01]/.test(d[1]) || /[12]/.test(d[0]) || d[0] === "0" && /[1-9]/.test(d[1]))) return null;
  if (!(H[0] === "2" && /[0-3]/.test(H[1]) || /[01]/.test(H[0]))) return null;
  if (!/[0-5]/.test(Mi[0]) || !(/[0-5]/.test(S[0]) || S[0] === "6" && /[01]/.test(S[1]))) return null;
  const year = num(Y.join("")), month = num(mo.join("")), day = num(d.join("")), hour = num(H.join("")), minute = num(Mi.join("")), second = num(S.join(""));
  if (year < 1 || second > 59) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day > dim) return null;
  const t = new Date(0); t.setUTCFullYear(year, month - 1, day); t.setUTCHours(hour, minute, second, 0);
  return Math.floor(t.getTime() / 1000);
}

// Pairs at the top level of a JSON object, counted from the source text. JSON.parse keeps the
// last of two equal keys, Python's object_pairs_hook refuses them, so a lower key count means a duplicate.
function topLevelPairs(text) {
  let depth = 0, inStr = false, pairs = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (c === "\\") i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
    else if (c === ":" && depth === 1) pairs++;
  }
  return pairs;
}

const sha256hex = async bytes => hex(await subtle.digest("SHA-256", bytes));
const jsonStr = s => JSON.stringify(s); // the four values are ASCII-safe strings without control characters

export async function decodeEvent(body) {
  if (body.length > MAX_BODY) throw new ReceiptError(413, "body_too_large");
  const bad = () => new ReceiptError(422, "invalid_event");
  let text, event;
  try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(body); } catch { throw bad(); }
  try { event = JSON.parse(text); } catch { throw bad(); }
  const keys = ["event_id", "event_time", "shipment", "status"];
  if (!event || typeof event !== "object" || Array.isArray(event)) throw bad();
  const own = Object.keys(event);
  if (own.length !== 4 || !keys.every(k => Object.prototype.hasOwnProperty.call(event, k))) throw bad();
  if (!keys.every(k => typeof event[k] === "string")) throw bad();
  if (topLevelPairs(text) !== own.length) throw bad();
  for (const k of ["event_id", "shipment"]) if (!IDENTIFIER.test(event[k])) throw bad();
  if (!STATUSES.has(event.status)) throw bad();
  const eventAt = strptimeUTC(event.event_time);
  if (eventAt === null) throw bad();
  const canonical = "{" + keys.map(k => jsonStr(k) + ":" + jsonStr(event[k])).join(",") + "}";
  return { event: { event_id: event.event_id, shipment: event.shipment, status: event.status, event_time: event.event_time }, eventAt, digest: await sha256hex(enc.encode(canonical)) };
}

export function createStore() { return { events: [], byId: new Map(), shipments: new Map() }; }

// Each stage reports what it checked, so the page can show where a delivery stopped.
export async function receive(store, body, timestampHeader, suppliedSignature, secret, now, trace = []) {
  const step = (id, ok, note) => trace.push({ id, ok, note });
  const fail = (id, status, code) => { step(id, false, code); throw new ReceiptError(status, code); };
  if (body.length > MAX_BODY) fail("size", 413, "body_too_large");
  step("size", true, body.length + " bytes");
  if (typeof timestampHeader !== "string" || !/^\p{Nd}{1,12}$/u.test(timestampHeader)) fail("clock", 401, "invalid_timestamp");
  const timestamp = num(timestampHeader);
  if (Math.abs(now - timestamp) > 300) fail("clock", 401, "expired_signature");
  step("clock", true, (now - timestamp) + " s old");
  if (typeof suppliedSignature !== "string" || !/^[a-f0-9]{64}$/.test(suppliedSignature)) fail("hmac", 401, "invalid_signature");
  if (await signature(secret, timestampHeader, body) !== suppliedSignature) fail("hmac", 401, "invalid_signature");
  step("hmac", true, "matches");
  let decoded;
  try { decoded = await decodeEvent(body); } catch (e) { step("schema", false, e.code); throw e; }
  const { event, eventAt, digest } = decoded;
  step("schema", true, "4 fields");
  const previous = store.byId.get(event.event_id);
  if (previous) {
    if (previous.digest !== digest) fail("store", 409, "event_id_conflict");
    step("store", true, "already stored");
    return { result: "duplicate", event_id: event.event_id, projection_changed: false };
  }
  const row = { event_id: event.event_id, digest, shipment: event.shipment, status: event.status, event_at: eventAt, accepted_at: now };
  store.events.push(row); store.byId.set(event.event_id, row);
  const current = store.shipments.get(event.shipment);
  const changed = current === undefined || eventAt > current.latest_event_at;
  if (changed) store.shipments.set(event.shipment, { shipment: event.shipment, status: event.status, latest_event_at: eventAt, latest_event_id: event.event_id });
  step("store", true, "new row");
  return { result: "recorded", event_id: event.event_id, projection_changed: changed };
}

export function state(store) {
  const events = store.events.slice(-30).reverse().map(({ event_id, shipment, status, event_at }) => ({ event_id, shipment, status, event_at }));
  const shipments = [...store.shipments.values()].sort((a, b) => a.shipment < b.shipment ? -1 : a.shipment > b.shipment ? 1 : 0).slice(0, 30).map(s => ({ ...s }));
  return { event_count: store.events.length, events, shipments };
}
