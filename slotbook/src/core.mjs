// Slotbook core. Pure functions only: no DOM, no storage, no clock.
// Every instant is a number of UTC milliseconds. Calendar dates are 'YYYY-MM-DD'
// strings that belong to a named time zone. Time zone maths uses Intl only.

const MINUTE = 60000;
const DAY = 86400000;
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// ---------- calendar dates ----------

const pad = n => String(n).padStart(2, '0');
export const isoDate = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

export function parseDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) throw new Error('bad date ' + iso);
  return { y: +m[1], m: +m[2], d: +m[3] };
}

const dateToUtc = iso => { const { y, m, d } = parseDate(iso); return Date.UTC(y, m - 1, d); };
const utcToDate = ms => new Date(ms).toISOString().slice(0, 10);

export const addDays = (iso, n) => utcToDate(dateToUtc(iso) + n * DAY);
export const weekdayOf = iso => new Date(dateToUtc(iso)).getUTCDay();
export const daysBetween = (a, b) => Math.round((dateToUtc(b) - dateToUtc(a)) / DAY);

// Same day of month n months away, clamped to the last day of the target month.
export function addMonths(iso, n) {
  const { y, m, d } = parseDate(iso);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const ty = first.getUTCFullYear(), tm = first.getUTCMonth() + 1;
  const last = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  return isoDate(ty, tm, Math.min(d, last));
}

export function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m || +m[2] > 59 || +m[1] > 24) throw new Error('bad time ' + hhmm);
  return +m[1] * 60 + +m[2];
}
export const fromMinutes = min => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

// ---------- time zones through Intl ----------

const partsFormatters = new Map();
function partsFormatter(zone) {
  let f = partsFormatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hourCycle: 'h23', weekday: 'short',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    partsFormatters.set(zone, f);
  }
  return f;
}

export function isValidZone(zone) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); return true; } catch { return false; }
}

// Wall clock reading of an instant in a zone.
export function zonedParts(ms, zone) {
  const o = {};
  for (const p of partsFormatter(zone).formatToParts(new Date(ms))) o[p.type] = p.value;
  return { year: +o.year, month: +o.month, day: +o.day, hour: +o.hour % 24, minute: +o.minute, second: +o.second, weekday: WEEKDAYS[o.weekday] };
}

export const dateInZone = (ms, zone) => { const p = zonedParts(ms, zone); return isoDate(p.year, p.month, p.day); };
export const minutesInZone = (ms, zone) => { const p = zonedParts(ms, zone); return p.hour * 60 + p.minute; };

// Offset of the zone from UTC at an instant, in minutes. London in summer is +60.
export function offsetMinutes(ms, zone) {
  const p = zonedParts(ms, zone);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((wall - Math.floor(ms / 1000) * 1000) / MINUTE);
}

// Instant for a wall clock time on a date in a zone. Returns null for a time
// that does not exist because the clocks went forward. For a time that happens
// twice because the clocks went back, returns the first one.
export function zonedToUtc(iso, minutes, zone) {
  const wall = dateToUtc(iso) + minutes * MINUTE;
  const offsets = new Set([offsetMinutes(wall - 12 * 3600000, zone), offsetMinutes(wall, zone), offsetMinutes(wall + 12 * 3600000, zone)]);
  const hits = [];
  for (const o of offsets) {
    const c = wall - o * MINUTE;
    if (c + offsetMinutes(c, zone) * MINUTE === wall) hits.push(c);
  }
  return hits.length ? Math.min(...hits) : null;
}

export function offsetLabel(ms, zone) {
  const o = offsetMinutes(ms, zone);
  if (o === 0) return 'UTC';
  const a = Math.abs(o);
  return `UTC${o < 0 ? '-' : '+'}${Math.floor(a / 60)}${a % 60 ? ':' + pad(a % 60) : ''}`;
}

// Dates in [fromIso, toIso] on which the zone's offset at noon differs from the
// day before, with the offsets before and after.
export function offsetChanges(fromIso, toIso, zone) {
  const out = [];
  const noon = iso => zonedToUtc(iso, 12 * 60, zone);
  let prev = offsetMinutes(noon(addDays(fromIso, -1)), zone);
  for (let d = fromIso; d <= toIso; d = addDays(d, 1)) {
    const cur = offsetMinutes(noon(d), zone);
    if (cur !== prev) out.push({ date: d, before: prev, after: cur });
    prev = cur;
  }
  return out;
}

// ---------- formatting ----------

const fmtCache = new Map();
function fmt(key, opts) {
  let f = fmtCache.get(key);
  if (!f) { f = new Intl.DateTimeFormat('en-GB', opts); fmtCache.set(key, f); }
  return f;
}
export const formatTime = (ms, zone) => fmt('t' + zone, { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms));
export const formatDateLong = iso => fmt('dl', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(dateToUtc(iso)));
export const formatDateShort = iso => fmt('ds', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(dateToUtc(iso)));
export const formatMonth = (y, m) => fmt('m', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, 1)));
export const formatWeekday = iso => fmt('wd', { timeZone: 'UTC', weekday: 'short' }).format(new Date(dateToUtc(iso)));

// ---------- availability ----------

export function mergeIntervals(list) {
  const sorted = list.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

// Opening windows for one workshop date, in minutes after local midnight.
// An override can close the day, replace its hours, or add extra hours.
export function hoursForDate(config, iso) {
  const o = config.overrides?.[iso];
  if (o?.closed) return [];
  let base = o?.hours ?? config.weekly[weekdayOf(iso)] ?? [];
  if (o?.extra) base = base.concat(o.extra);
  return mergeIntervals(base.map(([a, b]) => [toMinutes(a), toMinutes(b)]));
}

export const activeBookings = bookings => bookings.filter(b => b.status !== 'cancelled');

// Every bookable start for a service between now and the last bookable day.
export function generateSlots({ config, service, bookings = [], now }) {
  const zone = config.zone;
  const today = dateInZone(now, zone);
  const last = addDays(today, config.maxDaysAhead);
  const earliest = now + config.minNoticeMin * MINUTE;
  const buffer = config.bufferMin * MINUTE;
  const length = service.duration * MINUTE;
  const busy = activeBookings(bookings).map(b => [b.start - buffer, b.end + buffer]);
  const out = [];
  for (let d = today; d <= last; d = addDays(d, 1)) {
    for (const [open, close] of hoursForDate(config, d)) {
      const closeAt = zonedToUtc(d, close, zone) ?? zonedToUtc(d, close + 60, zone) - 60 * MINUTE;
      for (let m = open; m + service.duration <= close; m += config.stepMin) {
        const start = zonedToUtc(d, m, zone);
        if (start === null || start < earliest) continue;
        const end = start + length;
        if (end > closeAt) break;
        if (busy.some(([bs, be]) => start < be && end > bs)) continue;
        out.push({ start, end, date: d, minute: m });
      }
    }
  }
  return out;
}

// Slots grouped by the calendar date they fall on in the display zone.
export function groupByDate(slots, zone) {
  const map = new Map();
  for (const s of slots) {
    const key = dateInZone(s.start, zone);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  }
  return map;
}

export function partOfDay(minutes) {
  if (minutes < 360) return 'Night';
  if (minutes < 720) return 'Morning';
  if (minutes < 1020) return 'Afternoon';
  return 'Evening';
}

// ---------- bookings ----------

export const BIKES = ['Road bike', 'Mountain bike', 'City or folding bike', 'Electric bike', 'Other'];

export function validateDetails(input) {
  const v = {
    name: String(input.name ?? '').trim().replace(/\s+/g, ' '),
    email: String(input.email ?? '').trim(),
    phone: String(input.phone ?? '').trim(),
    bike: String(input.bike ?? ''),
    notes: String(input.notes ?? '').trim()
  };
  const errors = {};
  if (v.name.length < 2) errors.name = 'Enter your name.';
  else if (v.name.length > 80) errors.name = 'Keep your name under 80 characters.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/.test(v.email)) errors.email = 'Enter an email address like name@example.com.';
  const digits = v.phone.replace(/[\s().-]/g, '');
  if (!/^\+?\d{8,15}$/.test(digits)) errors.phone = 'Enter a phone number with 8 to 15 digits.';
  if (!BIKES.includes(v.bike)) errors.bike = 'Choose the kind of bike.';
  if (v.notes.length > 500) errors.notes = 'Keep notes under 500 characters.';
  return { ok: Object.keys(errors).length === 0, errors, value: { ...v, phone: digits } };
}

export const bookingRef = id => 'SB-' + String(id).replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase();

// Checks the slot is still free under the same rules, then returns the new list.
export function createBooking({ config, services, bookings, now, serviceId, start, details, id }) {
  const service = services.find(s => s.id === serviceId);
  if (!service) return { ok: false, error: 'unknown-service' };
  const check = validateDetails(details);
  if (!check.ok) return { ok: false, error: 'invalid', errors: check.errors };
  const slot = generateSlots({ config, service, bookings, now }).find(s => s.start === start);
  if (!slot) return { ok: false, error: 'slot-taken' };
  const booking = { id, ref: bookingRef(id), serviceId, start: slot.start, end: slot.end, ...check.value, createdAt: now, status: 'confirmed' };
  return { ok: true, booking, bookings: [...bookings, booking] };
}

export function cancelBooking(bookings, id, now) {
  let found = false;
  const next = bookings.map(b => {
    if (b.id !== id || b.status === 'cancelled') return b;
    found = true;
    return { ...b, status: 'cancelled', cancelledAt: now };
  });
  return { ok: found, bookings: next };
}

// Moves a booking to a new start under the same rules as a new booking:
// open hours, buffers, notice and the booking window. The booking does not
// block itself, so it can slide into time that overlaps where it was.
export function rescheduleBooking({ config, services, bookings, now, id, start }) {
  const b = bookings.find(x => x.id === id);
  if (!b) return { ok: false, error: 'unknown-booking' };
  if (b.status === 'cancelled') return { ok: false, error: 'cancelled' };
  if (b.start === start) return { ok: false, error: 'same-time' };
  const service = services.find(s => s.id === b.serviceId);
  if (!service) return { ok: false, error: 'unknown-service' };
  const others = bookings.filter(x => x.id !== id);
  const slot = generateSlots({ config, service, bookings: others, now }).find(s => s.start === start);
  if (!slot) return { ok: false, error: 'slot-taken' };
  const moved = { ...b, start: slot.start, end: slot.end, movedAt: now, movedFrom: b.start };
  return { ok: true, booking: moved, bookings: bookings.map(x => (x.id === id ? moved : x)) };
}

export const bookingsOnDate = (bookings, iso, zone) =>
  bookings.filter(b => dateInZone(b.start, zone) === iso).sort((a, b) => a.start - b.start);

// Drops anything that is not a well formed booking, for data read back from storage.
export function sanitizeBookings(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(b => b && typeof b.id === 'string' && Number.isFinite(b.start) && Number.isFinite(b.end) && b.end > b.start && typeof b.serviceId === 'string');
}

// ---------- month grid and keyboard movement ----------

// Weeks of the month, Monday first. Days outside the month are null.
export function monthGrid(y, m) {
  const first = isoDate(y, m, 1);
  const lead = (weekdayOf(first) + 6) % 7;
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Array(lead).fill(null);
  for (let d = 1; d <= count; d++) cells.push(isoDate(y, m, d));
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// Where focus goes in the date grid for a key, clamped to [min, max].
export function moveDate(iso, key, { shift = false, min, max } = {}) {
  const wd = (weekdayOf(iso) + 6) % 7;
  let next;
  switch (key) {
    case 'ArrowLeft': next = addDays(iso, -1); break;
    case 'ArrowRight': next = addDays(iso, 1); break;
    case 'ArrowUp': next = addDays(iso, -7); break;
    case 'ArrowDown': next = addDays(iso, 7); break;
    case 'Home': next = addDays(iso, -wd); break;
    case 'End': next = addDays(iso, 6 - wd); break;
    case 'PageUp': next = addMonths(iso, shift ? -12 : -1); break;
    case 'PageDown': next = addMonths(iso, shift ? 12 : 1); break;
    default: return null;
  }
  if (min && next < min) next = min;
  if (max && next > max) next = max;
  return next;
}

// ---------- iCalendar, RFC 5545 ----------

export const icsEscape = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
export const icsStamp = ms => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '');

// Fold to 75 octets per line. Continuation lines start with one space, which
// counts towards their 75. Never splits inside a UTF-8 sequence.
export function foldLine(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts = [];
  let cur = '', bytes = 0, limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) { parts.push(cur); cur = ''; bytes = 0; limit = 74; }
    cur += ch; bytes += b;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

export function buildIcs({ booking, service, business, dtstamp }) {
  const description = [
    `Booking ${booking.ref} for ${service.name}, ${service.duration} minutes.`,
    `Bike: ${booking.bike}.`,
    booking.notes ? `Notes: ${booking.notes}` : '',
    'Sample booking made with Slotbook. The workshop is fictional.'
  ].filter(Boolean).join('\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Slotbook//Sample booking page 1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${booking.id}@sandersaxbuilds.github.io`,
    `DTSTAMP:${icsStamp(dtstamp)}`,
    `DTSTART:${icsStamp(booking.start)}`,
    `DTEND:${icsStamp(booking.end)}`,
    `SUMMARY:${icsEscape(`${service.name} at ${business.name}`)}`,
    `LOCATION:${icsEscape(business.address)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

export const unfoldIcs = text => text.replace(/\r\n[ \t]/g, '');
