import { CALENDARS, dateKey, parseDateKey, shiftDate, weekDates, timeMinutes, minutesToTime, formatClock, validateEvent, overlappingEvents, eventsForDate, dailySummary, safeStoredEvents, findFocusSlot } from "./daybreak-model.mjs";
import { readBackup, writeBackup } from "./daybreak-backup.mjs";

const STORE_KEY = "daybreak.phase-one-proof.v1";
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const todayKey = () => dateKey(new Date());
const formatDate = (key, options = { weekday: "long", month: "long", day: "numeric", year: "numeric" }) => parseDateKey(key).toLocaleDateString("en-US", options);
const formatDuration = minutes => minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}` : `${minutes}m`;

function samplePlan(anchor) {
  const block = (id, offset, title, start, duration, calendar, protectedTime = false) => ({ id, date: shiftDate(anchor, offset), title, start, duration, calendar, protected: protectedTime });
  return [
    block("sample-1", 0, "Plan the product story", "09:00", 60, "work", true),
    block("sample-2", 0, "Review sketches", "10:00", 30, "work"),
    block("sample-3", 0, "Lunch break", "12:00", 45, "personal"),
    block("sample-4", 0, "School pickup", "15:30", 30, "family"),
    block("sample-5", 0, "Team check-in", "16:15", 30, "work"),
    block("sample-6", 1, "Prepare presentation", "09:00", 60, "work", true),
    block("sample-7", 1, "Family time", "15:30", 30, "family"),
    block("sample-8", 7, "Review next steps", "11:00", 45, "work"),
  ];
}

function initialState() {
  const anchor = todayKey();
  return { schemaVersion: 1, revision: 0, sampleAnchorDate: anchor, events: samplePlan(anchor), selectedDate: anchor, view: "day", filters: [...CALENDARS], focusDuration: 50, meditationDuration: 2, session: null };
}

let storageProblem = "";
let readOnlyConflict = false;
function readState() {
  let raw;
  try {
    raw = localStorage.getItem(STORE_KEY);
  } catch (error) {
    storageProblem = "Changes are available for this visit only. This browser could not save them.";
    return initialState();
  }
  if (raw === null) {
    const fresh = initialState();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(fresh)); }
    catch (error) { storageProblem = "Changes are available for this visit only. This browser could not save them."; }
    return fresh;
  }
  try {
    const value = JSON.parse(raw);
    if (!value || value.schemaVersion !== 1 || !Array.isArray(value.events) || !parseDateKey(value.selectedDate) || !["day", "week"].includes(value.view) || !Array.isArray(value.filters)) throw new Error("Saved plan cannot be opened");
    const events = safeStoredEvents(value.events);
    if (events.length !== value.events.length) throw new Error("Saved plan contains invalid blocks");
    return { ...value, events, filters: value.filters.filter(name => CALENDARS.includes(name)), focusDuration: [25, 50, 90].includes(value.focusDuration) ? value.focusDuration : 50, meditationDuration: [1, 2, 5].includes(value.meditationDuration) ? value.meditationDuration : 2, session: validSession(value.session) ? value.session : null };
  } catch (error) {
    storageProblem = "This saved plan could not be opened. The stored copy has not been changed. Use Reset sample plan only if you want to replace it.";
    readOnlyConflict = true;
    return { ...initialState(), events: [] };
  }
}

function validSession(session) {
  return session && ["focus", "meditation"].includes(session.kind) && ["running", "paused", "finished"].includes(session.status) && Number.isFinite(session.remainingMs) && Number.isFinite(session.durationMs);
}

let state = readState();
let toastTimer;
let sessionInterval;
let suggestion = null;
let modalSnapshot = "";
let modalReturnFocus = null;
let overlapConfirmed = false;

function showStorageProblem(message) {
  storageProblem = message;
  $("#storageMessage").textContent = message;
  $("#storageBanner").hidden = false;
}
if (storageProblem) showStorageProblem(storageProblem);

function persist() {
  if (readOnlyConflict) { showStorageProblem("The plan changed in another tab or could not be opened. Reload before making more changes."); return false; }
  try {
    state.revision += 1;
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    $("#storageBanner").hidden = true;
    storageProblem = "";
    return true;
  } catch (error) {
    showStorageProblem("Changes are available for this visit only. This browser could not save them.");
    return false;
  }
}

function announce(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3300);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function visibleCalendars() { return state.filters; }

function renderHeader() {
  const date = parseDateKey(state.selectedDate);
  $("#weekdayLabel").textContent = date.toLocaleDateString("en-US", { weekday: "long" });
  $("#plannerHeading").textContent = state.view === "day" ? "Your day" : "Your week";
  $("#dateLabel").textContent = state.view === "day" ? formatDate(state.selectedDate) : `${formatDate(weekDates(state.selectedDate)[0], { month: "short", day: "numeric" })} to ${formatDate(weekDates(state.selectedDate)[6], { month: "short", day: "numeric", year: "numeric" })}`;
  $("#jumpDate").value = state.selectedDate;
  $("#previousDate").setAttribute("aria-label", state.view === "week" ? "Previous week" : "Previous day");
  $("#nextDate").setAttribute("aria-label", state.view === "week" ? "Next week" : "Next day");
  $("#dayView").hidden = state.view !== "day";
  $("#weekView").hidden = state.view !== "week";
  $("#dayViewButton").classList.toggle("is-active", state.view === "day");
  $("#weekViewButton").classList.toggle("is-active", state.view === "week");
  $("#dayViewButton").setAttribute("aria-pressed", String(state.view === "day"));
  $("#weekViewButton").setAttribute("aria-pressed", String(state.view === "week"));
  $("#navToday").classList.toggle("is-current", state.view === "day");
  $("#navWeek").classList.toggle("is-current", state.view === "week");
  $("#navToday").removeAttribute("aria-current"); $("#navWeek").removeAttribute("aria-current");
  (state.view === "day" ? $("#navToday") : $("#navWeek")).setAttribute("aria-current", "page");
  $$('[data-calendar]').forEach(input => { input.checked = state.filters.includes(input.dataset.calendar); });
}

function eventRange(event) {
  return `${formatClock(event.start)} to ${formatClock(minutesToTime(timeMinutes(event.start) + event.duration))}`;
}

function renderDay() {
  const all = eventsForDate(state.events, state.selectedDate);
  const shown = eventsForDate(state.events, state.selectedDate, visibleCalendars());
  const summary = dailySummary(state.events, state.selectedDate);
  const stats = $("#dayStats"); stats.replaceChildren();
  [["blocks", String(summary.blocks)], ["planned", formatDuration(summary.plannedMinutes)], ["protected", formatDuration(summary.protectedMinutes)]].forEach(([label, count]) => { const chip = element("span", "stat-chip"); chip.append(element("strong", "", count), document.createTextNode(label)); stats.append(chip); });
  $("#visibleCount").textContent = `${shown.length} of ${all.length} blocks shown`;
  const agenda = $("#dayAgenda"); agenda.replaceChildren();
  shown.forEach(item => {
    const conflicts = overlappingEvents(item, state.events);
    const card = element("button", `agenda-card ${item.calendar}`);
    card.type = "button";
    card.setAttribute("aria-label", `${item.title}, ${formatDate(item.date)}, ${eventRange(item)}, ${item.calendar} calendar${conflicts.length ? ", overlaps another block" : ""}. Edit block.`);
    const time = element("span", "agenda-time", formatClock(item.start));
    time.append(element("small", "", formatClock(minutesToTime(timeMinutes(item.start) + item.duration))));
    const body = element("span", "agenda-body"); body.append(element("strong", "", item.title), element("span", "", `${capitalize(item.calendar)} · ${formatDuration(item.duration)}`));
    card.append(time, body);
    if (conflicts.length) card.append(element("span", "agenda-badge", `Overlaps ${conflicts.length} block${conflicts.length > 1 ? "s" : ""}`));
    else if (item.protected) card.append(element("span", "agenda-badge focus", "Protected focus"));
    card.addEventListener("click", () => openEditor(item));
    agenda.append(card);
  });
  $("#dayEmpty").hidden = shown.length > 0;
  if (!shown.length) {
    const allHidden = !state.filters.length;
    $("#emptyTitle").textContent = allHidden ? "All calendars are hidden." : all.length ? "No blocks match these calendars." : `Nothing planned for ${formatDate(state.selectedDate, { weekday: "long", month: "long", day: "numeric" })}.`;
    $("#emptyDescription").textContent = all.length ? "The blocks are still saved. Change your filters to see them." : "Add a block when you know what needs your attention.";
    $("#showAllCalendars").hidden = !all.length;
  }
  $("#summaryTitle").textContent = state.selectedDate === todayKey() ? "Today's plan" : "Selected day's plan";
  const rows = $("#summaryRows"); rows.replaceChildren();
  [["Blocks entered", String(summary.blocks)], ["Planned time", formatDuration(summary.plannedMinutes)], ["Protected time", formatDuration(summary.protectedMinutes)]].forEach(([label, value]) => { const row = element("div", "summary-row"); row.append(element("span", "", label), element("strong", "", value)); rows.append(row); });
}

function renderWeek() {
  const grid = $("#weekGrid"); grid.replaceChildren();
  weekDates(state.selectedDate).forEach(key => {
    const day = element("button", `week-day${key === state.selectedDate ? " is-selected" : ""}`);
    day.type = "button";
    day.setAttribute("aria-label", `Open ${formatDate(key)} in day view`);
    day.append(element("h3", "", formatDate(key, { weekday: "long" })), element("span", "day-number", formatDate(key, { month: "short", day: "numeric" })));
    const blocks = eventsForDate(state.events, key, visibleCalendars());
    if (!blocks.length) day.append(element("span", "week-empty", "No visible blocks"));
    blocks.forEach(item => { const row = element("span", `week-event ${item.calendar}`, item.title); row.prepend(element("small", "", formatClock(item.start))); day.append(row); });
    day.addEventListener("click", () => { state.selectedDate = key; state.view = "day"; persist(); render(); announce(`Showing ${formatDate(key)}.`); });
    grid.append(day);
  });
}

function capitalize(value) { return value[0].toUpperCase() + value.slice(1); }
function render() {
  if (suggestion && suggestion.revision !== state.revision) {
    suggestion = null;
    $("#focusSuggestion").textContent = "Find a clear interval in your entered plan. Hidden calendars still count.";
    $("#addSuggestedBlock").hidden = true;
  }
  renderHeader(); renderDay(); renderWeek(); renderSession();
}

function chooseView(view) { state.view = view; persist(); render(); }
$("#dayViewButton").addEventListener("click", () => chooseView("day"));
$("#weekViewButton").addEventListener("click", () => chooseView("week"));
$("#navToday").addEventListener("click", () => { chooseView("day"); closeMobileMenu(); });
$("#navWeek").addEventListener("click", () => { chooseView("week"); closeMobileMenu(); });
$("#previousDate").addEventListener("click", () => { state.selectedDate = shiftDate(state.selectedDate, state.view === "week" ? -7 : -1); persist(); render(); });
$("#nextDate").addEventListener("click", () => { state.selectedDate = shiftDate(state.selectedDate, state.view === "week" ? 7 : 1); persist(); render(); });
$("#todayDate").addEventListener("click", () => { state.selectedDate = todayKey(); persist(); render(); });
$("#jumpDate").addEventListener("change", event => { if (!parseDateKey(event.target.value)) return; state.selectedDate = event.target.value; persist(); render(); });
$$('[data-calendar]').forEach(input => input.addEventListener("change", () => { state.filters = $$('[data-calendar]:checked').map(item => item.dataset.calendar); persist(); render(); }));
$("#showAllCalendars").addEventListener("click", () => { state.filters = [...CALENDARS]; persist(); render(); });
$("#mobileMenu").addEventListener("click", () => { const open = $("#sidebar").classList.toggle("is-open"); $("#mobileMenu").setAttribute("aria-expanded", String(open)); });
function closeMobileMenu() { $("#sidebar").classList.remove("is-open"); $("#mobileMenu").setAttribute("aria-expanded", "false"); }

function formValue() {
  return { id: $("#eventId").value || crypto.randomUUID(), title: $("#eventTitle").value, date: $("#eventDate").value, start: $("#eventStart").value, duration: Number($("#eventDuration").value), calendar: $("#eventCalendar").value, protected: $("#eventProtected").checked };
}
function formSnapshot() { return JSON.stringify({ title: $("#eventTitle").value, date: $("#eventDate").value, start: $("#eventStart").value, duration: $("#eventDuration").value, calendar: $("#eventCalendar").value, protected: $("#eventProtected").checked }); }
function defaultStart() { return "09:00"; }
function openEditor(item = null, date = state.selectedDate, start = defaultStart(), protectedTime = false) {
  modalReturnFocus = document.activeElement;
  overlapConfirmed = false;
  $("#eventId").value = item?.id ?? "";
  $("#eventTitle").value = item?.title ?? "";
  $("#eventDate").value = item?.date ?? date;
  $("#eventStart").value = item?.start ?? start;
  $("#eventDuration").value = String(item?.duration ?? 30);
  $("#eventCalendar").value = item?.calendar ?? "work";
  $("#eventProtected").checked = item?.protected ?? protectedTime;
  $("#dialogTitle").textContent = item ? "Edit this block." : "Make room for something.";
  $("#saveEvent").textContent = item ? "Save changes" : "Add block";
  $("#deleteEvent").hidden = !item;
  $("#overlapWarning").hidden = true;
  $$(".field-error").forEach(node => node.textContent = "");
  $$("#eventForm input, #eventForm select").forEach(node => node.removeAttribute("aria-invalid"));
  $("#eventDialog").hidden = false;
  modalSnapshot = formSnapshot();
  document.body.style.overflow = "hidden";
  $(".shell").inert = true;
  $("#eventTitle").focus();
}
function closeEditor(force = false) {
  if (!force && formSnapshot() !== modalSnapshot && !window.confirm("Discard your unsaved changes?")) return;
  $("#eventDialog").hidden = true;
  document.body.style.overflow = "";
  $(".shell").inert = false;
  (modalReturnFocus?.isConnected ? modalReturnFocus : $("#addEvent")).focus();
}
$("#addEvent").addEventListener("click", () => openEditor());
$("#emptyAdd").addEventListener("click", () => openEditor());
$("#dialogClose").addEventListener("click", () => closeEditor());
$("#eventDialog").addEventListener("click", event => { if (event.target === $("#eventDialog")) closeEditor(); });
document.addEventListener("keydown", event => {
  if ($( "#eventDialog").hidden) return;
  if (event.key === "Escape") { event.preventDefault(); closeEditor(); }
  if (event.key !== "Tab") return;
  const controls = $$("#eventDialog button, #eventDialog input:not([type=hidden]), #eventDialog select").filter(node => !node.hidden && !node.disabled);
  if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
  else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
});
$("#eventForm").addEventListener("input", () => { overlapConfirmed = false; $("#saveEvent").textContent = $("#eventId").value ? "Save changes" : "Add block"; });
$("#eventForm").addEventListener("submit", event => {
  event.preventDefault();
  if (readOnlyConflict) { showStorageProblem("Reload before editing this plan. Its saved copy was not changed."); return; }
  const result = validateEvent(formValue());
  $$(".field-error").forEach(node => node.textContent = "");
  if (!result.ok) {
    for (const [field, message] of Object.entries(result.errors)) { const error = $(`#${field}Error`); if (error) error.textContent = message; const input = $(`#event${capitalize(field)}`); if (input) input.setAttribute("aria-invalid", "true"); }
    const first = Object.keys(result.errors)[0]; $(`#event${capitalize(first)}`)?.focus(); return;
  }
  const conflicts = overlappingEvents(result.value, state.events);
  if (conflicts.length && !overlapConfirmed) {
    $("#overlapWarning").textContent = `Overlaps ${conflicts.map(item => `${item.title} (${capitalize(item.calendar)}, ${eventRange(item)})`).join(" and ")}. This may be intentional. Review before saving.`;
    $("#overlapWarning").hidden = false;
    $("#saveEvent").textContent = "Save with overlap";
    overlapConfirmed = true;
    return;
  }
  const existing = state.events.findIndex(item => item.id === result.value.id);
  if (existing >= 0) state.events[existing] = result.value;
  else state.events.push(result.value);
  state.selectedDate = result.value.date;
  const saved = persist();
  closeEditor(true); render();
  announce(saved ? "Block saved in this browser." : "Block changed for this visit only. Browser storage is unavailable.");
});
$("#deleteEvent").addEventListener("click", () => {
  const id = $("#eventId").value;
  const item = state.events.find(event => event.id === id);
  if (!item || !window.confirm(`Delete “${item.title}” on ${formatDate(item.date)}?`)) return;
  state.events = state.events.filter(event => event.id !== id);
  const saved = persist(); closeEditor(true); render(); announce(saved ? "Block deleted." : "Block removed for this visit only.");
});

$("#findFocusButton").addEventListener("click", () => {
  const now = new Date();
  const notBefore = state.selectedDate === todayKey() ? now.getHours() * 60 + now.getMinutes() : 0;
  const start = findFocusSlot(state.events, state.selectedDate, 25, { windowStart: 9 * 60, windowEnd: 18 * 60, notBefore });
  suggestion = start === null ? null : { date: state.selectedDate, start: minutesToTime(start), revision: state.revision };
  $("#focusSuggestion").textContent = suggestion ? `Available in this entered plan: ${formatClock(suggestion.start)} to ${formatClock(minutesToTime(start + 25))}. This checks all three calendars, even hidden ones, and does not account for travel or missing commitments.` : "No 25-minute gap remains between 9:00 AM and 6:00 PM in this entered plan. Try another day.";
  $("#addSuggestedBlock").hidden = !suggestion;
});
$("#addSuggestedBlock").addEventListener("click", () => { if (suggestion) openEditor(null, suggestion.date, suggestion.start, true); });

function currentRemaining(session, now = Date.now()) { return session.status === "running" ? Math.max(0, session.deadlineMs - now) : session.remainingMs; }
function clockText(ms) { const seconds = Math.ceil(Math.max(0, ms) / 1000); return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }
function finishExpiredSession() {
  if (state.session?.status === "running" && currentRemaining(state.session) <= 0) {
    state.session.status = "finished"; state.session.remainingMs = 0; state.session.deadlineMs = null;
    persist(); announce("Timer finished. Continue when you're ready.");
  }
}
function renderSession() {
  finishExpiredSession();
  const session = state.session;
  const focusActive = session?.kind === "focus" && session.status !== "finished";
  const meditationActive = session?.kind === "meditation" && session.status !== "finished";
  $("#timerDisplay").textContent = clockText(focusActive ? currentRemaining(session) : state.focusDuration * 60_000);
  $("#meditationDisplay").textContent = clockText(meditationActive ? currentRemaining(session) : state.meditationDuration * 60_000);
  $("#timerState").textContent = focusActive ? capitalize(session.status) : session?.kind === "focus" && session.status === "finished" ? "Finished" : "Ready";
  $("#timerStart").textContent = focusActive ? session.status === "running" ? "Pause focus" : "Resume focus" : "Start focus";
  $("#breathingButton").textContent = meditationActive ? session.status === "running" ? "Pause quiet timer" : "Resume quiet timer" : "Start quiet timer";
  $("#endMeditation").hidden = !meditationActive;
  $("#breathingOrb").classList.toggle("is-inhaling", meditationActive && session.status === "running");
  $$('[data-minutes]').forEach(button => button.classList.toggle("is-active", Number(button.dataset.minutes) === state.focusDuration));
  $$('[data-meditation-minutes]').forEach(button => button.classList.toggle("is-active", Number(button.dataset.meditationMinutes) === state.meditationDuration));
}
function setDuration(kind, duration) {
  if (state.session && state.session.status !== "finished") { announce("End the current timer before changing duration."); return; }
  if (kind === "focus") state.focusDuration = duration; else state.meditationDuration = duration;
  persist(); renderSession();
}
$$('[data-minutes]').forEach(button => button.addEventListener("click", () => setDuration("focus", Number(button.dataset.minutes))));
$$('[data-meditation-minutes]').forEach(button => button.addEventListener("click", () => setDuration("meditation", Number(button.dataset.meditationMinutes))));
function handleSession(kind) {
  const current = state.session;
  if (current && current.status !== "finished" && current.kind !== kind) { announce(`End your ${current.kind} timer before starting another.`); return; }
  if (!current || current.status === "finished") {
    const durationMs = (kind === "focus" ? state.focusDuration : state.meditationDuration) * 60_000;
    state.session = { id: crypto.randomUUID(), kind, status: "running", durationMs, remainingMs: durationMs, deadlineMs: Date.now() + durationMs };
    announce(`${capitalize(kind)} timer started.`);
  } else if (current.status === "running") {
    current.remainingMs = currentRemaining(current); current.deadlineMs = null; current.status = "paused"; announce("Timer paused.");
  } else {
    current.deadlineMs = Date.now() + current.remainingMs; current.status = "running"; announce("Timer resumed.");
  }
  persist(); renderSession();
}
$("#timerStart").addEventListener("click", () => handleSession("focus"));
$("#breathingButton").addEventListener("click", () => handleSession("meditation"));
$("#endMeditation").addEventListener("click", () => { if (state.session?.kind === "meditation") { state.session = null; persist(); renderSession(); announce("Quiet timer ended."); } });
$("#timerReset").addEventListener("click", () => { if (state.session?.kind === "focus") { state.session = null; persist(); renderSession(); announce("Focus timer ended."); } });
sessionInterval = setInterval(renderSession, 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) renderSession(); });

$("#retrySave").addEventListener("click", () => { if (readOnlyConflict) { location.reload(); return; } if (persist()) announce("Plan saved in this browser."); });
$("#resetDemo").addEventListener("click", () => { if (!window.confirm("Replace this browser's Daybreak plan with fictional sample blocks?")) return; readOnlyConflict = false; state = initialState(); suggestion = null; const saved = persist(); render(); announce(saved ? "Sample plan restored." : "Sample plan restored for this visit only."); });
$("#exportPlan").addEventListener("click", () => {
  try {
    const blob = new Blob([writeBackup(state)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `daybreak-plan-${state.selectedDate}.json`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url),1000);
    announce("Plan backup created on this device. It includes your entered block titles.");
  } catch (error) { announce(error.message); }
});
$("#restorePlan").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (readOnlyConflict) throw new Error("Reload before restoring, another tab changed this plan.");
    if (file.size > 2 * 1024 * 1024) throw new Error("Choose a backup smaller than 2 MB.");
    const revision = state.revision;
    const restored = readBackup(await file.text());
    if (revision !== state.revision || readOnlyConflict) throw new Error("The plan changed while reading the backup. Select the file again after reviewing your current plan.");
    if (!window.confirm(`Replace the current Daybreak plan with ${restored.events.length} validated blocks from this backup? Download a backup of your current plan first if needed.`)) return;
    state = {...state,...restored,session:null}; suggestion = null;
    const saved = persist(); render();
    announce(saved ? "Validated plan restored in this browser." : "Validated plan restored for this visit only.");
  } catch (error) { announce(error.message); }
  finally { event.target.value = ""; }
});
window.addEventListener("storage", event => { if (event.key === STORE_KEY) { readOnlyConflict = true; showStorageProblem("The plan changed in another tab. Reload before making more changes."); } });

render();
