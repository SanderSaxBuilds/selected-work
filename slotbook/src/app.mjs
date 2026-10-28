// Slotbook page controller. Rendering and events only; the rules live in core.mjs.
import * as C from './core.mjs';
import { BUSINESS, SERVICES, ZONES, WEEKLY, makeConfig, seedBookings } from './data.mjs';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// A fixed clock through ?now=ISO lets the checks and the cover run on known dates.
const fixedNow = Date.parse(new URLSearchParams(location.search).get('now') || '');
const clock = () => (Number.isFinite(fixedNow) ? fixedNow : Date.now());

const KEY = 'slotbook.v1';
const store = {
  read() { try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } },
  write(data) { try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; } },
  clear() { try { localStorage.removeItem(KEY); } catch {} }
};

const config = makeConfig(clock());
const BIZ = config.zone;
const STEP = config.stepMin * 60000;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// Each service has its own colour, the way a calendar app colours event types.
const TONE = { puncture: '#2b78c5', tuneup: '#14866d', fit: '#7a55c9', overhaul: '#b8406f' };
const tone = id => TONE[id] || '#4b5059';

const deviceZone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return null; } })();
const zones = [...ZONES];
if (deviceZone && C.isValidZone(deviceZone) && !zones.some(z => z.id === deviceZone)) zones.push({ id: deviceZone, label: 'Your device, ' + deviceZone.split('/').pop().replace(/_/g, ' ') });
const zoneLabel = id => (zones.find(z => z.id === id)?.label || id).replace(', workshop time', '');

const saved = store.read();
const state = {
  serviceId: 'tuneup',
  zone: saved && zones.some(z => z.id === saved.zone) ? saved.zone : BIZ,
  bookings: saved ? C.sanitizeBookings(saved.bookings) : seedBookings(config, clock()),
  month: null,
  focus: null,
  date: null,
  slot: null,
  staffDate: null,
  agendaDate: null,
  submitted: false,
  lastBooking: null
};
const persist = () => store.write({ bookings: state.bookings, zone: state.zone });
if (!saved) persist();

const service = () => SERVICES.find(s => s.id === state.serviceId);
const serviceOf = b => SERVICES.find(s => s.id === b.serviceId);
const ym = iso => { const { y, m } = C.parseDate(iso); return { y, m }; };
const sameMonth = (a, b) => a.y === b.y && a.m === b.m;
const monthKey = ({ y, m }) => y * 12 + m;
const announce = msg => { const l = $('live'); l.textContent = ''; setTimeout(() => { l.textContent = msg; }, 30); };
const minutesText = n => n < 60 ? `${n} min` : n % 60 ? `${Math.floor(n / 60)} h ${n % 60} min` : `${n / 60} h`;

function derive() {
  const now = clock();
  const slots = C.generateSlots({ config, service: service(), bookings: state.bookings, now });
  const byDate = C.groupByDate(slots, state.zone);
  const todayBiz = C.dateInZone(now, BIZ);
  const endBiz = C.addDays(todayBiz, config.maxDaysAhead);
  const rangeStart = C.dateInZone(now, state.zone);
  const rangeEnd = C.dateInZone(C.zonedToUtc(C.addDays(endBiz, 1), 0, BIZ) - 1, state.zone);
  return { now, slots, byDate, rangeStart, rangeEnd };
}
let D = derive();

// ---------- toast ----------

let toastTimer = 0;
function toast(msg, action) {
  const t = $('toast');
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button" class="toast-act">${esc(action.label)}</button>` : ''}`;
  t.hidden = false;
  t.classList.remove('in'); void t.offsetWidth; t.classList.add('in');
  if (action) t.querySelector('.toast-act').addEventListener('click', () => { action.fn(); hideToast(); });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? 8000 : 4500);
}
function hideToast() { const t = $('toast'); t.classList.remove('in'); t.hidden = true; }

// ---------- services and hours ----------

function renderServices() {
  $('services').innerHTML = SERVICES.map(s => `
    <label class="svc" style="--tone:${tone(s.id)};--len:${s.duration / config.stepMin}">
      <input type="radio" name="service" value="${s.id}" ${s.id === state.serviceId ? 'checked' : ''}>
      <span class="svc-block" aria-hidden="true"></span>
      <span class="svc-text"><span class="svc-name">${esc(s.name)}</span><span class="svc-blurb">${esc(s.blurb)}</span></span>
      <span class="svc-meta"><span>${minutesText(s.duration)}</span><span>${s.price.toLocaleString('en-GB')} baht</span></span>
    </label>`).join('');
}

const windowsText = list => list.length ? list.map(([a, b]) => `<span class="nw">${C.fromMinutes(a)} to ${C.fromMinutes(b)}</span>`).join(', ') : 'Closed';

function renderHours() {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const rows = [];
  for (const wd of order) {
    const text = windowsText(C.mergeIntervals((WEEKLY[wd] || []).map(([a, b]) => [C.toMinutes(a), C.toMinutes(b)])));
    const last = rows[rows.length - 1];
    if (last && last.text === text) last.to = wd; else rows.push({ from: wd, to: wd, text });
  }
  $('weekly').innerHTML = rows.map(r => `<div><dt>${DAY_NAMES[r.from]}${r.to !== r.from ? ' to ' + DAY_NAMES[r.to] : ''}</dt><dd>${r.text}</dd></div>`).join('');
  const changes = Object.entries(config.overrides).sort(([a], [b]) => a.localeCompare(b));
  $('changes').innerHTML = changes.map(([d, o]) => `<li><span class="mono">${C.formatDateShort(d)}</span> ${esc(o.note)}</li>`).join('');
}

// ---------- zone ----------

function renderZones() {
  $('zone').innerHTML = zones.map(z => `<option value="${z.id}" ${z.id === state.zone ? 'selected' : ''}>${esc(z.label)}</option>`).join('');
  const note = $('zone-note');
  if (state.zone === BIZ) { note.hidden = true; return; }
  const offNow = C.offsetLabel(D.now, state.zone);
  const parts = [`Times show in ${zoneLabel(state.zone)} time, ${offNow} today. The workshop is on UTC+7 all year.`];
  for (const ch of C.offsetChanges(D.rangeStart, D.rangeEnd, state.zone)) {
    const hours = Math.abs(ch.after - ch.before) / 60;
    const amount = hours === 1 ? 'one hour' : hours + ' hours';
    parts.push(ch.after < ch.before
      ? `Clocks in ${zoneLabel(state.zone)} go back on ${C.formatDateLong(ch.date)}, so from that day the same workshop time shows ${amount} earlier for you.`
      : `Clocks in ${zoneLabel(state.zone)} go forward on ${C.formatDateLong(ch.date)}, so from that day the same workshop time shows ${amount} later for you.`);
  }
  note.textContent = parts.join(' ');
  note.hidden = false;
}

// ---------- calendar ----------

function dayLabel(iso, count, inRange) {
  let text = C.formatDateLong(iso);
  if (!inRange) return text + ', outside the booking window';
  const o = state.zone === BIZ ? config.overrides[iso] : null;
  if (o?.closed) return `${text}, ${o.note.toLowerCase()}`;
  text += count ? `, ${count} open time${count === 1 ? '' : 's'}` : ', no open times';
  if (o?.note) text += `, ${o.note.toLowerCase()}`;
  return text;
}

function renderCalendar() {
  const { y, m } = state.month;
  $('cal-title').textContent = C.formatMonth(y, m);
  $('cal-prev').disabled = monthKey(state.month) <= monthKey(ym(D.rangeStart));
  $('cal-next').disabled = monthKey(state.month) >= monthKey(ym(D.rangeEnd));
  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const full = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  $('cal-dow').innerHTML = dow.map((d, i) => `<th scope="col" abbr="${full[i]}"><span aria-hidden="true">${d.slice(0, 2)}</span><span class="sr">${full[i]}</span></th>`).join('');
  const max = Math.max(1, ...[...D.byDate.values()].map(l => l.length));
  $('cal-body').innerHTML = C.monthGrid(y, m).map(week => `<tr>${week.map(iso => {
    if (!iso) return '<td role="gridcell" class="blank"></td>';
    const inRange = iso >= D.rangeStart && iso <= D.rangeEnd;
    const count = inRange ? (D.byDate.get(iso)?.length || 0) : 0;
    const o = state.zone === BIZ ? config.overrides[iso] : null;
    const cls = ['day', count ? 'open' : 'none', iso === D.rangeStart ? 'today' : '', o ? 'override' : ''].filter(Boolean).join(' ');
    // The bar under the date fills with how much of the day is still free.
    const fill = count ? Math.max(0.18, count / max) : 0;
    return `<td role="gridcell" class="${cls}" data-date="${iso}" tabindex="${iso === state.focus ? 0 : -1}" aria-selected="${iso === state.date}"${count ? '' : ' aria-disabled="true"'}${iso === D.rangeStart ? ' aria-current="date"' : ''} aria-label="${esc(dayLabel(iso, count, inRange))}"><span class="dnum" aria-hidden="true">${+iso.slice(8)}</span>${count ? `<span class="dcount" aria-hidden="true">${count}</span><span class="dbar" aria-hidden="true" style="--f:${fill.toFixed(2)}"></span>` : ''}</td>`;
  }).join('')}</tr>`).join('');
}

function setFocus(iso, moveFocus) {
  state.focus = iso;
  const target = ym(iso);
  if (!sameMonth(target, state.month)) { state.month = target; renderCalendar(); }
  else document.querySelectorAll('#cal-body td[data-date]').forEach(td => { td.tabIndex = td.dataset.date === iso ? 0 : -1; });
  if (moveFocus) document.querySelector(`#cal-body td[data-date="${iso}"]`)?.focus();
}

function firstOpenIn(month) {
  const dates = [...D.byDate.keys()].filter(d => sameMonth(ym(d), month)).sort();
  if (dates.length) return dates[0];
  const first = C.isoDate(month.y, month.m, 1);
  return first < D.rangeStart ? D.rangeStart : first > D.rangeEnd ? D.rangeEnd : first;
}

function shiftMonth(n) {
  const next = ym(C.addMonths(C.isoDate(state.month.y, state.month.m, 1), n));
  if (monthKey(next) < monthKey(ym(D.rangeStart)) || monthKey(next) > monthKey(ym(D.rangeEnd))) return;
  state.month = next;
  state.focus = firstOpenIn(next);
  renderCalendar();
}

function pickDate(iso) {
  if (iso < D.rangeStart || iso > D.rangeEnd) return;
  state.date = iso;
  state.focus = iso;
  if (state.slot !== null && C.dateInZone(state.slot, state.zone) !== iso) clearSlot();
  if (!sameMonth(ym(iso), state.month)) { state.month = ym(iso); renderCalendar(); }
  document.querySelectorAll('#cal-body td[data-date]').forEach(td => td.setAttribute('aria-selected', String(td.dataset.date === iso)));
  renderSlots();
  renderTicket();
  const n = D.byDate.get(iso)?.length || 0;
  announce(n ? `${n} open time${n === 1 ? '' : 's'} on ${C.formatDateLong(iso)}.` : `No open times on ${C.formatDateLong(iso)}.`);
}

const openDates = () => [...D.byDate.keys()].sort();
function stepDay(dir) {
  const list = openDates();
  const cur = state.date || D.rangeStart;
  const next = dir > 0 ? list.find(d => d > cur) : [...list].reverse().find(d => d < cur);
  if (!next) return;
  setFocus(next, false);
  pickDate(next);
}

// ---------- day timeline ----------

// Workshop opening windows that fall on a calendar date of the display zone.
function dayWindows(date, zone) {
  const start = C.zonedToUtc(date, 0, zone) ?? C.zonedToUtc(date, 60, zone) - 3600000;
  const nextDay = C.addDays(date, 1);
  const end = C.zonedToUtc(nextDay, 0, zone) ?? C.zonedToUtc(nextDay, 60, zone) - 3600000;
  const out = [];
  for (let i = -1; i <= 1; i++) {
    const d = C.addDays(date, i);
    for (const [a, b] of C.hoursForDate(config, d)) {
      const s = Math.max(start, C.zonedToUtc(d, a, BIZ));
      const e = Math.min(end, C.zonedToUtc(d, b, BIZ));
      if (e > s) out.push({ s, e });
    }
  }
  return out.sort((x, y) => x.s - y.s);
}

let TL = null; // the timeline on screen: { axisStart, rows, starts:Set }

function renderTicket() {
  const s = service();
  const steps = [
    { k: 'Service', v: `${s.name}`, sub: `${minutesText(s.duration)}, ${s.price.toLocaleString('en-GB')} baht`, done: true },
    { k: 'Day', v: state.date ? C.formatDateLong(state.date) : 'Pick a day', done: !!state.date },
    { k: 'Time', v: state.slot !== null ? `${C.formatTime(state.slot, state.zone)} to ${C.formatTime(state.slot + s.duration * 60000, state.zone)}` : 'Pick a time', sub: state.slot !== null && state.zone !== BIZ ? `${C.formatTime(state.slot, BIZ)} workshop time` : '', done: state.slot !== null }
  ];
  $('ticket-steps').innerHTML = steps.map(x => `<li class="${x.done ? 'is-done' : ''}" style="--tone:${tone(s.id)}"><span class="tk">${x.k}</span><span class="tv">${esc(x.v)}</span>${x.sub ? `<span class="ts">${esc(x.sub)}</span>` : ''}</li>`).join('');
  $('ticket').style.setProperty('--tone', tone(s.id));
}

function renderSlots() {
  const box = $('slots');
  const head = $('times-for');
  const list = openDates();
  const cur = state.date || D.rangeStart;
  $('day-prev').disabled = !list.some(d => d < cur);
  $('day-next').disabled = !list.some(d => d > cur);
  TL = null;
  if (!state.date) {
    head.textContent = 'Pick a day to see open times.';
    $('tl-help').hidden = true;
    const first = D.slots.reduce((a, s) => (a === null || s.start < a.start ? s : a), null);
    if (!first) { box.innerHTML = '<p class="none-msg">No open times in the booking window for this service.</p>'; return; }
    const day = C.dateInZone(first.start, state.zone);
    const n = D.byDate.get(day)?.length || 0;
    box.innerHTML = `<div class="soonest" style="--tone:${tone(state.serviceId)}"><p class="soonest-label">Soonest for ${esc(service().name.toLowerCase())}</p><p class="soonest-when"><strong>${C.formatDateLong(day)}</strong> <span class="mono">${C.formatTime(first.start, state.zone)}</span></p><p class="muted">${n} open time${n === 1 ? '' : 's'} that day.</p><button type="button" class="btn primary" id="soonest" data-date="${day}">Show that day</button></div>`;
    return;
  }
  const slots = D.byDate.get(state.date) || [];
  head.innerHTML = `<strong>${C.formatDateLong(state.date)}</strong> <span class="muted">${esc(service().name)}, ${minutesText(service().duration)}</span>`;
  const windows = dayWindows(state.date, state.zone);
  if (!slots.length) {
    $('tl-help').hidden = true;
    const next = list.filter(d => d > state.date)[0];
    const o = state.zone === BIZ ? config.overrides[state.date] : null;
    const why = !windows.length ? (o?.closed ? `The workshop is closed this day. ${esc(o.note)}.` : 'The workshop is closed this day.') : 'No open times on this day for this service.';
    box.innerHTML = `<p class="none-msg">${why}</p>${next ? `<button type="button" class="btn line" id="next-open" data-date="${next}">Go to ${C.formatDateLong(next)}</button>` : ''}`;
    return;
  }
  $('tl-help').hidden = false;
  const axisStart = windows[0].s;
  const axisEnd = Math.max(...windows.map(w => w.e));
  const rows = Math.round((axisEnd - axisStart) / STEP);
  const starts = new Set(slots.map(s => s.start));
  const other = state.zone !== BIZ;
  const offsets = new Set(slots.map(s => C.offsetMinutes(s.start, state.zone)));
  const showOffset = offsets.size > 1;
  const html = [];
  let gapLabelled = false;
  for (let i = 0; i < rows; i++) {
    const t = axisStart + i * STEP;
    const time = C.formatTime(t, state.zone);
    const hour = time.endsWith(':00') ? ' hour' : '';
    if (starts.has(t)) {
      gapLabelled = false;
      const shop = C.formatTime(t, BIZ);
      const shopDay = C.dateInZone(t, BIZ) !== state.date ? C.formatWeekday(C.dateInZone(t, BIZ)) + ' ' : '';
      const extra = other ? `<span class="shop">${shopDay}${shop} at the workshop</span>` : '';
      const off = showOffset ? `<span class="off">${C.offsetLabel(t, state.zone)}</span>` : '';
      const label = `${time}${showOffset ? ' ' + C.offsetLabel(t, state.zone) : ''}${other ? `, ${shopDay}${shop} at the workshop` : ''}`;
      html.push(`<button type="button" class="slot row${hour}${other ? ' two' : ''}" style="--i:${i}" data-start="${t}" data-i="${i}" aria-pressed="${t === state.slot}" aria-label="${esc(label)}"><span class="t">${time}${off}</span>${extra}<span class="go" aria-hidden="true">Start here</span></button>`);
    } else if (windows.some(w => t >= w.s && t < w.e)) {
      gapLabelled = false;
      html.push(`<div class="row off${hour}" style="--i:${i}" aria-hidden="true"><span class="t">${time}</span></div>`);
    } else {
      html.push(`<div class="row closed${hour}" style="--i:${i}" aria-hidden="true"><span class="t">${time}</span>${gapLabelled ? '' : '<span class="gap">Closed</span>'}</div>`);
      gapLabelled = true;
    }
  }
  const busy = C.activeBookings(state.bookings).filter(b => b.end > axisStart && b.start < axisEnd);
  const blocks = busy.map(b => `<div class="blk busy" style="--k:${((b.start - axisStart) / STEP).toFixed(3)};--n:${((b.end - b.start) / STEP).toFixed(3)}" aria-hidden="true"><span>Booked</span></div>`).join('');
  const n = service().duration * 60000 / STEP;
  box.innerHTML = `<div class="tl" id="tl" style="--rows:${rows};--tone:${tone(state.serviceId)};--n:${n}">${html.join('')}<div class="layer" aria-hidden="true">${blocks}<div class="blk ghost" id="ghost" hidden></div><div class="blk mine" id="mine" hidden><b></b><span></span></div></div></div>`;
  TL = { axisStart, rows, starts };
  placeMine();
}

function placeMine() {
  const mine = $('mine');
  if (!mine || !TL) return;
  if (state.slot === null || !TL.starts.has(state.slot)) { mine.hidden = true; return; }
  const s = service();
  mine.hidden = false;
  mine.style.setProperty('--k', (state.slot - TL.axisStart) / STEP);
  mine.querySelector('b').textContent = `${C.formatTime(state.slot, state.zone)} to ${C.formatTime(state.slot + s.duration * 60000, state.zone)}`;
  mine.querySelector('span').textContent = s.name;
}

function showGhost(i) {
  const g = $('ghost');
  if (!g) return;
  if (i === null) { g.hidden = true; return; }
  g.hidden = false;
  g.style.setProperty('--k', i);
}

function clearSlot() {
  state.slot = null;
  $('details').hidden = true;
  placeMine();
  renderTicket();
}

const inView = el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight - 120; };

function pickSlot(start, { scroll = true } = {}) {
  const fresh = state.slot === null;
  state.slot = start;
  document.querySelectorAll('#slots .slot').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.start === start)));
  placeMine();
  const mine = $('mine');
  if (mine && fresh && !reduceMotion()) { mine.classList.remove('drop'); void mine.offsetWidth; mine.classList.add('drop'); }
  renderSummary();
  renderTicket();
  $('details').hidden = false;
  if (!scroll) return;
  const h = $('h-details');
  h.focus({ preventScroll: true });
  if (!inView(h)) h.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
}

// Drag your own block up or down the day. It only settles on open start times.
function wireTimelineDrag() {
  const box = $('slots');
  let drag = null;
  box.addEventListener('pointerdown', e => {
    const mine = e.target.closest('#mine');
    if (!mine || !TL) return;
    e.preventDefault();
    const tl = $('tl');
    const rh = tl.getBoundingClientRect().height / TL.rows;
    drag = { y0: e.clientY, k0: (state.slot - TL.axisStart) / STEP, rh, k: null, id: e.pointerId };
    mine.setPointerCapture(e.pointerId);
    mine.classList.add('lift');
  });
  box.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const k = Math.round(drag.k0 + (e.clientY - drag.y0) / drag.rh);
    const t = TL.axisStart + k * STEP;
    if (k === drag.k) return;
    drag.k = k;
    const mine = $('mine');
    const ok = TL.starts.has(t);
    mine.style.setProperty('--k', Math.max(0, Math.min(TL.rows - 1, k)));
    mine.classList.toggle('bad', !ok);
    if (ok) mine.querySelector('b').textContent = `${C.formatTime(t, state.zone)} to ${C.formatTime(t + service().duration * 60000, state.zone)}`;
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const mine = $('mine');
    mine.classList.remove('lift', 'bad');
    const t = drag.k === null ? null : TL.axisStart + drag.k * STEP;
    drag = null;
    if (t !== null && TL.starts.has(t) && t !== state.slot) { pickSlot(t, { scroll: false }); announce(`Moved to ${C.formatTime(t, state.zone)}.`); }
    else { placeMine(); if (t !== null && t !== state.slot) announce('That time is not free. Your slot stayed where it was.'); }
  };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);
}

function whenText(start, end) {
  const date = C.dateInZone(start, state.zone);
  let text = `${C.formatDateLong(date)}, ${C.formatTime(start, state.zone)} to ${C.formatTime(end, state.zone)}`;
  if (state.zone !== BIZ) text += ` ${zoneLabel(state.zone)} time, ${C.offsetLabel(start, state.zone)}`;
  return text;
}
const shopText = (start, end) => `${C.formatDateLong(C.dateInZone(start, BIZ))}, ${C.formatTime(start, BIZ)} to ${C.formatTime(end, BIZ)} workshop time`;

function renderSummary() {
  const s = service();
  const end = state.slot + s.duration * 60000;
  $('summary').innerHTML = `<dl>
    <div><dt>Service</dt><dd>${esc(s.name)}, ${s.duration} min, ${s.price.toLocaleString('en-GB')} baht</dd></div>
    <div><dt>When</dt><dd>${whenText(state.slot, end)}</dd></div>
    ${state.zone !== BIZ ? `<div><dt>Workshop</dt><dd>${shopText(state.slot, end)}</dd></div>` : ''}
  </dl>`;
}

// ---------- form ----------

const FIELDS = ['name', 'email', 'phone', 'bike', 'notes'];

function showFieldErrors(errors) {
  for (const f of FIELDS) {
    const input = $('f-' + f);
    const msg = errors[f] || '';
    $('e-' + f).textContent = msg;
    if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  }
}

function formData() { const fd = new FormData($('form')); return Object.fromEntries(FIELDS.map(f => [f, fd.get(f) ?? ''])); }

function onSubmit(e) {
  e.preventDefault();
  state.submitted = true;
  const box = $('errors');
  const check = C.validateDetails(formData());
  showFieldErrors(check.errors);
  if (!check.ok) {
    const keys = FIELDS.filter(f => check.errors[f]);
    box.innerHTML = `<h3>Check ${keys.length === 1 ? 'one field' : keys.length + ' fields'}</h3><ul>${keys.map(k => `<li><a href="#f-${k}">${esc(check.errors[k])}</a></li>`).join('')}</ul>`;
    box.hidden = false;
    box.focus();
    return;
  }
  const id = globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const r = C.createBooking({ config, services: SERVICES, bookings: state.bookings, now: clock(), serviceId: state.serviceId, start: state.slot, details: check.value, id });
  if (!r.ok) {
    refresh();
    clearSlot();
    $('details').hidden = false;
    box.innerHTML = '<h3>That time is no longer free</h3><p>Someone else booked it or it is now too close. Pick another time.</p>';
    box.hidden = false;
    box.focus();
    return;
  }
  state.bookings = r.bookings;
  persist();
  showDone(r.booking);
}

let icsUrl = null;
function showDone(b) {
  const s = SERVICES.find(x => x.id === b.serviceId);
  state.lastBooking = b;
  $('done-body').innerHTML = `<dl>
    <div><dt>Service</dt><dd>${esc(s.name)}, ${s.duration} min</dd></div>
    <div><dt>When</dt><dd>${whenText(b.start, b.end)}</dd></div>
    ${state.zone !== BIZ ? `<div><dt>Workshop</dt><dd>${shopText(b.start, b.end)}</dd></div>` : ''}
    <div><dt>Name</dt><dd>${esc(b.name)}</dd></div>
    <div><dt>Bike</dt><dd>${esc(b.bike)}</dd></div>
    <div><dt>Where</dt><dd>${esc(BUSINESS.address)}</dd></div>
  </dl>`;
  const day = C.dateInZone(b.start, state.zone);
  $('stub-side').innerHTML = `<span class="stub-wd">${C.formatWeekday(day)}</span><span class="stub-d">${+day.slice(8)}</span><span class="stub-m">${C.formatMonth(+day.slice(0, 4), +day.slice(5, 7)).split(' ')[0]}</span><span class="stub-t">${C.formatTime(b.start, state.zone)}</span><span class="ref">Reference <span class="mono">${esc(b.ref)}</span></span>`;
  $('stub').style.setProperty('--tone', tone(b.serviceId));
  const ics = C.buildIcs({ booking: b, service: s, business: BUSINESS, dtstamp: clock() });
  if (icsUrl) URL.revokeObjectURL(icsUrl);
  icsUrl = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = $('ics');
  a.href = icsUrl;
  a.download = `slotbook-${b.ref}.ics`;
  a.dataset.ics = ics;
  $('book').hidden = true;
  $('done').hidden = false;
  const stub = $('stub');
  stub.classList.remove('print'); void stub.offsetWidth; if (!reduceMotion()) stub.classList.add('print');
  const h = $('h-done');
  h.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'auto' });
  announce('Booking confirmed. Reference ' + b.ref + '.');
}

function bookAgain() {
  $('form').reset();
  showFieldErrors({});
  $('errors').hidden = true;
  state.submitted = false;
  clearSlot();
  refresh();
  $('done').hidden = true;
  $('book').hidden = false;
  const t = document.querySelector('#panel-book .page-title');
  t.setAttribute('tabindex', '-1');
  t.focus();
}

// ---------- workshop diary ----------

const DIARY_FROM = 8 * 60, DIARY_TO = 21 * 60;
const DROWS = (DIARY_TO - DIARY_FROM) / config.stepMin;
let lastCols = 0;

function diaryCols() {
  const w = ($('diary').clientWidth || innerWidth) - 52;
  return Math.max(1, Math.min(7, Math.floor(w / 150)));
}

function nextBookedDate() {
  const today = C.dateInZone(clock(), BIZ);
  const dates = C.activeBookings(state.bookings).map(b => C.dateInZone(b.start, BIZ)).filter(d => d >= today).sort();
  return dates[0] || today;
}

const dkey = (date, k) => C.zonedToUtc(date, DIARY_FROM + k * config.stepMin, BIZ);
const shortName = n => String(n).replace(/^Sample customer /, '');

function renderDiary() {
  const n = diaryCols();
  lastCols = n;
  const days = Array.from({ length: n }, (_, i) => C.addDays(state.staffDate, i));
  $('staff-date').textContent = n === 1 ? C.formatDateLong(days[0]) : `${C.formatDateShort(days[0])} to ${C.formatDateShort(days[n - 1])}`;
  const now = clock();
  const today = C.dateInZone(now, BIZ);
  const nowMin = C.minutesInZone(now, BIZ);
  const gutter = Array.from({ length: DROWS / 2 }, (_, i) => `<span style="--k:${i * 2}">${C.fromMinutes(DIARY_FROM + i * 60)}</span>`).join('');
  const heads = days.map(d => {
    const o = config.overrides[d];
    return `<button type="button" class="dh${d === state.agendaDate ? ' on' : ''}${d === today ? ' today' : ''}" data-day="${d}" aria-pressed="${d === state.agendaDate}" aria-label="Show the list for ${C.formatDateLong(d)}"><span class="dh-wd">${C.formatWeekday(d)}</span><span class="dh-d">${+d.slice(8)}</span>${o ? `<span class="dh-note">${esc(o.closed ? 'Closed' : o.extra ? 'Late' : 'Special')}</span>` : ''}</button>`;
  }).join('');
  const cols = days.map(d => {
    const open = C.hoursForDate(config, d);
    // Shade the closed parts of the day.
    const shut = [];
    let cur = DIARY_FROM;
    for (const [a, b] of open) { if (a > cur) shut.push([cur, Math.min(a, DIARY_TO)]); cur = Math.max(cur, b); }
    if (cur < DIARY_TO) shut.push([cur, DIARY_TO]);
    const shade = shut.filter(([a, b]) => b > a).map(([a, b]) => `<div class="shut" style="--k:${(a - DIARY_FROM) / config.stepMin};--n:${(b - a) / config.stepMin}"></div>`).join('');
    const list = C.bookingsOnDate(state.bookings, d, BIZ);
    const blocks = list.map(b => {
      const s = serviceOf(b);
      const k = (C.minutesInZone(b.start, BIZ) - DIARY_FROM) / config.stepMin;
      const len = (b.end - b.start) / STEP;
      const cancelled = b.status === 'cancelled';
      const label = `${C.formatTime(b.start, BIZ)} to ${C.formatTime(b.end, BIZ)}, ${s ? s.name : b.serviceId}, ${shortName(b.name)}${cancelled ? ', cancelled' : ', drag or use arrow keys to move'}`;
      return `<button type="button" class="blk${cancelled ? ' cancelled' : ''}${len <= 1 ? ' short' : ''}" data-id="${esc(b.id)}" style="--k:${k};--n:${len};--tone:${tone(b.serviceId)}" aria-label="${esc(label)}"${cancelled ? ' aria-disabled="true"' : ''}><b>${C.formatTime(b.start, BIZ)}</b><span class="bs">${esc(s ? s.name : b.serviceId)}</span><span class="bn">${esc(shortName(b.name))}</span></button>`;
    }).join('');
    const nowLine = d === today && nowMin > DIARY_FROM && nowMin < DIARY_TO ? `<div class="now" style="--k:${(nowMin - DIARY_FROM) / config.stepMin}" aria-hidden="true"></div>` : '';
    return `<div class="col${d === state.agendaDate ? ' on' : ''}" data-date="${d}">${shade}${nowLine}${blocks}</div>`;
  }).join('');
  $('diary').innerHTML = `<div class="dg" style="--cols:${n};--rows:${DROWS}"><div class="dg-head"><span class="dg-corner" aria-hidden="true">UTC+7</span>${heads}</div><div class="dg-body"><div class="dg-gutter" aria-hidden="true">${gutter}</div>${cols}<div class="drop" id="drop" hidden aria-hidden="true"><b></b></div></div></div>`;
}

function renderAgenda() {
  const d = state.agendaDate;
  $('agenda-h').textContent = C.formatDateLong(d);
  const hours = C.hoursForDate(config, d);
  const o = config.overrides[d];
  $('staff-hours').textContent = (hours.length ? 'Open ' + hours.map(([a, b]) => `${C.fromMinutes(a)} to ${C.fromMinutes(b)}`).join(' and ') + '.' : 'Closed.') + (o?.note ? ' ' + o.note + '.' : '');
  const list = C.bookingsOnDate(state.bookings, d, BIZ);
  $('staff-empty').hidden = list.length > 0;
  $('staff-list').innerHTML = list.map(b => {
    const s = serviceOf(b);
    const cancelled = b.status === 'cancelled';
    return `<li class="bk${cancelled ? ' cancelled' : ''}" data-id="${esc(b.id)}" style="--tone:${tone(b.serviceId)}">
      <p class="bk-time mono">${C.formatTime(b.start, BIZ)}<span>${C.formatTime(b.end, BIZ)}</span></p>
      <div class="bk-main">
        <p class="bk-svc">${esc(s ? s.name : b.serviceId)}${cancelled ? ' <span class="tag">Cancelled</span>' : ''}${b.movedFrom && !cancelled ? ' <span class="tag">Moved</span>' : ''}</p>
        <p>${esc(b.name)}, <span class="mono">${esc(b.phone)}</span></p>
        <p class="muted">${esc(b.bike)}${b.notes ? '. ' + esc(b.notes) : ''}</p>
        <p class="muted mono">${esc(b.ref)}</p>
      </div>
      <div class="bk-act">${cancelled ? '' : `<button type="button" class="btn line sm" data-cancel="${esc(b.id)}" aria-label="Cancel ${esc(b.ref)} at ${C.formatTime(b.start, BIZ)}">Cancel</button>`}</div>
    </li>`;
  }).join('');
}

function renderStaff() {
  state.staffDate ??= nextBookedDate();
  if (!state.agendaDate || state.agendaDate < state.staffDate || state.agendaDate > C.addDays(state.staffDate, diaryCols() - 1)) state.agendaDate = state.staffDate;
  renderDiary();
  renderAgenda();
}

function askCancel(id) {
  const b = state.bookings.find(x => x.id === id);
  const li = document.querySelector(`#staff-list li[data-id="${CSS.escape(id)}"] .bk-act`);
  li.innerHTML = `<p class="confirm-q">Cancel ${esc(b.ref)}?</p><div class="confirm-row"><button type="button" class="btn line sm" data-keep="${esc(id)}">Keep</button><button type="button" class="btn danger sm" data-confirm="${esc(id)}">Yes, cancel</button></div>`;
  li.querySelector('[data-keep]').focus();
}

function doCancel(id) {
  const r = C.cancelBooking(state.bookings, id, clock());
  if (!r.ok) return;
  state.bookings = r.bookings;
  persist();
  renderStaff();
  refresh();
  const ref = state.bookings.find(b => b.id === id).ref;
  announce(`Booking ${ref} cancelled. The time is open again.`);
  $('staff-date').setAttribute('tabindex', '-1');
  $('staff-date').focus();
}

// Reschedule: the booking may land on any start the rules allow once it stops blocking itself.
function allowedStarts(b) {
  const others = state.bookings.filter(x => x.id !== b.id);
  return new Set(C.generateSlots({ config, service: serviceOf(b), bookings: others, now: clock() }).map(s => s.start));
}

function applyMove(id, start) {
  const before = state.bookings;
  const fromDate = state.agendaDate;
  const r = C.rescheduleBooking({ config, services: SERVICES, bookings: state.bookings, now: clock(), id, start });
  if (!r.ok) return false;
  state.bookings = r.bookings;
  persist();
  state.agendaDate = C.dateInZone(start, BIZ);
  renderStaff();
  refresh();
  const el = document.querySelector(`#diary .blk[data-id="${CSS.escape(id)}"]`);
  if (el) { el.focus({ preventScroll: true }); if (!reduceMotion()) { el.classList.remove('settle'); void el.offsetWidth; el.classList.add('settle'); } }
  const msg = `${r.booking.ref} moved to ${C.formatDateShort(C.dateInZone(start, BIZ))}, ${C.formatTime(start, BIZ)}.`;
  announce(msg);
  toast(msg, { label: 'Undo', fn: () => { state.bookings = before; state.agendaDate = fromDate; persist(); renderStaff(); refresh(); announce('Move undone.'); } });
  return true;
}

function showDrop(date, k, len, ok, toneHex) {
  const drop = $('drop');
  const col = document.querySelector(`#diary .col[data-date="${date}"]`);
  if (!drop || !col) { if (drop) drop.hidden = true; return; }
  const body = drop.parentElement;
  const br = body.getBoundingClientRect(), cr = col.getBoundingClientRect();
  drop.hidden = false;
  drop.style.left = (cr.left - br.left) + 'px';
  drop.style.width = cr.width + 'px';
  drop.style.setProperty('--k', k);
  drop.style.setProperty('--n', len);
  drop.style.setProperty('--tone', toneHex);
  drop.classList.toggle('bad', !ok);
  drop.querySelector('b').textContent = `${C.fromMinutes(DIARY_FROM + k * config.stepMin)}${ok ? '' : ', not free'}`;
}

function wireDiary() {
  const diary = $('diary');
  let drag = null;
  let kb = null; // keyboard move: { id, date, k, len, allowed }

  diary.addEventListener('pointerdown', e => {
    const blk = e.target.closest('.blk');
    if (!blk || blk.classList.contains('cancelled') || e.button !== 0) return;
    const b = state.bookings.find(x => x.id === blk.dataset.id);
    if (!b) return;
    const body = diary.querySelector('.dg-body');
    const rh = diary.querySelector('.col').getBoundingClientRect().height / DROWS;
    drag = { id: b.id, b, blk, x0: e.clientX, y0: e.clientY, k0: (C.minutesInZone(b.start, BIZ) - DIARY_FROM) / config.stepMin, len: (b.end - b.start) / STEP, rh, body, moved: false, allowed: allowedStarts(b), pid: e.pointerId, target: null };
    blk.setPointerCapture(e.pointerId);
  });
  diary.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.pid) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    if (!drag.moved) { drag.moved = true; drag.blk.classList.add('lift'); document.body.classList.add('dragging'); }
    const cols = [...diary.querySelectorAll('.col')];
    const col = cols.find(c => { const r = c.getBoundingClientRect(); return e.clientX >= r.left && e.clientX < r.right; }) || (e.clientX < cols[0].getBoundingClientRect().left ? cols[0] : cols[cols.length - 1]);
    const k = Math.max(0, Math.min(DROWS - drag.len, Math.round(drag.k0 + dy / drag.rh)));
    const start = dkey(col.dataset.date, k);
    const ok = drag.allowed.has(start);
    drag.target = { start, ok };
    drag.blk.style.transform = `translate(${dx}px, ${dy}px)`;
    showDrop(col.dataset.date, k, drag.len, ok, tone(drag.b.serviceId));
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.pid) return;
    const d = drag;
    drag = null;
    document.body.classList.remove('dragging');
    d.blk.classList.remove('lift');
    d.blk.style.transform = '';
    $('drop') && ($('drop').hidden = true);
    if (!d.moved) { selectBooking(d.b); return; }
    if (d.target && d.target.ok && d.target.start !== d.b.start) applyMove(d.id, d.target.start);
    else if (d.target && !d.target.ok) { announce('That time is not free. The booking stayed where it was.'); toast('That time is not free, so the booking stayed put.'); }
  };
  diary.addEventListener('pointerup', end);
  diary.addEventListener('pointercancel', end);

  diary.addEventListener('click', e => {
    const blk = e.target.closest('.blk');
    if (blk && e.detail === 0) { const b = state.bookings.find(x => x.id === blk.dataset.id); if (b) selectBooking(b); return; }
    const h = e.target.closest('.dh');
    if (h) { state.agendaDate = h.dataset.day; renderDiary(); renderAgenda(); diary.querySelector(`.dh[data-day="${h.dataset.day}"]`)?.focus(); }
  });

  diary.addEventListener('keydown', e => {
    const blk = e.target.closest('.blk');
    if (!blk || blk.classList.contains('cancelled')) return;
    const b = state.bookings.find(x => x.id === blk.dataset.id);
    const keys = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (keys[e.key]) {
      e.preventDefault();
      if (!kb || kb.id !== b.id) kb = { id: b.id, date: C.dateInZone(b.start, BIZ), k: (C.minutesInZone(b.start, BIZ) - DIARY_FROM) / config.stepMin, len: (b.end - b.start) / STEP, allowed: allowedStarts(b) };
      const [dd, dk] = keys[e.key];
      kb.k = Math.max(0, Math.min(DROWS - kb.len, kb.k + dk));
      if (dd) {
        const first = state.staffDate, last = C.addDays(state.staffDate, lastCols - 1);
        const nd = C.addDays(kb.date, dd);
        if (nd >= first && nd <= last) kb.date = nd;
      }
      const start = dkey(kb.date, kb.k);
      const ok = kb.allowed.has(start);
      blk.classList.add('lift');
      showDrop(kb.date, kb.k, kb.len, ok, tone(b.serviceId));
      announce(`${C.formatWeekday(kb.date)} ${C.fromMinutes(DIARY_FROM + kb.k * config.stepMin)}, ${ok ? 'free. Enter to place it.' : 'not free.'}`);
    } else if (e.key === 'Enter' && kb && kb.id === b.id) {
      e.preventDefault();
      const start = dkey(kb.date, kb.k);
      const ok = kb.allowed.has(start);
      kb = null;
      blk.classList.remove('lift');
      $('drop').hidden = true;
      if (ok && start !== b.start) applyMove(b.id, start);
      else if (ok) announce('Same time, nothing moved.');
      else { announce('That time is not free. The booking stayed where it was.'); toast('That time is not free, so the booking stayed put.'); }
    } else if (e.key === 'Escape' && kb) {
      kb = null;
      blk.classList.remove('lift');
      $('drop').hidden = true;
      announce('Move cancelled.');
    }
  });
  diary.addEventListener('focusout', e => {
    if (kb && e.target.closest('.blk')) { kb = null; e.target.classList.remove('lift'); if ($('drop')) $('drop').hidden = true; }
  });
}

function selectBooking(b) {
  state.agendaDate = C.dateInZone(b.start, BIZ);
  renderDiary();
  renderAgenda();
  document.querySelector(`#diary .blk[data-id="${CSS.escape(b.id)}"]`)?.focus({ preventScroll: true });
  const li = document.querySelector(`#staff-list li[data-id="${CSS.escape(b.id)}"]`);
  if (li) {
    li.classList.add('hl');
    setTimeout(() => li.classList.remove('hl'), 1600);
    const r = li.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) li.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'nearest' });
  }
}

// ---------- tabs ----------

function showTab(name, focusTab) {
  const book = name === 'book';
  $('tab-book').setAttribute('aria-selected', String(book));
  $('tab-staff').setAttribute('aria-selected', String(!book));
  $('tab-book').tabIndex = book ? 0 : -1;
  $('tab-staff').tabIndex = book ? -1 : 0;
  document.querySelector('.tabs').dataset.on = name;
  $('panel-book').hidden = !book;
  $('panel-staff').hidden = book;
  if (book) refresh(); else renderStaff();
  if (focusTab) $(book ? 'tab-book' : 'tab-staff').focus();
  try { history.replaceState(null, '', book ? location.pathname + location.search : location.pathname + location.search + '#staff'); } catch {}
}

// ---------- wiring ----------

function refresh() {
  D = derive();
  if (state.month === null) {
    const first = [...D.byDate.keys()].sort()[0] || D.rangeStart;
    state.month = ym(first);
    state.focus = first;
  }
  if (state.focus < D.rangeStart) state.focus = D.rangeStart;
  if (state.focus > D.rangeEnd) state.focus = D.rangeEnd;
  if (state.slot !== null && !D.slots.some(s => s.start === state.slot)) clearSlot();
  renderZones();
  renderCalendar();
  renderSlots();
  renderTicket();
}

function init() {
  renderServices();
  renderHours();
  $('f-bike').innerHTML = '<option value="">Choose one</option>' + C.BIKES.map(b => `<option>${esc(b)}</option>`).join('');
  if (matchMedia('(min-width: 1100px)').matches) $('hours-box').open = true;

  $('services').addEventListener('change', e => {
    if (e.target.name !== 'service') return;
    state.serviceId = e.target.value;
    clearSlot();
    refresh();
  });

  $('zone').addEventListener('change', e => {
    state.zone = e.target.value;
    persist();
    if (state.slot !== null) state.date = C.dateInZone(state.slot, state.zone);
    D = derive();
    const anchor = state.date || [...D.byDate.keys()].sort()[0] || D.rangeStart;
    state.month = ym(anchor);
    state.focus = anchor;
    refresh();
    if (state.slot !== null) renderSummary();
  });

  $('cal-prev').addEventListener('click', () => shiftMonth(-1));
  $('cal-next').addEventListener('click', () => shiftMonth(1));
  $('cal-body').addEventListener('click', e => {
    const td = e.target.closest('td[data-date]');
    if (!td) return;
    setFocus(td.dataset.date, true);
    pickDate(td.dataset.date);
  });
  $('cal-body').addEventListener('keydown', e => {
    const td = e.target.closest('td[data-date]');
    if (!td) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickDate(td.dataset.date); return; }
    const next = C.moveDate(state.focus, e.key, { shift: e.shiftKey, min: D.rangeStart, max: D.rangeEnd });
    if (!next) return;
    e.preventDefault();
    setFocus(next, true);
  });
  $('day-prev').addEventListener('click', () => stepDay(-1));
  $('day-next').addEventListener('click', () => stepDay(1));

  $('slots').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'next-open' || b.id === 'soonest') {
      const d = b.dataset.date;
      setFocus(d, false);
      pickDate(d);
      document.querySelector('#slots .slot')?.focus({ preventScroll: true });
      return;
    }
    if (b.dataset.start) pickSlot(+b.dataset.start);
  });
  const ghostFor = e => { const b = e.target.closest?.('.slot'); showGhost(b ? +b.dataset.i : null); };
  $('slots').addEventListener('pointerover', ghostFor);
  $('slots').addEventListener('focusin', ghostFor);
  $('slots').addEventListener('pointerleave', () => showGhost(null));
  $('slots').addEventListener('focusout', e => { if (!e.relatedTarget?.closest?.('#slots .slot')) showGhost(null); });
  wireTimelineDrag();

  $('form').addEventListener('submit', onSubmit);
  $('form').addEventListener('input', e => {
    if (!state.submitted) return;
    const f = e.target.name;
    if (!FIELDS.includes(f)) return;
    const errs = C.validateDetails(formData()).errors;
    const cur = {};
    for (const k of FIELDS) cur[k] = $('e-' + k).textContent ? errs[k] : undefined;
    cur[f] = errs[f];
    showFieldErrors(cur);
  });
  $('errors').addEventListener('click', e => {
    const a = e.target.closest('a[href^="#f-"]');
    if (!a) return;
    e.preventDefault();
    $(a.getAttribute('href').slice(1)).focus();
  });
  $('change-time').addEventListener('click', () => {
    const start = state.slot;
    clearSlot();
    document.querySelectorAll('#slots .slot').forEach(b => b.setAttribute('aria-pressed', 'false'));
    const btn = document.querySelector(`#slots .slot[data-start="${start}"]`) || document.querySelector('#slots .slot');
    if (btn) { btn.focus({ preventScroll: true }); btn.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' }); }
  });
  $('again').addEventListener('click', bookAgain);
  $('see-diary').addEventListener('click', () => {
    const b = state.lastBooking;
    if (!b) return;
    state.staffDate = C.dateInZone(b.start, BIZ);
    state.agendaDate = state.staffDate;
    bookAgain();
    showTab('staff', false);
    selectBooking(b);
  });

  const tabs = ['tab-book', 'tab-staff'];
  tabs.forEach((id, i) => {
    $(id).addEventListener('click', () => showTab(i === 0 ? 'book' : 'staff', false));
    $(id).addEventListener('keydown', e => {
      const map = { ArrowLeft: (i + 1) % 2, ArrowRight: (i + 1) % 2, Home: 0, End: 1 };
      if (!(e.key in map)) return;
      e.preventDefault();
      showTab(map[e.key] === 0 ? 'book' : 'staff', true);
    });
  });

  $('staff-prev').addEventListener('click', () => { state.staffDate = C.addDays(state.staffDate, -1); renderStaff(); });
  $('staff-next').addEventListener('click', () => { state.staffDate = C.addDays(state.staffDate, 1); renderStaff(); });
  $('staff-today').addEventListener('click', () => { state.staffDate = C.dateInZone(clock(), BIZ); state.agendaDate = state.staffDate; renderStaff(); });
  $('staff-list').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.cancel) askCancel(b.dataset.cancel);
    else if (b.dataset.keep) { const id = b.dataset.keep; renderAgenda(); document.querySelector(`#staff-list [data-cancel="${CSS.escape(id)}"]`)?.focus(); }
    else if (b.dataset.confirm) doCancel(b.dataset.confirm);
  });
  wireDiary();
  $('reset').addEventListener('click', e => {
    const btn = e.currentTarget;
    if (btn.dataset.armed !== 'true') { btn.dataset.armed = 'true'; btn.textContent = 'Press again to reset'; return; }
    btn.dataset.armed = 'false';
    btn.textContent = 'Reset sample data';
    state.bookings = seedBookings(config, clock());
    persist();
    state.staffDate = nextBookedDate();
    state.agendaDate = state.staffDate;
    renderStaff();
    refresh();
    announce('Sample bookings restored.');
  });
  $('reset').addEventListener('blur', e => { e.currentTarget.dataset.armed = 'false'; e.currentTarget.textContent = 'Reset sample data'; });

  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (!$('panel-staff').hidden && diaryCols() !== lastCols) renderStaff(); }, 120); });

  document.querySelector('.tabs').dataset.on = 'book';
  refresh();
  // With room for the timeline beside the calendar, open on the soonest day so the page starts with a real day.
  const soon = $('soonest');
  if (soon && matchMedia('(min-width: 760px)').matches) { setFocus(soon.dataset.date, false); pickDate(soon.dataset.date); }
  if (location.hash === '#staff') showTab('staff', false);
  document.documentElement.dataset.ready = 'true';
}

init();
