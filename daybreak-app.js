import { CALENDARS, dateKey, parseDateKey, shiftDate, weekDates, timeMinutes, minutesToTime, formatMinutes, formatClock, eventEnd, validateEvent, overlappingEvents, eventsForDate, dailySummary, findFocusSlot, freeGaps, recoverStoredPlan, samplePlan, newId } from "./daybreak-model.mjs";
import { readBackup, writeBackup } from "./daybreak-backup.mjs";

const STORE_KEY = "daybreak.phase-one-proof.v1";
const DAMAGED_KEY = `${STORE_KEY}.damaged-copy`;
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const todayKey = () => dateKey(new Date());
const formatDate = (key, options = { weekday: "long", month: "long", day: "numeric", year: "numeric" }) => parseDateKey(key).toLocaleDateString("en-US", options);
const formatDuration = minutes => minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}` : `${minutes}m`;
const capitalize = value => value[0].toUpperCase() + value.slice(1);
const DAY_WINDOW = { windowStart: 8 * 60, windowEnd: 18 * 60 };
const NOT_SAVED = "This browser is not saving changes right now. They will last until you close the page.";

function initialState() {
  const anchor = todayKey();
  return { schemaVersion: 1, revision: 0, sampleAnchorDate: anchor, events: samplePlan(anchor), selectedDate: anchor, view: "day", filters: [...CALENDARS], focusDuration: 50, meditationDuration: 2, session: null };
}

function validSession(session) {
  return session && ["focus", "meditation"].includes(session.kind) && ["running", "paused", "finished"].includes(session.status) && Number.isFinite(session.remainingMs) && Number.isFinite(session.durationMs) && (session.status !== "running" || Number.isFinite(session.deadlineMs));
}

// Storage problems are tracked as one of: "", "unavailable", "unreadable", "partial", "conflict".
let storageIssue = "";
let storedRaw = null;
let droppedBlocks = 0;
let readOnly = false;

function readState() {
  try { storedRaw = localStorage.getItem(STORE_KEY); }
  catch { storageIssue = "unavailable"; return initialState(); }
  if (storedRaw === null) {
    const fresh = initialState();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(fresh)); } catch { storageIssue = "unavailable"; }
    return fresh;
  }
  const result = recoverStoredPlan(storedRaw);
  if (result.status === "unreadable") { storageIssue = "unreadable"; readOnly = true; return { ...initialState(), events: [] }; }
  const plan = result.plan;
  const state = {
    ...plan,
    schemaVersion: 1,
    selectedDate: plan.selectedDate ?? todayKey(),
    focusDuration: [25, 50, 90].includes(plan.focusDuration) ? plan.focusDuration : 50,
    meditationDuration: [1, 2, 5].includes(plan.meditationDuration) ? plan.meditationDuration : 2,
    session: validSession(plan.session) ? plan.session : null,
  };
  if (result.status === "partial") { storageIssue = "partial"; droppedBlocks = result.dropped; readOnly = true; }
  return state;
}

let state = readState();
let toastTimer;
let suggestion = null;
let modalSnapshot = "";
let modalReturnFocus = null;
let overlapConfirmed = false;

function bannerButton(label, handler, primary = false) {
  const button = element("button", primary ? "banner-primary" : "", label);
  button.type = "button";
  button.addEventListener("click", handler);
  return button;
}

function showStorageIssue(kind) {
  storageIssue = kind;
  const actions = $("#bannerActions");
  actions.replaceChildren();
  let message = "";
  if (kind === "unavailable") {
    message = NOT_SAVED;
    actions.append(bannerButton("Try saving again", () => { if (persist()) announce("Plan saved in this browser."); }, true));
  } else if (kind === "unreadable") {
    message = "The plan saved in this browser could not be read. Nothing has been deleted. Download the stored copy to keep it, or start over with the sample week.";
    actions.append(bannerButton("Download stored copy", downloadStoredCopy, true), bannerButton("Start over", resetToSample));
  } else if (kind === "partial") {
    message = `${droppedBlocks} saved ${droppedBlocks === 1 ? "block was" : "blocks were"} damaged and left out. The other ${state.events.length} are shown below. Keep them to continue editing. A copy of the original stays in this browser.`;
    actions.append(bannerButton(`Keep ${state.events.length} ${state.events.length === 1 ? "block" : "blocks"}`, keepRecoveredPlan, true), bannerButton("Download stored copy", downloadStoredCopy));
  } else if (kind === "conflict") {
    message = "This plan was changed in another tab. Reload to see the latest version before you edit here.";
    actions.append(bannerButton("Reload", () => location.reload(), true));
  }
  $("#storageMessage").textContent = message;
  $("#storageBanner").hidden = !kind;
}

function clearStorageIssue() { storageIssue = ""; $("#storageBanner").hidden = true; }

function persist() {
  if (readOnly) { showStorageIssue(storageIssue || "conflict"); return false; }
  try {
    state.revision += 1;
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    if (storageIssue === "unavailable") clearStorageIssue();
    return true;
  } catch {
    showStorageIssue("unavailable");
    return false;
  }
}

function downloadText(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url; link.download = filename; link.hidden = true;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadStoredCopy() {
  downloadText(storedRaw ?? "", `daybreak-stored-copy-${todayKey()}.json`);
  announce("Stored copy downloaded.");
}

function keepRecoveredPlan() {
  try { localStorage.setItem(DAMAGED_KEY, storedRaw ?? ""); } catch { /* the download button still works */ }
  readOnly = false;
  clearStorageIssue();
  const saved = persist();
  render();
  announce(saved ? `Kept ${state.events.length} blocks. The original copy is stored separately.` : NOT_SAVED);
}

function resetToSample() {
  if (!window.confirm("Replace the plan in this browser with the fictional sample week?")) return;
  if (storageIssue === "unreadable" || storageIssue === "partial") { try { localStorage.setItem(DAMAGED_KEY, storedRaw ?? ""); } catch { /* ignore */ } }
  readOnly = false; clearStorageIssue();
  state = initialState(); suggestion = null;
  const saved = persist(); render(); closeMobileMenu();
  announce(saved ? "Sample week restored." : NOT_SAVED);
}

function announce(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3600);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgIcon(path) {
  const span = element("span", "inline-icon");
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = `<svg viewBox="0 0 24 24">${path}</svg>`;
  return span;
}

const visibleCalendars = () => state.filters;
const eventRange = event => `${formatClock(event.start)} to ${formatMinutes(eventEnd(event))}`;

function renderHeader() {
  const isToday = state.selectedDate === todayKey();
  const week = weekDates(state.selectedDate);
  if (state.view === "day") {
    $("#eyebrow").textContent = isToday ? "Today" : formatDate(state.selectedDate, { year: "numeric" });
    $("#pageTitle").textContent = formatDate(state.selectedDate, { weekday: "long", month: "long", day: "numeric" });
  } else {
    $("#eyebrow").textContent = week.includes(todayKey()) ? "This week" : `Week of ${formatDate(week[0], { month: "long", day: "numeric" })}`;
    const sameMonth = week[0].slice(0, 7) === week[6].slice(0, 7);
    $("#pageTitle").textContent = `${formatDate(week[0], { month: "long", day: "numeric" })} to ${formatDate(week[6], sameMonth ? { day: "numeric" } : { month: "long", day: "numeric" })}`;
  }
  document.title = `${$("#pageTitle").textContent} | Daybreak planner`;
  $("#jumpDate").value = state.selectedDate;
  $("#todayDate").disabled = isToday && state.view === "day";
  $("#previousDate").setAttribute("aria-label", state.view === "week" ? "Previous week" : "Previous day");
  $("#nextDate").setAttribute("aria-label", state.view === "week" ? "Next week" : "Next day");
  $("#dayView").hidden = state.view !== "day";
  $("#weekView").hidden = state.view !== "week";
  $(".workspace").classList.toggle("is-week", state.view === "week");
  for (const [button, view] of [[$("#dayViewButton"), "day"], [$("#weekViewButton"), "week"]]) button.setAttribute("aria-pressed", String(state.view === view));
  for (const [button, view] of [[$("#navToday"), "day"], [$("#navWeek"), "week"]]) {
    button.classList.toggle("is-current", state.view === view);
    if (state.view === view) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
  }
  $$("[data-calendar]").forEach(input => { input.checked = state.filters.includes(input.dataset.calendar); });
  const weekEvents = state.events.filter(item => week.includes(item.date));
  for (const calendar of CALENDARS) {
    const count = weekEvents.filter(item => item.calendar === calendar).length;
    $(`#count-${calendar}`).textContent = String(count);
    $(`#count-${calendar}`).title = `${count} this week`;
  }
}

function longestGap(key) {
  return freeGaps(state.events, key, DAY_WINDOW).sort((a, b) => b.minutes - a.minutes || a.start - b.start)[0] ?? null;
}

function renderSummary(summary) {
  const box = $("#daySummary"); box.replaceChildren();
  const gap = longestGap(state.selectedDate);
  const items = [
    ["Planned", formatDuration(summary.plannedMinutes), `${summary.blocks} ${summary.blocks === 1 ? "block" : "blocks"}`],
    ["Protected focus", formatDuration(summary.protectedMinutes), summary.plannedMinutes ? `${Math.round(summary.protectedMinutes / summary.plannedMinutes * 100)}% of planned time` : "None yet"],
    ["Longest open stretch", gap ? formatDuration(gap.minutes) : "None", gap ? `${formatMinutes(gap.start)} to ${formatMinutes(gap.end)}` : "8 AM to 6 PM is fully booked"],
  ];
  for (const [label, value, note] of items) {
    const stat = element("div", "stat");
    stat.append(element("p", "stat-label", label), element("p", "stat-value", value), element("p", "stat-note", note));
    box.append(stat);
  }
}

function assignLanes(items) {
  const laneEnds = [];
  return items.map(item => {
    const start = timeMinutes(item.start);
    let lane = laneEnds.findIndex(end => end <= start);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
    laneEnds[lane] = eventEnd(item);
    return { item, lane };
  });
}

let scrub = null;
let scrubDate = null;
function renderStrip(shown) {
  const strip = $("#dayStrip"); strip.replaceChildren();
  let from = 7 * 60, to = 21 * 60;
  for (const item of shown) { from = Math.min(from, Math.floor(timeMinutes(item.start) / 60) * 60); to = Math.max(to, Math.ceil(eventEnd(item) / 60) * 60); }
  const span = to - from;
  const pct = minutes => `${((minutes - from) / span) * 100}%`;
  const track = element("div", "strip-track");
  const placed = assignLanes(shown);
  const lanes = Math.max(1, ...placed.map(entry => entry.lane + 1));
  track.style.setProperty("--lanes", String(lanes));
  track.style.setProperty("--cols", String(span / 120));
  for (const gap of freeGaps(state.events, state.selectedDate, { windowStart: Math.max(from, DAY_WINDOW.windowStart), windowEnd: Math.min(to, DAY_WINDOW.windowEnd) })) {
    const open = element("span", "strip-gap");
    open.style.left = pct(gap.start); open.style.width = `calc(${pct(gap.end)} - ${pct(gap.start)})`;
    track.append(open);
  }
  for (const { item, lane } of placed) {
    const segment = element("span", `strip-block ${item.calendar}${item.protected ? " is-protected" : ""}`);
    segment.style.left = pct(timeMinutes(item.start));
    segment.style.width = `calc(${pct(eventEnd(item))} - ${pct(timeMinutes(item.start))})`;
    segment.style.setProperty("--lane", String(lane));
    track.append(segment);
  }
  if (state.selectedDate === todayKey()) {
    const now = new Date(); const minutes = now.getHours() * 60 + now.getMinutes();
    if (minutes >= from && minutes <= to) { const marker = element("span", "strip-now"); marker.style.left = pct(minutes); track.append(marker); }
  }
  const axis = element("div", "strip-axis");
  for (let minute = from; minute <= to; minute += 120) {
    const tick = element("span", "strip-tick", formatMinutes(minute).replace(":00", ""));
    tick.style.left = pct(minute);
    axis.append(tick);
  }
  // The strip is a horizon: the sky shifts from dawn to dusk across the hours, and a sun marks the moment you scrub to.
  const SKY = [[300, "#2b3462"], [420, "#ecc3cb"], [540, "#f5ebe2"], [660, "#eef3fb"], [960, "#eef3fb"], [1080, "#f3dfd2"], [1170, "#d3b2cc"], [1260, "#454b78"], [1380, "#262c50"]];
  track.style.background = `linear-gradient(90deg, ${SKY.map(([minute, color]) => `${color} ${(((minute - from) / span) * 100).toFixed(1)}%`).join(", ")})`;
  if (scrubDate !== state.selectedDate || scrub === null || scrub < from || scrub > to) {
    const now = new Date(); const nowMinutes = now.getHours() * 60 + now.getMinutes();
    scrub = state.selectedDate === todayKey() && nowMinutes >= from && nowMinutes <= to ? Math.round(nowMinutes / 5) * 5 : shown.length ? timeMinutes(shown[0].start) : 9 * 60;
    scrubDate = state.selectedDate;
  }
  const sun = element("span", "strip-sun");
  track.append(sun);
  track.tabIndex = 0;
  track.setAttribute("role", "slider");
  track.setAttribute("aria-label", "Scrub through the day");
  track.setAttribute("aria-valuemin", String(from));
  track.setAttribute("aria-valuemax", String(to));
  const readout = element("div", "strip-readout");
  const readText = element("p", "strip-read");
  const planHere = element("button", "strip-plan");
  planHere.type = "button";
  readout.append(readText, planHere);
  const describe = minute => {
    const at = shown.filter(item => timeMinutes(item.start) <= minute && eventEnd(item) > minute);
    if (at.length) return { busy: true, text: `${at.map(item => item.title).join(" and ")} until ${formatMinutes(Math.max(...at.map(eventEnd)))}.` };
    const next = shown.filter(item => timeMinutes(item.start) > minute).sort((a, b) => timeMinutes(a.start) - timeMinutes(b.start))[0];
    return { busy: false, text: next ? `Open for ${formatDuration(timeMinutes(next.start) - minute)}, then ${next.title} at ${formatClock(next.start)}.` : "Open for the rest of the day." };
  };
  const place = minute => {
    scrub = Math.min(to, Math.max(from, Math.round(minute / 5) * 5));
    const { busy, text } = describe(scrub);
    sun.style.left = pct(scrub);
    sun.classList.toggle("is-busy", busy);
    track.setAttribute("aria-valuenow", String(scrub));
    track.setAttribute("aria-valuetext", `${formatMinutes(scrub)}. ${text}`);
    readText.replaceChildren(element("strong", "", formatMinutes(scrub)), document.createTextNode(` ${text}`));
    planHere.textContent = `Plan a block at ${formatMinutes(scrub)}`;
    planHere.hidden = busy || scrub >= 24 * 60 - 15;
  };
  planHere.addEventListener("click", () => openEditor(null, state.selectedDate, minutesToTime(scrub), false, 30));
  const fromPointer = event => { const box = track.getBoundingClientRect(); place(from + ((event.clientX - box.left) / box.width) * span); };
  track.addEventListener("pointerdown", event => { if (event.button !== 0) return; track.setPointerCapture(event.pointerId); track.classList.add("is-scrubbing"); fromPointer(event); });
  track.addEventListener("pointermove", event => { if (track.hasPointerCapture(event.pointerId)) fromPointer(event); });
  const stop = event => { if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId); track.classList.remove("is-scrubbing"); };
  track.addEventListener("pointerup", stop);
  track.addEventListener("pointercancel", stop);
  track.addEventListener("keydown", event => {
    const step = { ArrowLeft: -15, ArrowDown: -15, ArrowRight: 15, ArrowUp: 15, PageDown: -60, PageUp: 60 }[event.key];
    if (step) { event.preventDefault(); place(scrub + step); }
    else if (event.key === "Home") { event.preventDefault(); place(from); }
    else if (event.key === "End") { event.preventDefault(); place(to); }
  });
  place(scrub);
  strip.append(track, axis, readout);
}

function agendaCard(item) {
  const conflicts = overlappingEvents(item, state.events);
  const card = element("button", `agenda-card ${item.calendar}`);
  card.type = "button";
  const time = element("span", "agenda-time");
  time.append(element("span", "", formatClock(item.start)), element("span", "agenda-end", formatMinutes(eventEnd(item))));
  const body = element("span", "agenda-body");
  body.append(element("span", "agenda-title", item.title), element("span", "agenda-meta", `${capitalize(item.calendar)}, ${formatDuration(item.duration)}`));
  const tags = element("span", "agenda-tags");
  if (item.protected) tags.append(element("span", "tag focus", "Protected focus"));
  if (conflicts.length) tags.append(element("span", "tag warn", `Overlaps ${conflicts.map(other => other.title).join(" and ")}`));
  body.append(tags);
  card.append(time, body);
  card.setAttribute("aria-label", `${item.title}, ${eventRange(item)}, ${item.calendar} calendar${item.protected ? ", protected focus" : ""}${conflicts.length ? `, overlaps ${conflicts.map(other => other.title).join(" and ")}` : ""}. Edit.`);
  card.addEventListener("click", () => openEditor(item));
  return card;
}

function gapRow(gap) {
  const row = element("div", "gap-row");
  const text = element("p", "gap-text");
  text.append(element("strong", "", `${formatDuration(gap.minutes)} open`), document.createTextNode(` ${formatMinutes(gap.start)} to ${formatMinutes(gap.end)}`));
  const button = element("button", "gap-button", "Protect");
  button.type = "button";
  button.setAttribute("aria-label", `Protect ${formatDuration(gap.minutes)} from ${formatMinutes(gap.start)} as focus time`);
  button.addEventListener("click", () => {
    const length = Math.min(120, Math.floor(gap.minutes / 15) * 15);
    openEditor(null, state.selectedDate, minutesToTime(gap.start), true, length, "Focus time");
  });
  row.append(text, button);
  return row;
}

function renderDay() {
  const all = eventsForDate(state.events, state.selectedDate);
  const shown = eventsForDate(state.events, state.selectedDate, visibleCalendars());
  const summary = dailySummary(state.events, state.selectedDate);
  renderSummary(summary);
  renderStrip(shown);
  $("#visibleCount").textContent = shown.length === all.length ? `${all.length} ${all.length === 1 ? "block" : "blocks"}` : `${shown.length} of ${all.length} blocks shown`;
  const agenda = $("#dayAgenda"); agenda.replaceChildren();
  const rows = [
    ...shown.map(item => ({ at: timeMinutes(item.start), node: agendaCard(item) })),
    ...(shown.length ? freeGaps(state.events, state.selectedDate, { ...DAY_WINDOW, minLength: 45 }).map(gap => ({ at: gap.start, node: gapRow(gap) })) : []),
  ].sort((a, b) => a.at - b.at);
  for (const row of rows) { const li = element("li"); li.append(row.node); agenda.append(li); }
  $("#dayEmpty").hidden = shown.length > 0;
  if (!shown.length) {
    const allHidden = !state.filters.length;
    $("#emptyTitle").textContent = allHidden ? "All calendars are hidden" : all.length ? "Nothing on the calendars you are showing" : `Nothing planned for ${formatDate(state.selectedDate, { weekday: "long" })}`;
    $("#emptyDescription").textContent = all.length ? `${all.length} ${all.length === 1 ? "block is" : "blocks are"} saved on hidden calendars.` : "Add a block with a title, a start time and a length.";
    $("#showAllCalendars").hidden = !all.length;
  }
}

function renderWeek() {
  const grid = $("#weekGrid"); grid.replaceChildren();
  const today = todayKey();
  for (const key of weekDates(state.selectedDate)) {
    const column = element("section", `week-day${key === state.selectedDate ? " is-selected" : ""}${key === today ? " is-today" : ""}`);
    const headingId = `week-${key}`;
    column.setAttribute("aria-labelledby", headingId);
    const head = element("button", "week-head");
    head.type = "button"; head.id = headingId;
    head.append(element("span", "week-name", formatDate(key, { weekday: "short" })), element("span", "week-date", formatDate(key, { day: "numeric" })));
    head.setAttribute("aria-label", `${formatDate(key, { weekday: "long", month: "long", day: "numeric" })}${key === today ? ", today" : ""}. Open day`);
    head.addEventListener("click", () => { state.selectedDate = key; state.view = "day"; persist(); render(); });
    const summary = dailySummary(state.events, key);
    const load = element("div", "week-load-bar");
    const fill = element("span", "", undefined); fill.style.width = `${Math.min(100, summary.plannedMinutes / 600 * 100)}%`;
    load.append(fill);
    load.setAttribute("aria-hidden", "true");
    const total = element("p", "week-total", summary.blocks ? `${formatDuration(summary.plannedMinutes)} planned` : "Open day");
    column.append(head, load, total);
    const blocks = eventsForDate(state.events, key, visibleCalendars());
    const list = element("ul", "week-events");
    for (const item of blocks) {
      const li = element("li");
      const chip = element("button", `week-event ${item.calendar}${overlappingEvents(item, state.events).length ? " has-overlap" : ""}`);
      chip.type = "button";
      chip.append(element("span", "week-time", formatClock(item.start)), element("span", "week-title", item.title));
      chip.setAttribute("aria-label", `${item.title}, ${eventRange(item)}, ${item.calendar} calendar${item.protected ? ", protected focus" : ""}${overlappingEvents(item, state.events).length ? ", overlaps another block" : ""}. Edit.`);
      chip.addEventListener("click", () => openEditor(item));
      li.append(chip); list.append(li);
    }
    if (blocks.length) column.append(list);
    else column.append(element("p", "week-empty", summary.blocks ? "Only hidden calendars" : "Nothing planned"));
    grid.append(column);
  }
}

function renderLoad() {
  const list = $("#loadList"); list.replaceChildren();
  const week = weekDates(state.selectedDate);
  let total = 0;
  const max = Math.max(480, ...week.map(key => dailySummary(state.events, key).plannedMinutes));
  for (const key of week) {
    const summary = dailySummary(state.events, key);
    total += summary.plannedMinutes;
    const li = element("li");
    const button = element("button", `load-row${key === state.selectedDate && state.view === "day" ? " is-selected" : ""}`);
    button.type = "button";
    const bar = element("span", "load-bar");
    const planned = element("span", "load-planned"); planned.style.width = `${summary.plannedMinutes / max * 100}%`;
    const protectedBar = element("span", "load-protected"); protectedBar.style.width = `${summary.protectedMinutes / max * 100}%`;
    bar.append(planned, protectedBar); bar.setAttribute("aria-hidden", "true");
    button.append(element("span", "load-day", formatDate(key, { weekday: "short" })), bar, element("span", "load-value", summary.plannedMinutes ? formatDuration(summary.plannedMinutes) : "Open"));
    button.setAttribute("aria-label", `${formatDate(key, { weekday: "long", month: "long", day: "numeric" })}: ${summary.plannedMinutes ? `${formatDuration(summary.plannedMinutes)} planned, ${formatDuration(summary.protectedMinutes)} protected` : "nothing planned"}. Open day`);
    button.addEventListener("click", () => { state.selectedDate = key; state.view = "day"; persist(); render(); });
    li.append(button); list.append(li);
  }
  $("#weekTotal").textContent = `${formatDuration(total)} planned`;
}

function resetSuggestion() {
  suggestion = null;
  $("#focusSuggestion").textContent = "";
  $("#addSuggestedBlock").hidden = true;
}

function render() {
  if (suggestion && (suggestion.revision !== state.revision || suggestion.duration !== state.focusDuration)) resetSuggestion();
  $("#findFocusButton").textContent = `Find ${state.focusDuration} open minutes`;
  renderHeader(); renderDay(); renderWeek(); renderLoad(); renderSession();
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
$$("[data-calendar]").forEach(input => input.addEventListener("change", () => { state.filters = $$("[data-calendar]:checked").map(item => item.dataset.calendar); persist(); render(); }));
$("#showAllCalendars").addEventListener("click", () => { state.filters = [...CALENDARS]; persist(); render(); });

// The phone menu is off screen when closed, so it must also be out of the tab order.
const mobileQuery = window.matchMedia("(max-width: 860px)");
function syncSidebar() {
  const open = $("#sidebar").classList.contains("is-open");
  $("#sidebar").inert = mobileQuery.matches && !open;
  $("#scrim").hidden = !(mobileQuery.matches && open);
  $(".shell main").inert = mobileQuery.matches && open;
}
function openMobileMenu() {
  $("#sidebar").classList.add("is-open"); $("#mobileMenu").setAttribute("aria-expanded", "true"); syncSidebar();
  $("#closeMenu").focus();
}
function closeMobileMenu(returnFocus = false) {
  const wasOpen = $("#sidebar").classList.contains("is-open");
  $("#sidebar").classList.remove("is-open"); $("#mobileMenu").setAttribute("aria-expanded", "false"); syncSidebar();
  if (wasOpen && returnFocus) $("#mobileMenu").focus();
}
$("#mobileMenu").addEventListener("click", openMobileMenu);
$("#closeMenu").addEventListener("click", () => closeMobileMenu(true));
$("#scrim").addEventListener("click", () => closeMobileMenu(true));
mobileQuery.addEventListener("change", () => { if (!mobileQuery.matches) closeMobileMenu(); syncSidebar(); });
syncSidebar();

function formValue() {
  return { id: $("#eventId").value || newId(), title: $("#eventTitle").value, date: $("#eventDate").value, start: $("#eventStart").value, duration: Number($("#eventDuration").value), calendar: $("#eventCalendar").value, protected: $("#eventProtected").checked };
}
function formSnapshot() { return JSON.stringify({ title: $("#eventTitle").value, date: $("#eventDate").value, start: $("#eventStart").value, duration: $("#eventDuration").value, calendar: $("#eventCalendar").value, protected: $("#eventProtected").checked }); }
function openEditor(item = null, date = state.selectedDate, start = "09:00", protectedTime = false, duration = 30, title = "") {
  modalReturnFocus = document.activeElement;
  overlapConfirmed = false;
  $("#eventId").value = item?.id ?? "";
  $("#eventTitle").value = item?.title ?? title;
  $("#eventDate").value = item?.date ?? date;
  $("#eventStart").value = item?.start ?? start;
  const length = String(item?.duration ?? duration);
  if (![...$("#eventDuration").options].some(option => option.value === length)) $("#eventDuration").append(new Option(formatDuration(Number(length)), length));
  $("#eventDuration").value = length;
  $("#eventCalendar").value = item?.calendar ?? "work";
  $("#eventProtected").checked = item?.protected ?? protectedTime;
  $("#dialogTitle").textContent = item ? "Edit block" : "Add a block";
  $("#saveEvent").textContent = item ? "Save changes" : "Add block";
  $("#deleteEvent").hidden = !item;
  $("#overlapWarning").hidden = true;
  $$(".field-error").forEach(node => { node.textContent = ""; });
  $$("#eventForm input, #eventForm select").forEach(node => node.removeAttribute("aria-invalid"));
  $("#eventDialog").hidden = false;
  modalSnapshot = formSnapshot();
  document.body.classList.add("has-dialog");
  $(".shell").inert = true;
  $("#eventTitle").focus();
  if (title) $("#eventTitle").select();
}
function closeEditor(force = false) {
  if (!force && formSnapshot() !== modalSnapshot && !window.confirm("Discard your unsaved changes?")) return;
  $("#eventDialog").hidden = true;
  document.body.classList.remove("has-dialog");
  $(".shell").inert = false;
  syncSidebar();
  (modalReturnFocus?.isConnected && modalReturnFocus !== document.body ? modalReturnFocus : $("#addEvent")).focus();
}
$("#addEvent").addEventListener("click", () => openEditor());
$("#emptyAdd").addEventListener("click", () => openEditor());
$("#dialogClose").addEventListener("click", () => closeEditor());
$("#eventDialog").addEventListener("click", event => { if (event.target === $("#eventDialog")) closeEditor(); });
document.addEventListener("keydown", event => {
  if ($("#eventDialog").hidden) {
    if (event.key === "Escape" && $("#sidebar").classList.contains("is-open")) closeMobileMenu(true);
    return;
  }
  if (event.key === "Escape") { event.preventDefault(); closeEditor(); }
  if (event.key !== "Tab") return;
  const controls = $$("#eventDialog button, #eventDialog input:not([type=hidden]), #eventDialog select").filter(node => !node.hidden && !node.disabled);
  if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
  else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
});
$("#eventForm").addEventListener("input", () => { overlapConfirmed = false; $("#overlapWarning").hidden = true; $("#saveEvent").textContent = $("#eventId").value ? "Save changes" : "Add block"; });
$("#eventForm").addEventListener("submit", event => {
  event.preventDefault();
  if (readOnly) { showStorageIssue(storageIssue || "conflict"); return; }
  const result = validateEvent(formValue());
  $$(".field-error").forEach(node => { node.textContent = ""; });
  $$("#eventForm input, #eventForm select").forEach(node => node.removeAttribute("aria-invalid"));
  if (!result.ok) {
    for (const [field, message] of Object.entries(result.errors)) { const error = $(`#${field}Error`); if (error) error.textContent = message; const input = $(`#event${capitalize(field)}`); if (input) { input.setAttribute("aria-invalid", "true"); input.setAttribute("aria-describedby", `${field}Error`); } }
    const first = Object.keys(result.errors)[0]; $(`#event${capitalize(first)}`)?.focus(); return;
  }
  const conflicts = overlappingEvents(result.value, state.events);
  if (conflicts.length && !overlapConfirmed) {
    $("#overlapWarning").textContent = `This overlaps ${conflicts.map(item => `${item.title}, ${eventRange(item)}`).join(" and ")}. Save again to keep both.`;
    $("#overlapWarning").hidden = false;
    $("#saveEvent").textContent = "Save anyway";
    overlapConfirmed = true;
    return;
  }
  const existing = state.events.findIndex(item => item.id === result.value.id);
  if (existing >= 0) state.events[existing] = result.value;
  else state.events.push(result.value);
  state.selectedDate = result.value.date;
  const saved = persist();
  closeEditor(true); render();
  const hidden = !state.filters.includes(result.value.calendar) ? ` It is on the ${capitalize(result.value.calendar)} calendar, which is hidden.` : "";
  announce(saved ? `Saved ${result.value.title}.${hidden}` : NOT_SAVED);
});
$("#deleteEvent").addEventListener("click", () => {
  const id = $("#eventId").value;
  const item = state.events.find(event => event.id === id);
  if (!item || !window.confirm(`Delete ${item.title} on ${formatDate(item.date, { weekday: "long", month: "long", day: "numeric" })}?`)) return;
  state.events = state.events.filter(event => event.id !== id);
  const saved = persist(); closeEditor(true); render(); announce(saved ? `Deleted ${item.title}.` : NOT_SAVED);
});

$("#findFocusButton").addEventListener("click", () => {
  const today = todayKey();
  const duration = state.focusDuration;
  if (state.selectedDate < today) { resetSuggestion(); $("#focusSuggestion").textContent = "That day has passed. Pick today or a later day."; return; }
  const now = new Date();
  const notBefore = state.selectedDate === today ? now.getHours() * 60 + now.getMinutes() : 0;
  const start = findFocusSlot(state.events, state.selectedDate, duration, { windowStart: 9 * 60, windowEnd: 18 * 60, notBefore });
  suggestion = start === null ? null : { date: state.selectedDate, start: minutesToTime(start), revision: state.revision, duration };
  $("#focusSuggestion").textContent = suggestion
    ? `${formatMinutes(start)} to ${formatMinutes(start + duration)} on ${formatDate(state.selectedDate, { weekday: "long" })} is open on every calendar.`
    : `No ${duration}-minute stretch is open between 9 AM and 6 PM on ${formatDate(state.selectedDate, { weekday: "long" })}.`;
  $("#addSuggestedBlock").hidden = !suggestion;
});
$("#addSuggestedBlock").addEventListener("click", () => { if (suggestion) openEditor(null, suggestion.date, suggestion.start, true, suggestion.duration, "Focus time"); });

function currentRemaining(session, now = Date.now()) { return session.status === "running" ? Math.max(0, session.deadlineMs - now) : session.remainingMs; }
function clockText(ms) { const seconds = Math.ceil(Math.max(0, ms) / 1000); return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }
function finishExpiredSession() {
  if (state.session?.status === "running" && currentRemaining(state.session) <= 0) {
    const kind = state.session.kind;
    state.session.status = "finished"; state.session.remainingMs = 0; state.session.deadlineMs = null;
    persist(); announce(kind === "focus" ? "Focus time is up. Take a short break." : "Break finished.");
  }
}
function renderSession() {
  finishExpiredSession();
  const session = state.session;
  const focusActive = session?.kind === "focus" && session.status !== "finished";
  const meditationActive = session?.kind === "meditation" && session.status !== "finished";
  $("#timerDisplay").textContent = clockText(focusActive ? currentRemaining(session) : state.focusDuration * 60_000);
  $("#meditationDisplay").textContent = clockText(meditationActive ? currentRemaining(session) : state.meditationDuration * 60_000);
  $("#timerState").textContent = focusActive ? (session.status === "running" ? "Running" : "Paused") : session?.kind === "focus" && session.status === "finished" ? "Done" : "Ready";
  $("#timerStart").textContent = focusActive ? session.status === "running" ? "Pause" : "Resume" : "Start focus";
  $("#timerReset").disabled = !(session?.kind === "focus");
  $("#breathingButton").textContent = meditationActive ? session.status === "running" ? "Pause break" : "Resume break" : "Start break";
  $("#endMeditation").hidden = !meditationActive;
  $("#breathingOrb").classList.toggle("is-breathing", meditationActive && session.status === "running");
  $$("[data-minutes]").forEach(button => button.setAttribute("aria-pressed", String(Number(button.dataset.minutes) === state.focusDuration)));
  $$("[data-meditation-minutes]").forEach(button => button.setAttribute("aria-pressed", String(Number(button.dataset.meditationMinutes) === state.meditationDuration)));
}
function setDuration(kind, duration) {
  if (state.session && state.session.status !== "finished") { announce("End the current timer before changing its length."); return; }
  if (kind === "focus") state.focusDuration = duration; else state.meditationDuration = duration;
  persist(); render();
}
$$("[data-minutes]").forEach(button => button.addEventListener("click", () => setDuration("focus", Number(button.dataset.minutes))));
$$("[data-meditation-minutes]").forEach(button => button.addEventListener("click", () => setDuration("meditation", Number(button.dataset.meditationMinutes))));
function handleSession(kind) {
  const current = state.session;
  if (current && current.status !== "finished" && current.kind !== kind) { announce(`End the ${current.kind === "focus" ? "focus timer" : "break"} first.`); return; }
  if (!current || current.status === "finished" || current.kind !== kind) {
    const durationMs = (kind === "focus" ? state.focusDuration : state.meditationDuration) * 60_000;
    state.session = { id: newId(), kind, status: "running", durationMs, remainingMs: durationMs, deadlineMs: Date.now() + durationMs };
    announce(kind === "focus" ? "Focus timer started." : "Break started.");
  } else if (current.status === "running") {
    current.remainingMs = currentRemaining(current); current.deadlineMs = null; current.status = "paused"; announce("Paused.");
  } else {
    current.deadlineMs = Date.now() + current.remainingMs; current.status = "running"; announce("Resumed.");
  }
  persist(); renderSession();
}
$("#timerStart").addEventListener("click", () => handleSession("focus"));
$("#breathingButton").addEventListener("click", () => handleSession("meditation"));
$("#endMeditation").addEventListener("click", () => { if (state.session?.kind === "meditation") { state.session = null; persist(); renderSession(); announce("Break ended."); } });
$("#timerReset").addEventListener("click", () => { if (state.session?.kind === "focus") { state.session = null; persist(); renderSession(); announce("Focus timer ended."); } });
setInterval(renderSession, 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) renderSession(); });

$("#resetDemo").addEventListener("click", resetToSample);
$("#exportPlan").addEventListener("click", () => {
  try {
    downloadText(writeBackup(state), `daybreak-plan-${todayKey()}.json`);
    announce("Plan downloaded. The file includes your block titles.");
  } catch (error) { announce(error.message); }
});
$("#restorePlan").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (readOnly) throw new Error("Sort out the saved plan message at the top first.");
    if (file.size > 2 * 1024 * 1024) throw new Error("Choose a backup smaller than 2 MB.");
    const revision = state.revision;
    const restored = readBackup(await file.text());
    if (revision !== state.revision || readOnly) throw new Error("The plan changed while the file was loading. Choose the file again.");
    if (!window.confirm(`Replace the current plan with ${restored.events.length} blocks from ${file.name}?`)) return;
    state = { ...state, ...restored, session: null }; resetSuggestion();
    const saved = persist(); render(); closeMobileMenu();
    announce(saved ? `Restored ${restored.events.length} blocks.` : NOT_SAVED);
  } catch (error) { announce(error.message); }
  finally { event.target.value = ""; }
});
window.addEventListener("storage", event => { if (event.key === STORE_KEY) { readOnly = true; showStorageIssue("conflict"); } });

if (storageIssue) showStorageIssue(storageIssue);
render();
