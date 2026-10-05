export const CALENDARS = ["work", "personal", "family"];

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

export function formatClock(value) {
  const minutes = timeMinutes(value);
  if (minutes === null) throw new TypeError("Invalid time");
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
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
  if (start !== null && Number.isFinite(duration) && start + duration >= 24 * 60) errors.duration = "End the block before midnight.";
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

export function findFocusSlot(events, key, duration, options = {}) {
  const windowStart = options.windowStart ?? 9 * 60;
  const windowEnd = options.windowEnd ?? 17 * 60;
  const notBefore = options.notBefore ?? 0;
  if (!parseDateKey(key) || !Number.isInteger(duration) || duration < 15 || duration > 240 ||
      !Number.isInteger(windowStart) || !Number.isInteger(windowEnd) || windowStart < 0 || windowEnd > 1440 || windowStart >= windowEnd) {
    throw new TypeError("Invalid focus search");
  }
  const busy = eventsForDate(events, key).map(event => ({ start: timeMinutes(event.start), end: timeMinutes(event.start) + event.duration }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
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
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 1440) throw new TypeError("Invalid minutes");
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
