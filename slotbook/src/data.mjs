// Sample data for a fictional workshop. Nothing here describes a real business.
import { addDays, weekdayOf, dateInZone, generateSlots, createBooking } from './core.mjs';

export const BUSINESS = {
  name: 'Lamyai Cycle Workshop',
  address: 'Sample address, Chiang Mai, Thailand',
  zone: 'Asia/Bangkok'
};

export const SERVICES = [
  { id: 'puncture', name: 'Puncture repair', duration: 30, price: 250, blurb: 'Tube or tubeless, one wheel, while you wait.' },
  { id: 'tuneup', name: 'Safety check and tune', duration: 60, price: 650, blurb: 'Brakes, gears, bearings and a full bolt check.' },
  { id: 'fit', name: 'Bike fit', duration: 90, price: 1500, blurb: 'Saddle, bars and cleats set on the trainer.' },
  { id: 'overhaul', name: 'Full overhaul', duration: 180, price: 3200, blurb: 'Strip, clean, regrease and rebuild. Bring the bike early.' }
];

// Weekly hours, keyed by weekday with Sunday as 0. Closed on Mondays.
export const WEEKLY = {
  0: [['10:00', '14:00']],
  1: [],
  2: [['09:00', '12:00'], ['13:00', '18:00']],
  3: [['09:00', '12:00'], ['13:00', '18:00']],
  4: [['09:00', '12:00'], ['13:00', '18:00']],
  5: [['09:00', '12:00'], ['13:00', '18:00']],
  6: [['09:00', '16:00']]
};

const nextWeekday = (from, wd) => { let d = from; while (weekdayOf(d) !== wd) d = addDays(d, 1); return d; };

// Date overrides placed relative to today so the sample always shows them.
export function sampleOverrides(today) {
  const late = nextWeekday(addDays(today, 3), 4);
  const closed = nextWeekday(addDays(today, 8), 3);
  const monday = nextWeekday(addDays(today, 12), 1);
  return {
    [late]: { extra: [['18:00', '20:00']], note: 'Late opening until 20:00' },
    [closed]: { closed: true, note: 'Closed for staff training' },
    [monday]: { hours: [['10:00', '15:00']], note: 'Open on a Monday for a club service day' }
  };
}

export function makeConfig(now) {
  return {
    zone: BUSINESS.zone,
    weekly: WEEKLY,
    overrides: sampleOverrides(dateInZone(now, BUSINESS.zone)),
    stepMin: 30,
    bufferMin: 15,
    minNoticeMin: 180,
    maxDaysAhead: 28
  };
}

export const ZONES = [
  { id: 'Asia/Bangkok', label: 'Chiang Mai, workshop time' },
  { id: 'Europe/London', label: 'London' },
  { id: 'America/New_York', label: 'New York' },
  { id: 'Australia/Sydney', label: 'Sydney' }
];

const PEOPLE = [
  { name: 'Sample customer Arthit K', email: 'arthit@example.com', phone: '0812345601', bike: 'Road bike', notes: 'Rear shifting skips under load.' },
  { name: 'Sample customer Ploy S', email: 'ploy@example.com', phone: '0812345602', bike: 'City or folding bike', notes: '' },
  { name: 'Sample customer Dan W', email: 'dan@example.com', phone: '+447700900123', bike: 'Mountain bike', notes: 'Fork service if there is time.' },
  { name: 'Sample customer Mai T', email: 'mai@example.com', phone: '0812345604', bike: 'Electric bike', notes: '' }
];

// A few bookings on the next open days, made through the same rules as a visitor.
export function seedBookings(config, now) {
  let bookings = [];
  const plan = [['tuneup', 0, 2], ['puncture', 0, 8], ['overhaul', 1, 0], ['fit', 1, 9]];
  const days = [...new Set(generateSlots({ config, service: SERVICES[0], now }).map(s => s.date))].slice(1, 3);
  plan.forEach(([serviceId, dayIndex, pick], i) => {
    const service = SERVICES.find(s => s.id === serviceId);
    const slots = generateSlots({ config, service, bookings, now }).filter(s => s.date === days[dayIndex]);
    const slot = slots[Math.min(pick, slots.length - 1)];
    if (!slot) return;
    const r = createBooking({ config, services: SERVICES, bookings, now, serviceId, start: slot.start, details: PEOPLE[i], id: 'sample-' + (i + 1) + '-' + slot.start.toString(36) });
    if (r.ok) bookings = r.bookings.map(b => b.id === r.booking.id ? { ...b, sample: true } : b);
  });
  return bookings;
}
