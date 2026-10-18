export const CALENDARS = ["work", "personal", "family"];
export const DAY_MINUTES = 24 * 60;

export function dateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TypeError("Invalid date");
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function parseDateKey(key) {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [year, month, day] = key.split("-").map(Number);
  if (year < 1) return null;
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function shiftDate(key, days) {
  const date = parseDateKey(key);
  if (!date || !Number.isInteger(days)) throw new TypeError("Invalid date shift");
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export function weekDates(key) {
  const date = parseDateKey(key);
  if (!date) throw new TypeError("Invalid week date");
  const offset = (date.getDay() + 6) % 7;
  const monday = shiftDate(key, -offset);
  return Array.from({ length: 7 }, (_, index) => shiftDate(monday, index));
}

export function timeMinutes(value) {
  if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

// Formats minutes after midnight. 1440 is the end of the day and reads as midnight.
export function formatMinutes(minutes) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > DAY_MINUTES) throw new TypeError("Invalid minutes");
  const hour = Math.floor(minutes / 60) % 24;
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

export function formatClock(value) {
  const minutes = timeMinutes(value);
  if (minutes === null) throw new TypeError("Invalid time");
  return formatMinutes(minutes);
}

export function eventEnd(event) {
  return timeMinutes(event.start) + Number(event.duration);
}

export function validateEvent(input) {
  const errors = {};
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const start = timeMinutes(input.start);
  const duration = Number(input.duration);
  if (title.length < 2 || title.length > 70) errors.title = "Use 2 to 70 characters.";
  if (!parseDateKey(input.date)) errors.date = "Choose a valid date.";
  if (start === null) errors.start = "Choose a valid start time.";
  if (!Number.isInteger(duration) || duration < 15 || duration > 240 || duration % 15 !== 0) errors.duration = "Choose 15 to 240 minutes in 15-minute steps.";
  else if (start !== null && start + duration > DAY_MINUTES) errors.duration = "End the block by midnight.";
  if (!CALENDARS.includes(input.calendar)) errors.calendar = "Choose a calendar.";
  return { ok: Object.keys(errors).length === 0, errors, value: { ...input, title, duration, protected: Boolean(input.protected) } };
}

export function overlappingEvents(event, events) {
  const start = timeMinutes(event.start);
  if (start === null) return [];
  const end = start + Number(event.duration);
  return events.filter(other => {
    if (other.id === event.id || other.date !== event.date) return false;
    const otherStart = timeMinutes(other.start);
    return otherStart !== null && start < otherStart + Number(other.duration) && otherStart < end;
  });
}

export function eventsForDate(events, key, visibleCalendars = CALENDARS) {
  return events.filter(event => event.date === key && visibleCalendars.includes(event.calendar))
    .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
}

export function dailySummary(events, key) {
  const day = eventsForDate(events, key);
  return {
    blocks: day.length,
    plannedMinutes: day.reduce((sum, event) => sum + event.duration, 0),
    protectedMinutes: day.reduce((sum, event) => sum + (event.protected ? event.duration : 0), 0),
  };
}

// Merged busy intervals for one date across every calendar, hidden ones included.
export function busyIntervals(events, key) {
  const sorted = eventsForDate(events, key).map(event => ({ start: timeMinutes(event.start), end: eventEnd(event) }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [];
  for (const block of sorted) {
    const last = merged.at(-1);
    if (last && block.start <= last.end) last.end = Math.max(last.end, block.end);
    else merged.push({ ...block });
  }
  return merged;
}

// Open stretches of at least minLength minutes inside a window, after merging every block.
export function freeGaps(events, key, options = {}) {
  const windowStart = options.windowStart ?? 8 * 60;
  const windowEnd = options.windowEnd ?? 18 * 60;
  const minLength = options.minLength ?? 30;
  if (!parseDateKey(key) || !Number.isInteger(windowStart) || !Number.isInteger(windowEnd) || windowStart < 0 || windowEnd > DAY_MINUTES || windowStart >= windowEnd) throw new TypeError("Invalid gap search");
  const gaps = [];
  let cursor = windowStart;
  for (const block of busyIntervals(events, key)) {
    if (block.end <= cursor) continue;
    if (block.start >= windowEnd) break;
    if (block.start - cursor >= minLength) gaps.push({ start: cursor, end: block.start });
    cursor = Math.max(cursor, block.end);
  }
  if (windowEnd - cursor >= minLength) gaps.push({ start: cursor, end: windowEnd });
  return gaps.map(gap => ({ ...gap, minutes: gap.end - gap.start }));
}

export function findFocusSlot(events, key, duration, options = {}) {
  const windowStart = options.windowStart ?? 9 * 60;
  const windowEnd = options.windowEnd ?? 17 * 60;
  const notBefore = options.notBefore ?? 0;
  if (!parseDateKey(key) || !Number.isInteger(duration) || duration < 15 || duration > 240 ||
      !Number.isInteger(windowStart) || !Number.isInteger(windowEnd) || windowStart < 0 || windowEnd > DAY_MINUTES || windowStart >= windowEnd) {
    throw new TypeError("Invalid focus search");
  }
  const busy = busyIntervals(events, key);
  let cursor = Math.max(windowStart, notBefore);
  cursor = Math.ceil(cursor / 15) * 15;
  for (const block of busy) {
    if (block.end <= cursor) continue;
    if (cursor + duration <= block.start && cursor + duration <= windowEnd) return cursor;
    cursor = Math.ceil(Math.max(cursor, block.end) / 15) * 15;
    if (cursor + duration > windowEnd) return null;
  }
  return cursor + duration <= windowEnd ? cursor : null;
}

export function minutesToTime(minutes) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= DAY_MINUTES) throw new TypeError("Invalid minutes");
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function safeStoredEvents(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw.filter(item => {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || seen.has(item.id)) return false;
    const result = validateEvent(item);
    if (!result.ok) return false;
    seen.add(item.id);
    return true;
  }).map(item => validateEvent(item).value);
}

// Reads a stored plan. Returns the usable part and how many blocks had to be left out,
// so one damaged block no longer hides the whole plan.
export function recoverStoredPlan(rawText) {
  let value;
  try { value = JSON.parse(rawText); } catch { return { status: "unreadable", dropped: 0 }; }
  if (!value || typeof value !== "object" || value.schemaVersion !== 1 || !Array.isArray(value.events)) return { status: "unreadable", dropped: 0 };
  const events = safeStoredEvents(value.events).map(({ id, date, title, start, duration, calendar, protected: protectedTime }) => ({ id, date, title, start, duration, calendar, protected: protectedTime }));
  const filters = Array.isArray(value.filters) ? [...new Set(value.filters.filter(name => CALENDARS.includes(name)))] : [...CALENDARS];
  const plan = {
    ...value,
    events,
    selectedDate: parseDateKey(value.selectedDate) ? value.selectedDate : null,
    view: ["day", "week"].includes(value.view) ? value.view : "day",
    filters,
    revision: Number.isSafeInteger(value.revision) ? value.revision : 0,
  };
  const dropped = value.events.length - events.length;
  return { status: dropped ? "partial" : "ok", dropped, plan };
}

// A fictional week for a design lead at a small studio, placed in the week that contains anchorKey.
export function samplePlan(anchorKey) {
  const monday = weekDates(anchorKey)[0];
  const rows = [
    [0, "08:15", 30, "family", "School drop-off"],
    [0, "09:00", 90, "work", "Write the Q4 pricing proposal", true],
    [0, "10:45", 30, "work", "Studio stand-up"],
    [0, "12:30", 45, "personal", "Lunch walk by the river"],
    [0, "14:00", 60, "work", "Marlow Bakery menu review"],
    [0, "15:30", 30, "family", "Pick up Theo from swim class"],
    [0, "15:45", 30, "work", "Call with the print shop"],
    [1, "07:00", 45, "personal", "Run along the canal"],
    [1, "09:00", 120, "work", "Homepage wireframes", true],
    [1, "11:30", 60, "work", "Interview for the junior designer role"],
    [1, "13:00", 30, "personal", "Pharmacy pickup"],
    [1, "16:00", 60, "family", "Parent-teacher meeting"],
    [2, "09:00", 60, "work", "Sprint planning"],
    [2, "10:30", 90, "work", "Design system tokens", true],
    [2, "13:30", 45, "work", "Invoice review with Priya"],
    [2, "17:30", 60, "personal", "Climbing gym"],
    [3, "08:15", 30, "family", "School drop-off"],
    [3, "09:30", 30, "work", "One-to-one with Sam"],
    [3, "10:00", 120, "work", "Marlow Bakery revisions", true],
    [3, "14:00", 45, "personal", "Dentist"],
    [3, "15:00", 60, "work", "Portfolio photo shoot"],
    [4, "09:00", 60, "work", "Weekly planning and inbox", true],
    [4, "11:00", 60, "work", "Design critique"],
    [4, "12:30", 60, "personal", "Lunch with Ana"],
    [4, "15:00", 45, "work", "Send October invoices"],
    [4, "18:30", 120, "family", "Pizza and movie night"],
    [5, "09:30", 90, "family", "Farmers market with the kids"],
    [5, "14:00", 60, "personal", "Bike service"],
    [6, "12:00", 120, "family", "Grandma's birthday lunch"],
    [6, "19:00", 45, "personal", "Plan next week"],
    [7, "10:00", 60, "work", "Marlow Bakery launch check-in"],
  ];
  return rows.map(([offset, start, duration, calendar, title, protectedTime = false], index) => ({
    id: `sample-${index + 1}`, date: shiftDate(monday, offset), title, start, duration, calendar, protected: protectedTime,
  }));
}

export function newId() {
  if (globalThis.crypto?.randomUUID) {
    try { return globalThis.crypto.randomUUID(); } catch { /* insecure context */ }
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
