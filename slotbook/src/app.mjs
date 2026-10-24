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
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
  submitted: false
};
const persist = () => store.write({ bookings: state.bookings, zone: state.zone });
if (!saved) persist();

const service = () => SERVICES.find(s => s.id === state.serviceId);
const ym = iso => { const { y, m } = C.parseDate(iso); return { y, m }; };
const sameMonth = (a, b) => a.y === b.y && a.m === b.m;
const monthKey = ({ y, m }) => y * 12 + m;
const announce = msg => { const l = $('live'); l.textContent = ''; setTimeout(() => { l.textContent = msg; }, 30); };

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

// ---------- services and hours ----------

function renderServices() {
  $('services').innerHTML = SERVICES.map(s => `
    <label class="svc">
      <input type="radio" name="service" value="${s.id}" ${s.id === state.serviceId ? 'checked' : ''}>
      <span class="svc-text"><span class="svc-name">${esc(s.name)}</span><span class="svc-blurb">${esc(s.blurb)}</span></span>
      <span class="svc-meta"><span>${s.duration} min</span><span>${s.price.toLocaleString('en-GB')} baht</span></span>
    </label>`).join('');
}

const windowsText = list => list.length ? list.map(([a, b]) => `${C.fromMinutes(a)} to ${C.fromMinutes(b)}`).join(', ') : 'Closed';

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
  $('cal-body').innerHTML = C.monthGrid(y, m).map(week => `<tr>${week.map(iso => {
    if (!iso) return '<td role="gridcell" class="blank"></td>';
    const inRange = iso >= D.rangeStart && iso <= D.rangeEnd;
    const count = inRange ? (D.byDate.get(iso)?.length || 0) : 0;
    const o = state.zone === BIZ ? config.overrides[iso] : null;
    const cls = ['day', count ? 'open' : 'none', iso === D.rangeStart ? 'today' : '', o ? 'override' : ''].filter(Boolean).join(' ');
    return `<td role="gridcell" class="${cls}" data-date="${iso}" tabindex="${iso === state.focus ? 0 : -1}" aria-selected="${iso === state.date}"${count ? '' : ' aria-disabled="true"'}${iso === D.rangeStart ? ' aria-current="date"' : ''} aria-label="${esc(dayLabel(iso, count, inRange))}"><span class="dnum" aria-hidden="true">${+iso.slice(8)}</span>${count ? `<span class="dcount" aria-hidden="true">${count}</span>` : ''}</td>`;
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
  document.querySelectorAll('#cal-body td[data-date]').forEach(td => td.setAttribute('aria-selected', String(td.dataset.date === iso)));
  renderSlots();
  const n = D.byDate.get(iso)?.length || 0;
  announce(n ? `${n} open time${n === 1 ? '' : 's'} on ${C.formatDateLong(iso)}.` : `No open times on ${C.formatDateLong(iso)}.`);
}

// ---------- slots ----------

function renderSlots() {
  const box = $('slots');
  const head = $('times-for');
  if (!state.date) {
    head.textContent = 'Pick a day to see open times.';
    const first = D.slots.reduce((a, s) => (a === null || s.start < a.start ? s : a), null);
    if (!first) { box.innerHTML = '<p class="none-msg">No open times in the booking window for this service.</p>'; return; }
    const day = C.dateInZone(first.start, state.zone);
    const n = D.byDate.get(day)?.length || 0;
    box.innerHTML = `<div class="soonest"><p class="soonest-label">Soonest for ${esc(service().name.toLowerCase())}</p><p class="soonest-when"><strong>${C.formatDateLong(day)}</strong> <span class="mono">${C.formatTime(first.start, state.zone)}</span></p><p class="muted">${n} open time${n === 1 ? '' : 's'} that day.</p><button type="button" class="btn line" id="soonest" data-date="${day}">Show that day</button></div>`;
    return;
  }
  const list = D.byDate.get(state.date) || [];
  head.innerHTML = `<strong>${C.formatDateLong(state.date)}</strong> <span class="muted">${esc(service().name)}, ${service().duration} min</span>`;
  if (!list.length) {
    const next = [...D.byDate.keys()].filter(d => d > state.date).sort()[0];
    box.innerHTML = `<p class="none-msg">No open times on this day for this service.</p>${next ? `<button type="button" class="btn line" id="next-open" data-date="${next}">Go to ${C.formatDateLong(next)}</button>` : ''}`;
    return;
  }
  const offsets = new Set(list.map(s => C.offsetMinutes(s.start, state.zone)));
  const showOffset = offsets.size > 1;
  const other = state.zone !== BIZ;
  const groups = new Map();
  for (const s of list) {
    const part = C.partOfDay(C.minutesInZone(s.start, state.zone));
    if (!groups.has(part)) groups.set(part, []);
    groups.get(part).push(s);
  }
  box.innerHTML = [...groups].map(([part, items]) => `
    <div class="slot-group" role="group" aria-label="${part}">
      <h3 class="part">${part}</h3>
      <div class="slot-grid">${items.map(s => {
        const t = C.formatTime(s.start, state.zone);
        const shop = C.formatTime(s.start, BIZ);
        const shopDay = C.dateInZone(s.start, BIZ) !== state.date ? C.formatWeekday(C.dateInZone(s.start, BIZ)) + ' ' : '';
        const extra = other ? `<span class="shop">${shopDay}${shop} at the workshop</span>` : '';
        const off = showOffset ? `<span class="off">${C.offsetLabel(s.start, state.zone)}</span>` : '';
        const label = `${t}${showOffset ? ' ' + C.offsetLabel(s.start, state.zone) : ''}${other ? `, ${shopDay}${shop} at the workshop` : ''}`;
        return `<button type="button" class="slot${other ? ' two' : ''}" data-start="${s.start}" aria-pressed="${s.start === state.slot}" aria-label="${esc(label)}"><span class="t">${t}${off}</span>${extra}</button>`;
      }).join('')}</div>
    </div>`).join('');
}

function clearSlot() {
  state.slot = null;
  $('details').hidden = true;
}

function pickSlot(start) {
  state.slot = start;
  document.querySelectorAll('#slots .slot').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.start === start)));
  renderSummary();
  $('details').hidden = false;
  const h = $('h-details');
  h.focus({ preventScroll: true });
  h.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
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
  $('done-body').innerHTML = `<p class="ref">Reference <span class="mono">${esc(b.ref)}</span></p><dl>
    <div><dt>Service</dt><dd>${esc(s.name)}, ${s.duration} min</dd></div>
    <div><dt>When</dt><dd>${whenText(b.start, b.end)}</dd></div>
    ${state.zone !== BIZ ? `<div><dt>Workshop</dt><dd>${shopText(b.start, b.end)}</dd></div>` : ''}
    <div><dt>Name</dt><dd>${esc(b.name)}</dd></div>
    <div><dt>Bike</dt><dd>${esc(b.bike)}</dd></div>
    <div><dt>Where</dt><dd>${esc(BUSINESS.address)}</dd></div>
  </dl>`;
  const ics = C.buildIcs({ booking: b, service: s, business: BUSINESS, dtstamp: clock() });
  if (icsUrl) URL.revokeObjectURL(icsUrl);
  icsUrl = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = $('ics');
  a.href = icsUrl;
  a.download = `slotbook-${b.ref}.ics`;
  a.dataset.ics = ics;
  $('book').hidden = true;
  $('done').hidden = false;
  const h = $('h-done');
  h.focus({ preventScroll: true });
  h.scrollIntoView({ behavior: 'auto', block: 'start' });
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
  document.querySelector('#panel-book .page-title').setAttribute('tabindex', '-1');
  document.querySelector('#panel-book .page-title').focus();
}

// ---------- staff view ----------

function nextBookedDate() {
  const today = C.dateInZone(clock(), BIZ);
  const dates = C.activeBookings(state.bookings).map(b => C.dateInZone(b.start, BIZ)).filter(d => d >= today).sort();
  return dates[0] || today;
}

function renderStaff() {
  const d = state.staffDate;
  $('staff-date').textContent = C.formatDateLong(d);
  const hours = C.hoursForDate(config, d);
  const o = config.overrides[d];
  $('staff-hours').textContent = (hours.length ? 'Open ' + hours.map(([a, b]) => `${C.fromMinutes(a)} to ${C.fromMinutes(b)}`).join(' and ') + '.' : 'Closed.') + (o?.note ? ' ' + o.note + '.' : '');
  const list = C.bookingsOnDate(state.bookings, d, BIZ);
  $('staff-empty').hidden = list.length > 0;
  $('staff-list').innerHTML = list.map(b => {
    const s = SERVICES.find(x => x.id === b.serviceId);
    const cancelled = b.status === 'cancelled';
    return `<li class="bk${cancelled ? ' cancelled' : ''}" data-id="${esc(b.id)}">
      <p class="bk-time mono">${C.formatTime(b.start, BIZ)}<span>${C.formatTime(b.end, BIZ)}</span></p>
      <div class="bk-main">
        <p class="bk-svc">${esc(s ? s.name : b.serviceId)}${cancelled ? ' <span class="tag">Cancelled</span>' : ''}</p>
        <p>${esc(b.name)}, <span class="mono">${esc(b.phone)}</span></p>
        <p class="muted">${esc(b.bike)}${b.notes ? '. ' + esc(b.notes) : ''}</p>
        <p class="muted mono">${esc(b.ref)}</p>
      </div>
      <div class="bk-act">${cancelled ? '' : `<button type="button" class="btn line" data-cancel="${esc(b.id)}" aria-label="Cancel ${esc(b.ref)} at ${C.formatTime(b.start, BIZ)}">Cancel</button>`}</div>
    </li>`;
  }).join('');
}

function askCancel(id) {
  const b = state.bookings.find(x => x.id === id);
  const li = document.querySelector(`#staff-list li[data-id="${CSS.escape(id)}"] .bk-act`);
  li.innerHTML = `<p class="confirm-q">Cancel ${esc(b.ref)}?</p><div class="confirm-row"><button type="button" class="btn line" data-keep="${esc(id)}">Keep</button><button type="button" class="btn danger" data-confirm="${esc(id)}">Yes, cancel</button></div>`;
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

// ---------- tabs ----------

function showTab(name, focusTab) {
  const book = name === 'book';
  $('tab-book').setAttribute('aria-selected', String(book));
  $('tab-staff').setAttribute('aria-selected', String(!book));
  $('tab-book').tabIndex = book ? 0 : -1;
  $('tab-staff').tabIndex = book ? -1 : 0;
  $('panel-book').hidden = !book;
  $('panel-staff').hidden = book;
  if (book) refresh(); else { state.staffDate ??= nextBookedDate(); renderStaff(); }
  if (focusTab) $(book ? 'tab-book' : 'tab-staff').focus();
  try { history.replaceState(null, '', book ? location.pathname + location.search : '#staff'); } catch {}
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
}

function init() {
  renderServices();
  renderHours();
  $('f-bike').innerHTML = '<option value="">Choose one</option>' + C.BIKES.map(b => `<option>${esc(b)}</option>`).join('');

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

  $('slots').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'next-open' || b.id === 'soonest') {
      const d = b.dataset.date;
      setFocus(d, false);
      pickDate(d);
      document.querySelector(`#cal-body td[data-date="${d}"]`)?.focus();
      return;
    }
    if (b.dataset.start) pickSlot(+b.dataset.start);
  });

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
    renderSlots();
    const btn = document.querySelector(`#slots .slot[data-start="${start}"]`) || document.querySelector('#slots .slot');
    if (btn) { btn.focus({ preventScroll: true }); btn.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' }); }
  });
  $('again').addEventListener('click', bookAgain);

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
  $('staff-today').addEventListener('click', () => { state.staffDate = C.dateInZone(clock(), BIZ); renderStaff(); });
  $('staff-list').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.cancel) askCancel(b.dataset.cancel);
    else if (b.dataset.keep) { const id = b.dataset.keep; renderStaff(); document.querySelector(`#staff-list [data-cancel="${CSS.escape(id)}"]`)?.focus(); }
    else if (b.dataset.confirm) doCancel(b.dataset.confirm);
  });
  $('reset').addEventListener('click', e => {
    const btn = e.currentTarget;
    if (btn.dataset.armed !== 'true') { btn.dataset.armed = 'true'; btn.textContent = 'Press again to reset'; return; }
    btn.dataset.armed = 'false';
    btn.textContent = 'Reset sample data';
    state.bookings = seedBookings(config, clock());
    persist();
    state.staffDate = nextBookedDate();
    renderStaff();
    refresh();
    announce('Sample bookings restored.');
  });
  $('reset').addEventListener('blur', e => { e.currentTarget.dataset.armed = 'false'; e.currentTarget.textContent = 'Reset sample data'; });

  refresh();
  if (location.hash === '#staff') showTab('staff', false);
  document.documentElement.dataset.ready = 'true';
}

init();
