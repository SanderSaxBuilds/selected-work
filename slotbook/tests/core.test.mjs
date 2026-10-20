import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/core.mjs';
import { SERVICES, makeConfig, seedBookings, sampleOverrides, BUSINESS } from '../src/data.mjs';

const Z = (s) => Date.parse(s);
const BKK = 'Asia/Bangkok', LON = 'Europe/London', NY = 'America/New_York';
const svc = (duration) => ({ id: 's' + duration, name: 'Test', duration });
const base = (over = {}) => ({
  zone: BKK,
  weekly: { 0: [], 1: [], 2: [['09:00', '12:00'], ['13:00', '18:00']], 3: [['09:00', '12:00']], 4: [], 5: [], 6: [] },
  overrides: {}, stepMin: 30, bufferMin: 0, minNoticeMin: 0, maxDaysAhead: 14, ...over
});
// Monday 19 October 2026, 08:00 in Bangkok
const MON = Z('2026-10-19T01:00:00Z');
const times = (slots, zone = BKK) => slots.map(s => C.formatTime(s.start, zone));

// ---------- dates and zones ----------

test('calendar date helpers', () => {
  assert.equal(C.addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(C.addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(C.weekdayOf('2026-10-20'), 2);
  assert.equal(C.addMonths('2026-03-31', -1), '2026-02-28');
  assert.equal(C.addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(C.addMonths('2026-12-15', 1), '2027-01-15');
  assert.equal(C.daysBetween('2026-10-20', '2026-11-17'), 28);
  assert.equal(C.toMinutes('13:30'), 810);
  assert.equal(C.fromMinutes(545), '09:05');
  assert.throws(() => C.toMinutes('9.30'));
});

test('Bangkok wall time to UTC, no daylight saving', () => {
  assert.equal(C.zonedToUtc('2026-10-20', 9 * 60, BKK), Z('2026-10-20T02:00:00Z'));
  assert.equal(C.offsetMinutes(Z('2026-06-01T00:00:00Z'), BKK), 420);
  assert.equal(C.offsetMinutes(Z('2026-12-01T00:00:00Z'), BKK), 420);
  assert.equal(C.offsetLabel(Z('2026-12-01T00:00:00Z'), BKK), 'UTC+7');
});

test('London offsets around both 2026 clock changes', () => {
  assert.equal(C.offsetMinutes(Z('2026-03-29T00:59:00Z'), LON), 0);
  assert.equal(C.offsetMinutes(Z('2026-03-29T01:00:00Z'), LON), 60);
  assert.equal(C.offsetMinutes(Z('2026-10-25T00:59:00Z'), LON), 60);
  assert.equal(C.offsetMinutes(Z('2026-10-25T01:00:00Z'), LON), 0);
  assert.equal(C.offsetLabel(Z('2026-07-01T12:00:00Z'), LON), 'UTC+1');
  assert.equal(C.offsetLabel(Z('2026-12-01T12:00:00Z'), LON), 'UTC');
  assert.equal(C.offsetLabel(Z('2026-12-01T12:00:00Z'), NY), 'UTC-5');
  assert.equal(C.offsetLabel(Z('2026-12-01T12:00:00Z'), 'Asia/Kolkata'), 'UTC+5:30');
});

test('a London time skipped by the spring change returns null', () => {
  assert.equal(C.zonedToUtc('2026-03-29', 90, LON), null);
  assert.equal(C.zonedToUtc('2026-03-29', 60, LON), null);
  assert.equal(C.zonedToUtc('2026-03-29', 30, LON), Z('2026-03-29T00:30:00Z'));
  assert.equal(C.zonedToUtc('2026-03-29', 120, LON), Z('2026-03-29T01:00:00Z'));
});

test('a London time repeated by the autumn change returns the first one', () => {
  assert.equal(C.zonedToUtc('2026-10-25', 90, LON), Z('2026-10-25T00:30:00Z'));
  assert.equal(C.zonedToUtc('2026-10-25', 120, LON), Z('2026-10-25T02:00:00Z'));
  assert.equal(C.zonedToUtc('2026-10-24', 600, LON), Z('2026-10-24T09:00:00Z'));
  assert.equal(C.zonedToUtc('2026-10-26', 600, LON), Z('2026-10-26T10:00:00Z'));
});

test('offsetChanges finds the clock change dates', () => {
  assert.deepEqual(C.offsetChanges('2026-03-20', '2026-04-05', LON), [{ date: '2026-03-29', before: 0, after: 60 }]);
  assert.deepEqual(C.offsetChanges('2026-10-20', '2026-11-17', LON), [{ date: '2026-10-25', before: 60, after: 0 }]);
  assert.deepEqual(C.offsetChanges('2026-10-20', '2026-11-17', NY), [{ date: '2026-11-01', before: -240, after: -300 }]);
  assert.deepEqual(C.offsetChanges('2026-10-20', '2026-11-17', BKK), []);
});

test('formatting', () => {
  assert.equal(C.formatDateLong('2026-10-22'), 'Thursday 22 October');
  assert.equal(C.formatMonth(2026, 10), 'October 2026');
  assert.equal(C.formatTime(Z('2026-10-20T02:00:00Z'), BKK), '09:00');
  assert.equal(C.isValidZone('Europe/London'), true);
  assert.equal(C.isValidZone('Mars/Olympus'), false);
});

// ---------- rules and overrides ----------

test('weekly hours, merged and sorted', () => {
  assert.deepEqual(C.hoursForDate(base(), '2026-10-20'), [[540, 720], [780, 1080]]);
  assert.deepEqual(C.hoursForDate(base(), '2026-10-19'), []);
  assert.deepEqual(C.mergeIntervals([[600, 700], [540, 610], [800, 800], [700, 720]]), [[540, 720]]);
});

test('overrides close a day, replace hours or add extra hours', () => {
  const cfg = base({ overrides: {
    '2026-10-20': { closed: true },
    '2026-10-21': { hours: [['14:00', '16:00']] },
    '2026-10-27': { extra: [['18:00', '20:00'], ['11:30', '13:30']] },
    '2026-10-19': { hours: [['10:00', '12:00']] }
  } });
  assert.deepEqual(C.hoursForDate(cfg, '2026-10-20'), []);
  assert.deepEqual(C.hoursForDate(cfg, '2026-10-21'), [[840, 960]]);
  // 11:30 to 13:30 bridges the lunch break and 18:00 to 20:00 touches closing time
  assert.deepEqual(C.hoursForDate(cfg, '2026-10-27'), [[540, 1200]]);
  assert.deepEqual(C.hoursForDate(cfg, '2026-10-19'), [[600, 720]]);
  const slots = C.generateSlots({ config: cfg, service: svc(60), now: MON });
  assert.equal(slots.filter(s => s.date === '2026-10-20').length, 0);
  assert.deepEqual(times(slots.filter(s => s.date === '2026-10-21')), ['14:00', '14:30', '15:00']);
  assert.deepEqual(times(slots.filter(s => s.date === '2026-10-19')), ['10:00', '10:30', '11:00']);
});

// ---------- slot generation ----------

test('slots fill each window on the step and never cross a break', () => {
  const slots = C.generateSlots({ config: base(), service: svc(60), now: MON }).filter(s => s.date === '2026-10-20');
  assert.deepEqual(times(slots), ['09:00', '09:30', '10:00', '10:30', '11:00', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00']);
  assert.equal(slots[0].start, Z('2026-10-20T02:00:00Z'));
  assert.equal(slots[0].end - slots[0].start, 3600000);
});

test('a service longer than every window gets no slots', () => {
  const slots = C.generateSlots({ config: base(), service: svc(240), now: MON }).filter(s => s.date === '2026-10-20');
  assert.deepEqual(times(slots), ['13:00', '13:30', '14:00']);
  const wed = C.generateSlots({ config: base(), service: svc(240), now: MON }).filter(s => s.date === '2026-10-21');
  assert.equal(wed.length, 0);
});

test('minimum notice hides slots that start too soon', () => {
  const now = Z('2026-10-20T01:10:00Z'); // 08:10 on Tuesday in Bangkok
  const slots = C.generateSlots({ config: base({ minNoticeMin: 180 }), service: svc(30), now }).filter(s => s.date === '2026-10-20');
  assert.equal(times(slots)[0], '11:30');
  const none = C.generateSlots({ config: base({ minNoticeMin: 0 }), service: svc(30), now: Z('2026-10-20T11:00:00Z') }).filter(s => s.date === '2026-10-20');
  assert.equal(none.length, 0);
});

test('max days ahead stops on the last bookable day', () => {
  const slots = C.generateSlots({ config: base({ maxDaysAhead: 8 }), service: svc(30), now: MON });
  const dates = [...new Set(slots.map(s => s.date))];
  assert.deepEqual(dates, ['2026-10-20', '2026-10-21', '2026-10-27']);
  assert.equal(C.generateSlots({ config: base({ maxDaysAhead: 9 }), service: svc(30), now: MON }).some(s => s.date === '2026-10-28'), true);
});

test('buffer time keeps a gap either side of a booking', () => {
  const booking = { id: 'b1', serviceId: 's60', start: Z('2026-10-20T03:00:00Z'), end: Z('2026-10-20T04:00:00Z'), status: 'confirmed' }; // 10:00 to 11:00
  const day = cfg => times(C.generateSlots({ config: cfg, service: svc(30), bookings: [booking], now: MON }).filter(s => s.date === '2026-10-20' && s.minute < 720));
  assert.deepEqual(day(base({ bufferMin: 0 })), ['09:00', '09:30', '11:00', '11:30']);
  assert.deepEqual(day(base({ bufferMin: 15 })), ['09:00', '11:30']);
  assert.deepEqual(day(base({ bufferMin: 30 })), ['09:00', '11:30']);
  assert.deepEqual(day(base({ bufferMin: 31 })), []);
});

test('a cancelled booking gives its slot back', () => {
  const b = { id: 'b1', serviceId: 's60', start: Z('2026-10-20T03:00:00Z'), end: Z('2026-10-20T04:00:00Z'), status: 'cancelled' };
  const slots = C.generateSlots({ config: base(), service: svc(60), bookings: [b], now: MON });
  assert.ok(slots.some(s => s.start === b.start));
});

// ---------- display zones and daylight saving ----------

test('London visitor across the late March change', () => {
  const cfg = base({ weekly: { 0: [], 1: [], 2: [['09:00', '10:00']], 3: [], 4: [], 5: [], 6: [['09:00', '10:00']] }, maxDaysAhead: 10 });
  const slots = C.generateSlots({ config: cfg, service: svc(30), now: Z('2026-03-26T00:00:00Z') });
  const sat = slots.find(s => s.date === '2026-03-28' && s.minute === 540);
  const tue = slots.find(s => s.date === '2026-03-31' && s.minute === 540);
  assert.equal(C.formatTime(sat.start, LON), '02:00');
  assert.equal(C.offsetLabel(sat.start, LON), 'UTC');
  assert.equal(C.formatTime(tue.start, LON), '03:00');
  assert.equal(C.offsetLabel(tue.start, LON), 'UTC+1');
  // Same workshop time, so the gap is exactly three days in UTC
  assert.equal(tue.start - sat.start, 3 * 86400000);
});

test('London visitor across the late October change', () => {
  const slots = C.generateSlots({ config: base({ weekly: { ...base().weekly, 6: [['09:00', '10:00']] } }), service: svc(30), now: Z('2026-10-22T00:00:00Z') });
  const sat = slots.find(s => s.date === '2026-10-24' && s.minute === 540);
  const tue = slots.find(s => s.date === '2026-10-27' && s.minute === 540);
  assert.equal(C.formatTime(sat.start, LON), '03:00');
  assert.equal(C.formatTime(tue.start, LON), '02:00');
  assert.equal(C.formatTime(sat.start, BKK), C.formatTime(tue.start, BKK));
});

test('New York visitor sees evening slots on the previous date', () => {
  const slots = C.generateSlots({ config: base({ maxDaysAhead: 21 }), service: svc(60), now: MON });
  const byNy = C.groupByDate(slots, NY);
  const first = slots.find(s => s.date === '2026-11-03' && s.minute === 540);
  assert.equal(C.formatTime(first.start, NY), '21:00');
  assert.ok(byNy.get('2026-11-02').includes(first));
  assert.equal(C.offsetLabel(first.start, NY), 'UTC-5');
  // Before 1 November New York is on UTC-4, so the same workshop time reads 22:00
  const oct = slots.find(s => s.date === '2026-10-27' && s.minute === 540);
  assert.equal(C.formatTime(oct.start, NY), '22:00');
  // Every slot appears in exactly one display date
  assert.equal([...byNy.values()].reduce((n, l) => n + l.length, 0), slots.length);
});

test('business zone with its own clock changes skips and does not repeat times', () => {
  const cfg = base({ zone: LON, weekly: { 0: [['00:00', '04:00']], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }, maxDaysAhead: 3 });
  const spring = C.generateSlots({ config: cfg, service: svc(30), now: Z('2026-03-28T12:00:00Z') });
  assert.deepEqual(times(spring, LON), ['00:00', '00:30', '02:00', '02:30', '03:00', '03:30']);
  const autumn = C.generateSlots({ config: cfg, service: svc(30), now: Z('2026-10-24T12:00:00Z') });
  assert.deepEqual(times(autumn, LON), ['00:00', '00:30', '01:00', '01:30', '02:00', '02:30', '03:00', '03:30']);
  const starts = autumn.map(s => s.start);
  assert.deepEqual(starts, [...new Set(starts)].sort((a, b) => a - b));
  assert.ok(autumn.every(s => s.end <= Z('2026-10-25T04:00:00Z')));
});

test('part of day labels', () => {
  assert.equal(C.partOfDay(120), 'Night');
  assert.equal(C.partOfDay(540), 'Morning');
  assert.equal(C.partOfDay(780), 'Afternoon');
  assert.equal(C.partOfDay(1290), 'Evening');
});

// ---------- details and bookings ----------

test('details validation', () => {
  const bad = C.validateDetails({ name: ' A ', email: 'nope@x', phone: '12', bike: 'Unicycle', notes: 'x'.repeat(501) });
  assert.equal(bad.ok, false);
  assert.deepEqual(Object.keys(bad.errors).sort(), ['bike', 'email', 'name', 'notes', 'phone']);
  const good = C.validateDetails({ name: '  Nok   P ', email: 'nok@example.com', phone: '+66 81 234 5678', bike: 'Road bike', notes: '' });
  assert.equal(good.ok, true);
  assert.equal(good.value.name, 'Nok P');
  assert.equal(good.value.phone, '+66812345678');
});

const details = { name: 'Test Person', email: 't@example.com', phone: '0812345678', bike: 'Road bike', notes: '' };
const services = [svc(60), svc(30)];

test('createBooking accepts a free slot and refuses a taken or invalid one', () => {
  const cfg = base({ bufferMin: 15 });
  const start = Z('2026-10-20T03:00:00Z');
  const r = C.createBooking({ config: cfg, services, bookings: [], now: MON, serviceId: 's60', start, details, id: 'abc123def' });
  assert.equal(r.ok, true);
  assert.equal(r.booking.end, start + 3600000);
  assert.equal(r.booking.ref, 'SB-123DEF');
  const again = C.createBooking({ config: cfg, services, bookings: r.bookings, now: MON, serviceId: 's30', start: Z('2026-10-20T04:00:00Z'), details, id: 'x2' });
  assert.equal(again.error, 'slot-taken');
  assert.equal(C.createBooking({ config: cfg, services, bookings: [], now: MON, serviceId: 's60', start, details: { ...details, email: '' }, id: 'x3' }).error, 'invalid');
  assert.equal(C.createBooking({ config: cfg, services, bookings: [], now: MON, serviceId: 's60', start: start + 60000, details, id: 'x4' }).error, 'slot-taken');
  assert.equal(C.createBooking({ config: cfg, services, bookings: [], now: MON, serviceId: 'nope', start, details, id: 'x5' }).error, 'unknown-service');
});

test('cancelBooking marks it cancelled once', () => {
  const list = [{ id: 'a', status: 'confirmed' }, { id: 'b', status: 'confirmed' }];
  const r = C.cancelBooking(list, 'a', 5);
  assert.equal(r.ok, true);
  assert.equal(r.bookings[0].status, 'cancelled');
  assert.equal(r.bookings[0].cancelledAt, 5);
  assert.equal(list[0].status, 'confirmed');
  assert.equal(C.cancelBooking(r.bookings, 'a', 6).ok, false);
  assert.equal(C.cancelBooking(r.bookings, 'zzz', 6).ok, false);
});

test('bookingsOnDate uses the workshop date and sorts', () => {
  const list = [
    { id: '2', start: Z('2026-10-20T08:00:00Z') },
    { id: '1', start: Z('2026-10-20T02:00:00Z') },
    { id: '3', start: Z('2026-10-20T18:00:00Z') }
  ];
  assert.deepEqual(C.bookingsOnDate(list, '2026-10-20', BKK).map(b => b.id), ['1', '2']);
  assert.deepEqual(C.bookingsOnDate(list, '2026-10-21', BKK).map(b => b.id), ['3']);
});

test('sanitizeBookings drops malformed records', () => {
  assert.deepEqual(C.sanitizeBookings('nope'), []);
  const ok = { id: 'a', serviceId: 'x', start: 1, end: 2 };
  assert.deepEqual(C.sanitizeBookings([ok, null, { id: 'b', serviceId: 'x', start: 3, end: 2 }, { id: 4, serviceId: 'x', start: 1, end: 2 }]), [ok]);
});

// ---------- calendar grid ----------

test('month grid starts on Monday', () => {
  const oct = C.monthGrid(2026, 10);
  assert.equal(oct.length, 5);
  assert.deepEqual(oct[0], [null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  assert.equal(oct[4][5], '2026-10-31');
  assert.equal(C.monthGrid(2026, 2).length, 5);
  assert.equal(C.monthGrid(2027, 2).length, 4);
  assert.equal(C.monthGrid(2026, 3).length, 6);
});

test('keyboard movement in the date grid', () => {
  assert.equal(C.moveDate('2026-10-22', 'ArrowRight'), '2026-10-23');
  assert.equal(C.moveDate('2026-10-22', 'ArrowLeft'), '2026-10-21');
  assert.equal(C.moveDate('2026-10-22', 'ArrowDown'), '2026-10-29');
  assert.equal(C.moveDate('2026-10-22', 'ArrowUp'), '2026-10-15');
  assert.equal(C.moveDate('2026-10-22', 'Home'), '2026-10-19');
  assert.equal(C.moveDate('2026-10-22', 'End'), '2026-10-25');
  assert.equal(C.moveDate('2026-10-31', 'PageDown'), '2026-11-30');
  assert.equal(C.moveDate('2026-10-22', 'PageUp', { shift: true }), '2025-10-22');
  assert.equal(C.moveDate('2026-10-20', 'ArrowLeft', { min: '2026-10-20' }), '2026-10-20');
  assert.equal(C.moveDate('2026-11-10', 'PageDown', { max: '2026-11-17' }), '2026-11-17');
  assert.equal(C.moveDate('2026-11-10', 'Tab'), null);
});

// ---------- iCalendar ----------

const sample = () => {
  const booking = { id: 'f3a9c2d1-0000-4abc-9def-1234567890ab', ref: 'SB-7890AB', start: Z('2026-10-27T06:30:00Z'), end: Z('2026-10-27T07:30:00Z'), bike: 'Road bike', notes: 'Brakes squeal; rear hub clicks, \\ check spokes.\nขอบคุณครับ ขอบคุณครับ ขอบคุณครับ ขอบคุณครับ' };
  const service = { name: 'Safety check and tune', duration: 60 };
  return C.buildIcs({ booking, service, business: BUSINESS, dtstamp: Z('2026-10-20T03:04:05.678Z') });
};

test('ics uses CRLF, ends with CRLF and has no bare line feeds', () => {
  const ics = sample();
  assert.ok(ics.endsWith('\r\n'));
  assert.equal(/[^\r]\n/.test(ics), false);
  assert.equal(/\r[^\n]/.test(ics), false);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:'));
});

test('ics lines are folded at 75 octets without splitting characters', () => {
  const ics = sample();
  const lines = ics.split('\r\n').slice(0, -1);
  const enc = new TextEncoder();
  for (const l of lines) assert.ok(enc.encode(l).length <= 75, 'line too long: ' + l);
  assert.ok(lines.some(l => l.startsWith(' ')), 'expected at least one folded line');
  for (const l of lines) assert.equal(l.includes('�'), false);
  const unfolded = C.unfoldIcs(ics);
  assert.ok(unfolded.includes('ขอบคุณครับ ขอบคุณครับ ขอบคุณครับ ขอบคุณครับ'));
});

test('ics times are UTC and the event has the required properties', () => {
  const u = C.unfoldIcs(sample()).split('\r\n');
  assert.ok(u.includes('DTSTART:20261027T063000Z'));
  assert.ok(u.includes('DTEND:20261027T073000Z'));
  assert.ok(u.includes('DTSTAMP:20261020T030405Z'));
  assert.ok(u.includes('UID:f3a9c2d1-0000-4abc-9def-1234567890ab@sandersaxbuilds.github.io'));
  assert.ok(u.includes('SUMMARY:Safety check and tune at Lamyai Cycle Workshop'));
  assert.ok(u.includes('LOCATION:Sample address\\, Chiang Mai\\, Thailand'));
  assert.deepEqual(u.filter(l => /^(BEGIN|END):/.test(l)), ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'END:VEVENT', 'END:VCALENDAR']);
});

test('ics text escaping', () => {
  assert.equal(C.icsEscape('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
  const desc = C.unfoldIcs(sample()).split('\r\n').find(l => l.startsWith('DESCRIPTION:'));
  assert.ok(desc.includes('Brakes squeal\\; rear hub clicks\\, \\\\ check spokes.\\n'));
});

test('foldLine edge lengths', () => {
  const a = 'X'.repeat(75);
  assert.equal(C.foldLine(a), a);
  const b = 'X'.repeat(76);
  assert.equal(C.foldLine(b), 'X'.repeat(75) + '\r\n X');
  const c = 'X'.repeat(75 + 74 + 1);
  assert.deepEqual(C.foldLine(c).split('\r\n').map(l => l.length), [75, 75, 2]);
  const thai = 'ก'.repeat(30); // 3 octets each, 90 octets
  const parts = C.foldLine(thai).split('\r\n');
  assert.equal(new TextEncoder().encode(parts[0]).length, 75);
  assert.equal(C.unfoldIcs(C.foldLine(thai)), thai);
});

// ---------- sample data ----------

test('sample overrides land on the expected weekdays', () => {
  const o = sampleOverrides('2026-10-20');
  const entries = Object.entries(o);
  assert.equal(entries.length, 3);
  const closed = entries.find(([, v]) => v.closed)[0];
  const late = entries.find(([, v]) => v.extra)[0];
  const monday = entries.find(([, v]) => v.hours)[0];
  assert.equal(C.weekdayOf(closed), 3);
  assert.equal(C.weekdayOf(late), 4);
  assert.equal(C.weekdayOf(monday), 1);
});

test('seed bookings respect the buffer and are all bookable rules', () => {
  const now = Z('2026-10-20T03:00:00Z');
  const config = makeConfig(now);
  const seeded = seedBookings(config, now);
  assert.equal(seeded.length, 4);
  const sorted = [...seeded].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i].start - sorted[i - 1].end >= config.bufferMin * 60000);
  assert.ok(seeded.every(b => b.sample === true && b.status === 'confirmed'));
  // Seeded slots are gone from availability
  for (const b of seeded) {
    const service = SERVICES.find(s => s.id === b.serviceId);
    assert.equal(C.generateSlots({ config, service, bookings: seeded, now }).some(s => s.start === b.start), false);
  }
});
