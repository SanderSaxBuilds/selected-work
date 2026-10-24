"use strict";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const money = n => "$" + Math.round(n).toLocaleString("en-US");
const roundTo = (n, step) => Math.round(n / step) * step;

/* Header border once the page scrolls, and a slow settle of the hero photo */
const header = $("[data-header]");
const heroImg = $(".hero-photo img");
const steps = $("[data-steps]");
const build = $("[data-build]");
const buildCaption = $("[data-build-caption]");
const BUILD_CAPTIONS = [
  "Stage 0 of 5. Empty plot, before the first visit.",
  "Stage 1 of 5. Plot walked, measured and pegged out.",
  "Stage 2 of 5. Heights agreed, fixed price signed.",
  "Stage 3 of 5. Drawing issued, permit submitted.",
  "Stage 4 of 5. Slab, frame and roof on site.",
  "Stage 5 of 5. Closed in, lit and handed over."
];
let ticking = false;
function onScroll() {
  ticking = false;
  const y = window.scrollY;
  header && (header.dataset.scrolled = String(y > 8));
  if (heroImg && !reduceMotion.matches) {
    const t = Math.min(1, y / 700);
    heroImg.style.transform = `scale(${(1.08 - t * 0.035).toFixed(4)}) translateY(${(t * 12).toFixed(1)}px)`;
  }
  if (steps) {
    // Each step that scrolls past the reading line adds one stage to the elevation drawing.
    const vh = window.innerHeight;
    const items = $$("li", steps);
    let stage = 0;
    items.forEach(li => { const on = li.getBoundingClientRect().top < vh * 0.62; li.classList.toggle("reached", on); if (on) stage += 1; });
    steps.style.setProperty("--p", (stage / items.length).toFixed(3));
    if (build && build.dataset.stage !== String(stage)) {
      build.dataset.stage = String(stage);
      if (buildCaption) buildCaption.textContent = BUILD_CAPTIONS[stage];
    }
  }
}
window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
window.addEventListener("resize", onScroll);
onScroll();

/* Mobile navigation: open, close, Escape, outside click, focus trap */
const menuButton = $("[data-menu-toggle]");
const siteNav = $("[data-site-nav]");
const phoneNav = window.matchMedia("(max-width: 960px)");
const menuIsOpen = () => menuButton?.getAttribute("aria-expanded") === "true";
function setMenu(open, { returnFocus = false } = {}) {
  if (!menuButton || !siteNav) return;
  menuButton.setAttribute("aria-expanded", String(open));
  $(".menu-label", menuButton).textContent = open ? "Close" : "Menu";
  siteNav.dataset.open = String(open);
  document.body.dataset.menuOpen = String(open);
  if (open) $("a", siteNav)?.focus();
  else if (returnFocus) menuButton.focus();
}
if (menuButton && siteNav) {
  menuButton.addEventListener("click", () => setMenu(!menuIsOpen()));
  siteNav.addEventListener("click", e => { if (e.target instanceof Element && e.target.closest("a")) setMenu(false); });
  document.addEventListener("click", e => {
    if (!menuIsOpen() || !(e.target instanceof Element)) return;
    if (!e.target.closest("[data-site-nav]") && !e.target.closest("[data-menu-toggle]")) setMenu(false);
  });
  document.addEventListener("keydown", e => {
    if (!menuIsOpen()) return;
    if (e.key === "Escape") { e.preventDefault(); setMenu(false, { returnFocus: true }); return; }
    if (e.key !== "Tab") return;
    const f = [menuButton, ...$$("a", siteNav)];
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && (document.activeElement === f[0] || i === -1)) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && (document.activeElement === f[f.length - 1] || i === -1)) { e.preventDefault(); f[0].focus(); }
  });
  phoneNav.addEventListener("change", e => { if (!e.matches && menuIsOpen()) setMenu(false); });
}

/* Project sheets. Plan elements: [kind, when, ...args]. when: k kept, b before only, a after only. */
const PROJECTS = {
  orchard: {
    type: "Addition, Westbrook", title: "Orchard Lane kitchen extension", code: "FF-0412, ground floor",
    ask: "A kitchen that looks at the garden, and a table for eight that does not mean moving the sofa.",
    facts: [["Added", "380 sq ft"], ["On site", "15 weeks"], ["Fixed price", "$142,600"], ["Signed changes", "2, both added"], ["Kitchen out of use", "4 weeks"], ["Site lead", "Dana Rees"]],
    log: [["Wk 3", "Footings passed inspection. Drain run moved 40 cm to clear the old soakaway."], ["Wk 9", "Steel over the rear opening in. Old kitchen kept working until week 11."], ["Wk 15", "Snag list of 14 items closed before handover."]],
    plan: [
      ["o", "k", 60, 30, 340, 30], ["o", "k", 60, 30, 60, 190], ["o", "k", 340, 30, 340, 190], ["o", "k", 60, 190, 130, 190],
      ["i", "k", 60, 110, 110, 110], ["i", "k", 150, 110, 340, 110],
      ["o", "b", 130, 190, 340, 190], ["i", "b", 200, 110, 200, 190],
      ["r", "b", 282, 118, 50, 14],
      ["o", "a", 130, 190, 130, 262], ["o", "a", 130, 262, 158, 262], ["g", "a", 158, 262, 312, 262], ["o", "a", 312, 262, 340, 262], ["o", "a", 340, 190, 340, 262],
      ["t", "a", 209, 258, 209, 266], ["t", "a", 261, 258, 261, 266],
      ["r", "a", 206, 118, 126, 14], ["r", "a", 196, 196, 84, 20],
      ["L", "k", "Living", 200, 74], ["L", "b", "Dining", 130, 154], ["L", "b", "Kitchen", 270, 158], ["L", "b", "Garden", 235, 250],
      ["L", "a", "Kitchen and dining", 235, 162], ["L", "a", "Island", 238, 236], ["L", "a", "3 glazed doors", 235, 284],
      ["L", "k", "Garden", 412, 230]
    ]
  },
  mill: {
    type: "Whole-home renovation, Alder Falls", title: "Mill Street terrace", code: "FF-0388, ground floor",
    ask: "Stop walking through the back room to reach the kitchen, and find space for a third bedroom.",
    facts: [["Floor area", "1,650 sq ft"], ["On site", "24 weeks"], ["Fixed price", "$231,400"], ["Signed changes", "3"], ["House built", "1924"], ["Site lead", "Tomas Hale"]],
    log: [["Wk 2", "Lath walls opened. Rubber-sheathed wiring found, full rewire confirmed as priced."], ["Wk 11", "Stair moved to the party wall. Box room upstairs becomes bedroom three."], ["Wk 24", "Handover walk with the owners. 9 snags, all closed within 6 days."]],
    plan: [
      ["o", "k", 160, 20, 320, 20], ["o", "k", 160, 20, 160, 280], ["o", "k", 320, 20, 320, 280], ["o", "k", 160, 280, 320, 280],
      ["i", "b", 160, 105, 228, 105], ["i", "b", 262, 105, 320, 105], ["i", "b", 210, 112, 210, 200],
      ...Array.from({ length: 9 }, (_, n) => ["t", "b", 166, 116 + n * 9.5, 206, 116 + n * 9.5]),
      ["i", "k", 160, 200, 250, 200], ["i", "k", 284, 200, 320, 200],
      ["t", "a", 160, 105, 320, 105, "beam"],
      ["i", "a", 272, 112, 272, 196],
      ...Array.from({ length: 9 }, (_, n) => ["t", "a", 276, 116 + n * 9.5, 316, 116 + n * 9.5]),
      ["i", "a", 210, 200, 210, 240], ["i", "a", 160, 240, 196, 240],
      ["L", "b", "Front room", 240, 64], ["L", "b", "Stair", 188, 108], ["L", "b", "Back room", 266, 156], ["L", "b", "Kitchen", 240, 244],
      ["L", "a", "Living", 240, 64], ["L", "a", "Steel beam", 240, 99], ["L", "a", "Dining", 220, 156], ["L", "a", "Stair", 294, 108], ["L", "a", "WC", 185, 224], ["L", "a", "Kitchen", 262, 248],
      ["L", "a", "First floor:", 400, 132], ["L", "a", "box room", 400, 148], ["L", "a", "to bedroom 3", 400, 164]
    ]
  },
  hollis: {
    type: "Kitchen, Westbrook", title: "Hollis Road kitchen", code: "FF-0431, kitchen",
    ask: "Room for two people to cook, and a place for everything that currently lives on the counter.",
    facts: [["Cabinet run", "22 ft"], ["On site", "7 weeks"], ["Fixed price", "$61,850"], ["Signed changes", "1"], ["Window", "3 ft to 7 ft"], ["Kitchen out of use", "9 days"]],
    log: [["Wk 1", "Galley stripped. Wall to the hall checked and found not load-bearing."], ["Wk 4", "Lintel over the wider window in. Cabinets checked against the drawing on delivery."], ["Wk 7", "Worktops fitted, splashback grouted, handover on Friday."]],
    plan: [
      ["o", "k", 60, 80, 420, 80], ["o", "k", 60, 80, 60, 220], ["o", "k", 420, 80, 420, 220], ["o", "k", 60, 220, 200, 220], ["o", "k", 260, 220, 420, 220],
      ["W", "b", 210, 76, 60, 8], ["W", "a", 150, 76, 150, 8],
      ["r", "k", 66, 86, 296, 26],
      ["r", "b", 362, 86, 52, 26], ["r", "b", 66, 188, 128, 26], ["r", "b", 266, 188, 148, 26],
      ["h", "a", 366, 86, 48, 128], ["r", "a", 66, 112, 26, 82],
      ["L", "k", "Window", 225, 66], ["L", "b", "Galley, one cook", 240, 154], ["L", "a", "L-shaped, two cooks", 226, 160], ["L", "a", "Pantry", 390, 154, -90],
      ["L", "k", "Hall", 230, 246], ["L", "a", "Cabinet run 22 ft", 226, 278]
    ]
  },
  fernbrook: {
    type: "New home, Fernbrook", title: "Fernbrook house", code: "FF-0367, site plan",
    ask: "A house that steps down the slope, with a studio far enough from the bedrooms to play music late.",
    facts: [["Floor area", "2,100 sq ft"], ["On site", "11 months"], ["Fixed price", "$684,300"], ["Structure", "Timber frame"], ["Bedrooms", "3"], ["Site lead", "Dana Rees"]],
    log: [["Mo 1", "Cut and fill on the slope, retaining wall along the north side."], ["Mo 5", "Frame and roof closed in before the first frost."], ["Mo 11", "Final inspection passed. Twelve-month visit booked."]],
    plan: [
      ["s", "k", "M20 20H460V280H20Z"],
      ["c", "k", "M20 62C140 52 300 84 460 58"], ["c", "k", "M20 132C150 120 300 152 460 126"], ["c", "k", "M20 214C150 204 300 232 460 208"],
      ["L", "b", "Empty plot", 240, 104], ["L", "b", "Falls about 3 m to the south", 240, 176],
      ["o", "a", 110, 70, 290, 70], ["o", "a", 110, 70, 110, 200], ["o", "a", 110, 200, 290, 200], ["o", "a", 290, 70, 290, 110], ["o", "a", 290, 190, 290, 200],
      ["o", "a", 290, 110, 392, 110], ["o", "a", 392, 110, 392, 190], ["o", "a", 290, 190, 392, 190],
      ["i", "a", 200, 70, 200, 200], ["i", "a", 110, 136, 200, 136],
      ["r", "a", 150, 204, 100, 24],
      ["L", "a", "Living", 155, 108], ["L", "a", "Bedrooms", 155, 172], ["L", "a", "Kitchen", 245, 140], ["L", "a", "Studio", 341, 154], ["L", "a", "Porch", 200, 220],
      ["L", "k", "N", 446, 40]
    ]
  }
};

const SVGNS = "http://www.w3.org/2000/svg";
function el(name, attrs) {
  const n = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}
function drawPlan(g, plan) {
  g.replaceChildren();
  const defs = el("defs", {});
  const pat = el("pattern", { id: "ff-hatch", width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
  pat.append(el("rect", { width: 6, height: 6, fill: "#e4e9ee" }), el("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: "#5b7a9a", "stroke-width": 1.1 }));
  defs.append(pat);
  g.append(defs);
  const layers = { base: el("g", {}), walls: el("g", {}), labels: el("g", {}) };
  for (const item of plan) {
    const [kind, when, ...a] = item;
    const cls = `el is-${when}`;
    if ("oigt".includes(kind)) {
      const extra = a[4] === "beam" ? " beam" : "";
      const n = el("line", { x1: a[0], y1: a[1], x2: a[2], y2: a[3], class: `${cls} w w-${kind}${extra}` });
      if (when === "a") n.setAttribute("pathLength", 1);
      (kind === "t" ? layers.base : layers.walls).append(n);
    } else if (kind === "r" || kind === "h") {
      layers.base.append(el("rect", { x: a[0], y: a[1], width: a[2], height: a[3], class: `${cls} ${kind === "h" ? "hatch" : "fill"}`, ...(when === "a" ? { pathLength: 1 } : {}) }));
    } else if (kind === "W") {
      layers.walls.append(el("rect", { x: a[0], y: a[1], width: a[2], height: a[3], class: `${cls} win`, fill: "#f7f8f6", stroke: "#15191c", "stroke-width": 1 }));
    } else if (kind === "c") {
      layers.base.append(el("path", { d: a[0], class: `${cls} contour` }));
    } else if (kind === "s") {
      layers.base.append(el("path", { d: a[0], class: `${cls} site` }));
    } else if (kind === "L") {
      const t = el("text", { x: a[1], y: a[2], "text-anchor": "middle", class: `${cls} lbl` });
      if (a[3]) t.setAttribute("transform", `rotate(${a[3]} ${a[1]} ${a[2]})`);
      t.textContent = a[0];
      layers.labels.append(t);
    }
  }
  g.append(layers.base, layers.walls, layers.labels);
}

const sheet = $("#sheet");
if (sheet) {
  const plan = $(".plan", sheet);
  const g = $("[data-plan]", sheet);
  const tabs = $$('[role="tab"]');
  const viewButtons = $$("[data-view]", sheet).filter(b => b.tagName === "BUTTON");
  const fill = (key, value) => { const n = $(`[data-sheet="${key}"]`, sheet); if (n) n.textContent = value; };
  let current = "orchard";

  function setView(view) {
    plan.dataset.view = view;
    viewButtons.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
    $("#plan-desc").textContent = `${PROJECTS[current].title}, plan ${view === "after" ? "as built" : "as measured"}`;
  }
  function render(id) {
    const p = PROJECTS[id];
    current = id;
    fill("type", p.type); fill("title", p.title); fill("code", p.code); fill("ask", p.ask);
    $('[data-sheet="facts"]', sheet).replaceChildren(...p.facts.map(([k, v]) => { const d = document.createElement("div"); d.innerHTML = "<dt></dt><dd></dd>"; d.firstChild.textContent = k; d.lastChild.textContent = v; return d; }));
    $('[data-sheet="log"]', sheet).replaceChildren(...p.log.map(([w, t]) => { const li = document.createElement("li"); li.innerHTML = '<span class="mono"></span><span></span>'; li.firstChild.textContent = w; li.lastChild.textContent = t; return li; }));
    drawPlan(g, p.plan);
    plan.dataset.view = "before";
    setView("before");
  }
  function select(tab, { focus = false, animate = true } = {}) {
    tabs.forEach(t => { const on = t === tab; t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1; });
    sheet.setAttribute("aria-labelledby", tab.id);
    if (focus) tab.focus();
    if (!animate || reduceMotion.matches) { render(tab.dataset.project); return; }
    sheet.dataset.swapping = "true";
    setTimeout(() => {
      render(tab.dataset.project);
      requestAnimationFrame(() => { sheet.dataset.swapping = "false"; setTimeout(() => setView("after"), 650); });
    }, 180);
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => { if (tab.getAttribute("aria-selected") !== "true") select(tab); });
    tab.addEventListener("keydown", e => {
      const horizontal = getComputedStyle($(".sheet-tabs")).flexDirection === "row";
      const next = horizontal ? "ArrowRight" : "ArrowDown", prev = horizontal ? "ArrowLeft" : "ArrowUp";
      let j = null;
      if (e.key === next) j = (i + 1) % tabs.length;
      else if (e.key === prev) j = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") j = 0;
      else if (e.key === "End") j = tabs.length - 1;
      if (j !== null) { e.preventDefault(); select(tabs[j], { focus: true }); }
    });
  });
  viewButtons.forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));
  plan.addEventListener("click", () => setView(plan.dataset.view === "after" ? "before" : "after"));
  plan.style.cursor = "pointer";
  render("orchard");
  // Draw the first sheet in when it scrolls into view, so the visitor sees the change happen.
  if ("IntersectionObserver" in window && !reduceMotion.matches) {
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { io.disconnect(); setTimeout(() => { if (plan.dataset.view === "before" && current === "orchard") setView("after"); }, 700); }
    }, { threshold: 0.55 });
    io.observe(plan);
  } else setView("after");
}

/* Rough estimate. Fictional rates for this concept, split by trade. */
const KINDS = {
  kitchen: { label: "Kitchen or bathroom", min: 60, max: 400, step: 10, area: 180, rates: [[260, 330], [330, 440], [440, 610]], weeks: [6, 10],
    trades: [["Design and plans", 6], ["Strip-out", 5], ["Wiring and plumbing", 22], ["Cabinetry", 30], ["Worktops and tiling", 17], ["Fittings and lighting", 12], ["Contingency", 8]] },
  addition: { label: "Addition or extension", min: 150, max: 1000, step: 10, area: 380, rates: [[290, 360], [360, 470], [470, 640]], weeks: [12, 20],
    trades: [["Drawings and permit", 8], ["Groundwork and foundations", 15], ["Frame and roof", 22], ["Windows and doors", 13], ["Wiring, plumbing, heating", 15], ["Finishes", 19], ["Contingency", 8]] },
  renovation: { label: "Whole-home renovation", min: 600, max: 3500, step: 50, area: 1650, rates: [[110, 160], [160, 230], [230, 330]], weeks: [16, 30],
    trades: [["Survey and drawings", 6], ["Strip-out and structure", 14], ["Wiring, plumbing, heating", 26], ["Insulation and windows", 16], ["Finishes", 26], ["Contingency", 12]] },
  newhome: { label: "New home", min: 1000, max: 4000, step: 50, area: 2100, rates: [[250, 320], [320, 410], [410, 540]], weeks: [39, 61],
    trades: [["Design and permits", 7], ["Groundwork", 12], ["Structure and roof", 26], ["Windows, doors, cladding", 15], ["Wiring, plumbing, heating", 16], ["Fit-out", 18], ["Contingency", 6]] }
};
const COLORS = ["#15283f", "#1d3a5c", "#3f6488", "#7593b0", "#a9bccd", "#7c8a7a", "#b3262f"];
const FINISH_NOTES = [
  "Good stock items, painted finishes, laminate or compact worktops.",
  "Semi-custom joinery, engineered wood floors, quartz worktops.",
  "Made-to-measure joinery, natural stone, specified fittings and a lighting plan."
];
const BRIEF_TYPE = { kitchen: "Kitchen or bathroom", addition: "Addition or extension", renovation: "Whole-home renovation", newhome: "New home" };

const estForm = $("#est-form");
let lastEstimate = null;
if (estForm) {
  const area = $("#est-area");
  const areaOut = $("#est-area-out");
  const old = $("#est-old");
  const result = $(".est-result");
  const bar = $("[data-bar]", result);
  const rows = $("[data-rows]", result);
  const shown = { low: 0, high: 0 };
  let anim = 0;

  function tween(lowTo, highTo) {
    cancelAnimationFrame(anim);
    const lowEl = $("[data-low]", result), highEl = $("[data-high]", result);
    if (reduceMotion.matches) { shown.low = lowTo; shown.high = highTo; lowEl.textContent = money(lowTo); highEl.textContent = money(highTo); return; }
    const from = { ...shown }, t0 = performance.now(), dur = 420;
    const step = now => {
      const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
      shown.low = from.low + (lowTo - from.low) * e; shown.high = from.high + (highTo - from.high) * e;
      lowEl.textContent = money(roundTo(shown.low, 100)); highEl.textContent = money(roundTo(shown.high, 100));
      if (t < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }

  function setKind(kind, { keepArea = false } = {}) {
    const k = KINDS[kind];
    area.min = k.min; area.max = k.max; area.step = k.step;
    if (!keepArea) area.value = k.area;
    $("[data-min]").textContent = k.min.toLocaleString("en-US");
    $("[data-max]").textContent = k.max.toLocaleString("en-US");
    old.disabled = kind === "newhome";
    if (old.disabled) old.checked = false;
    old.closest(".check").style.opacity = old.disabled ? ".45" : "";
  }

  function compute() {
    const kind = estForm.elements.kind.value;
    const k = KINDS[kind];
    const finish = Number(estForm.elements.finish.value);
    const a = Number(area.value);
    const [rl, rh] = k.rates[finish];
    let low = a * rl, high = a * rh;
    const oldHouse = old.checked && !old.disabled;
    const extraLow = oldHouse ? low * 0.06 : 0, extraHigh = oldHouse ? high * 0.06 : 0;
    const lines = k.trades.map(([name, share], i) => ({ name, share, low: low * share / 100, high: high * share / 100, color: COLORS[i === k.trades.length - 1 ? 6 : i] }));
    const cont = lines[lines.length - 1];
    cont.low += extraLow; cont.high += extraHigh;
    low += extraLow; high += extraHigh;
    lines.forEach(l => { l.pct = Math.round((l.high / high) * 100); });
    const t = (a - k.min) / (k.max - k.min);
    const w = k.weeks[0] + (k.weeks[1] - k.weeks[0]) * t + finish + (oldHouse ? 2 : 0);
    const wLow = Math.round(w), wHigh = Math.round(w * 1.2);
    return { kind, k, finish, area: a, low: roundTo(low, 100), high: roundTo(high, 100), rl, rh, lines, wLow, wHigh, oldHouse };
  }

  function render() {
    const r = compute();
    lastEstimate = r;
    areaOut.textContent = `${r.area.toLocaleString("en-US")} sq ft`;
    // The floor area drawn to scale against the largest area for this kind of job.
    const room = $("[data-area-room]");
    if (room) {
      const side = Math.sqrt(r.area / r.k.max) * 100;
      room.style.width = `${side * 1.4}px`; room.style.height = `${side * 1.4}px`;
      const feet = Math.round(Math.sqrt(r.area));
      $("[data-area-note]").textContent = `About ${feet} ft by ${feet} ft`;
    }
    area.style.setProperty("--fill", `${((r.area - r.k.min) / (r.k.max - r.k.min)) * 100}%`);
    $("[data-finish-note]").textContent = FINISH_NOTES[r.finish];
    tween(r.low, r.high);
    const factor = r.oldHouse ? 1.06 : 1;
    $("[data-rate]", result).textContent = `${money(r.rl * factor)} to ${money(r.rh * factor)} per sq ft`;
    // bar segments, reuse nodes so widths animate
    while (bar.children.length < r.lines.length) bar.append(document.createElement("span"));
    while (bar.children.length > r.lines.length) bar.lastChild.remove();
    r.lines.forEach((l, i) => { const s = bar.children[i]; s.style.setProperty("--c", l.color); s.style.flexGrow = String(l.high); s.dataset.i = i; s.title = l.name; });
    rows.replaceChildren(...r.lines.map((l, i) => {
      const tr = document.createElement("tr");
      tr.dataset.i = i;
      tr.innerHTML = `<td><i style="--c:${l.color}"></i><span></span></td><td>${l.pct}%</td><td>${money(roundTo(l.low, 100))} to ${money(roundTo(l.high, 100))}</td>`;
      tr.querySelector("span").textContent = l.name;
      return tr;
    }));
    const maxW = 72;
    $("[data-weeks-bar]", result).style.setProperty("--w", `${(r.wHigh - r.wLow) / maxW * 100 + 2}%`);
    $("[data-weeks-bar]", result).style.setProperty("--from", `${r.wLow / maxW * 100}%`);
    const months = r.wLow >= 30 ? `, about ${Math.round(r.wLow / 4.33)} to ${Math.round(r.wHigh / 4.33)} months` : "";
    $("[data-weeks]", result).textContent = `${r.wLow} to ${r.wHigh} weeks${months}`;
  }

  function hover(i) {
    if (i == null) { delete bar.dataset.hover; $$("tr", rows).forEach(tr => tr.classList.remove("on")); $$("span", bar).forEach(s => s.classList.remove("on")); return; }
    bar.dataset.hover = "1";
    $$("span", bar).forEach(s => s.classList.toggle("on", s.dataset.i === String(i)));
    $$("tr", rows).forEach(tr => tr.classList.toggle("on", tr.dataset.i === String(i)));
  }
  rows.addEventListener("pointerover", e => { const tr = e.target.closest("tr"); if (tr) hover(tr.dataset.i); });
  rows.addEventListener("pointerleave", () => hover(null));
  bar.addEventListener("pointerover", e => { const s = e.target.closest("span"); if (s) hover(s.dataset.i); });
  bar.addEventListener("pointerleave", () => hover(null));

  estForm.addEventListener("change", e => {
    if (e.target.name === "kind") setKind(e.target.value);
    render();
  });
  area.addEventListener("input", render);
  estForm.addEventListener("submit", e => e.preventDefault());

  $$("[data-estimate]").forEach(btn => btn.addEventListener("click", () => {
    const kind = btn.dataset.estimate;
    const radio = $(`input[name="kind"][value="${kind}"]`, estForm);
    radio.checked = true;
    setKind(kind);
    render();
    $("#estimate").scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" });
    setTimeout(() => radio.focus({ preventScroll: true }), reduceMotion.matches ? 0 : 500);
  }));

  setKind("kitchen", { keepArea: true });
  render();
}

/* Project brief. Everything stays in this page until the visitor downloads the text file. */
const briefForm = $("#brief-form");
const downloadButton = $("#download-brief");
const MIN_SCOPE = 30, MAX_SCOPE = 800;
if (briefForm && downloadButton) {
  const controls = {
    projectType: briefForm.elements.namedItem("projectType"),
    propertyType: briefForm.elements.namedItem("propertyType"),
    scope: briefForm.elements.namedItem("scope"),
    timeframe: briefForm.elements.namedItem("timeframe"),
    budgetBand: briefForm.elements.namedItem("budgetBand")
  };
  const priorityInputs = $$('input[name="priorities"]', briefForm);
  const previewNodes = Object.fromEntries($$("[data-preview]").map(n => [n.dataset.preview, n]));
  const formStatus = $("#form-status");
  const scopeCount = $("#scope-count");
  const previewState = $("#preview-state");
  const estBox = $("[data-brief-est]");
  let briefReady = false;
  let attached = null;

  const getValues = () => ({
    ...Object.fromEntries(Object.entries(controls).map(([k, c]) => [k, c.value.trim()])),
    priorities: priorityInputs.filter(i => i.checked).map(i => i.value)
  });
  const setStatus = (msg, tone = "") => { formStatus.textContent = msg; formStatus.dataset.tone = tone; };
  function setReady(ready) {
    briefReady = ready;
    downloadButton.disabled = !ready;
    previewState.dataset.ready = String(ready);
    previewState.textContent = ready ? "Ready" : "Draft";
    $(".brief-sheet").dataset.ready = String(ready);
  }
  // The draft stays in this browser so a visitor can come back to it. Nothing leaves the device.
  const DRAFT_KEY = "fieldframe.brief-draft.v1";
  function saveDraft() {
    const v = getValues();
    const empty = !Object.values(v).some(x => Array.isArray(x) ? x.length : x) && !attached;
    try {
      if (empty) localStorage.removeItem(DRAFT_KEY);
      else localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...v, estimate: attached ? { kind: attached.kind, area: attached.area, finish: attached.finish, oldHouse: attached.oldHouse, low: attached.low, high: attached.high, wLow: attached.wLow, wHigh: attached.wHigh } : null, saved: Date.now() }));
      $("#draft-note").textContent = empty ? "Saved as a text file on your device. Nothing is sent." : "Draft kept in this browser. Nothing is sent.";
    } catch { $("#draft-note").textContent = "This browser is not keeping drafts, so download the brief before you leave."; }
  }
  function restoreDraft() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch { d = null; }
    if (!d || typeof d !== "object") return false;
    for (const key of Object.keys(controls)) {
      const value = typeof d[key] === "string" ? d[key].slice(0, MAX_SCOPE) : "";
      const c = controls[key];
      if (c.tagName === "SELECT") { if ([...c.options].some(o => o.value === value)) c.value = value; } else c.value = value;
    }
    const picked = Array.isArray(d.priorities) ? d.priorities : [];
    priorityInputs.forEach(i => { i.checked = picked.includes(i.value); });
    const e = d.estimate;
    if (e && KINDS[e.kind] && [e.area, e.finish, e.low, e.high, e.wLow, e.wHigh].every(Number.isFinite)) {
      attached = { ...e, k: KINDS[e.kind], oldHouse: Boolean(e.oldHouse) };
      estBox.hidden = false;
      $("[data-brief-est-text]").textContent = estimateLine(attached);
    }
    return true;
  }
  function updatePreview() {
    const v = getValues();
    for (const key of ["projectType", "propertyType", "timeframe", "budgetBand", "scope"]) {
      const node = previewNodes[key];
      node.textContent = v[key] || node.dataset.empty;
      node.dataset.emptyState = String(!v[key]);
    }
    previewNodes.priorities.textContent = v.priorities.length ? v.priorities.join(", ") : previewNodes.priorities.dataset.empty;
    previewNodes.priorities.dataset.emptyState = String(!v.priorities.length);
    scopeCount.textContent = `${v.scope.length} / ${MAX_SCOPE}`;
    saveDraft();
  }
  function setError(control, message) {
    const node = document.getElementById(control.id + "-error");
    if (message) control.setAttribute("aria-invalid", "true"); else control.removeAttribute("aria-invalid");
    if (node) node.textContent = message;
  }
  function scopeError(scope) {
    if (scope.length < MIN_SCOPE) { const m = MIN_SCOPE - scope.length; return `Add ${m} more ${m === 1 ? "character" : "characters"} so we understand the job.`; }
    if (scope.length > MAX_SCOPE) return `Keep this under ${MAX_SCOPE} characters.`;
    return "";
  }
  function validate({ focus = true } = {}) {
    const v = getValues();
    const checks = [["projectType", "Choose a project type."], ["propertyType", "Choose a property type."], ["scope", null], ["timeframe", "Choose when you would like to start."], ["budgetBand", "Choose a budget range."]];
    let first = null;
    for (const [key, message] of checks) {
      const err = key === "scope" ? scopeError(v.scope) : v[key] ? "" : message;
      setError(controls[key], err);
      if (err && !first) first = controls[key];
    }
    if (first) {
      setReady(false);
      setStatus("A few answers are missing. Check the highlighted fields.", "error");
      if (focus) first.focus();
      return false;
    }
    setReady(true);
    setStatus("Your brief is ready to download.", "ok");
    return true;
  }
  function estimateLine(e) {
    const old = e.oldHouse ? ", house built before 1950" : "";
    return `${e.k.label}, ${e.area.toLocaleString("en-US")} sq ft, ${["standard", "mid", "considered"][e.finish]} finish${old}: ${money(e.low)} to ${money(e.high)}, ${e.wLow} to ${e.wHigh} weeks on site`;
  }
  function buildText(v) {
    const lines = [
      "FIELD & FRAME PROJECT BRIEF", "",
      `Project: ${v.projectType}`, `Property: ${v.propertyType}`, `Start: ${v.timeframe}`, `Budget: ${v.budgetBand}`,
      `Priorities: ${v.priorities.length ? v.priorities.join(", ") : "None picked"}`
    ];
    if (attached) lines.push(`Rough estimate: ${estimateLine(attached)} (indicative only, not a quote)`);
    lines.push("", "What should change", v.scope, "",
      "Bring this brief to your site visit. We will walk the house with you, measure up and follow with a written scope and fixed price.", "",
      "Prepared on this device. Nothing was sent.");
    return lines.join("\r\n") + "\r\n";
  }
  function onEdit() {
    updatePreview();
    if (briefReady || briefForm.querySelector('[aria-invalid="true"]')) validate({ focus: false });
  }
  Object.values(controls).forEach(c => { c.addEventListener("input", onEdit); c.addEventListener("change", onEdit); });
  priorityInputs.forEach(i => i.addEventListener("change", updatePreview));
  briefForm.addEventListener("submit", e => { e.preventDefault(); updatePreview(); if (validate()) downloadButton.focus(); });
  downloadButton.addEventListener("click", () => {
    if (!briefReady || !validate()) return;
    const file = new Blob([buildText(getValues())], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url; a.download = "field-frame-project-brief.txt"; a.hidden = true;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("Brief downloaded to your device. Nothing was sent.", "ok");
  });

  function attach(e) {
    attached = e;
    estBox.hidden = !e;
    if (e) {
      $("[data-brief-est-text]").textContent = estimateLine(e);
      controls.projectType.value = BRIEF_TYPE[e.kind];
      const mid = (e.low + e.high) / 2;
      controls.budgetBand.value = mid < 50000 ? "Under $50,000" : mid < 150000 ? "$50,000 to $150,000" : mid < 400000 ? "$150,000 to $400,000" : "Over $400,000";
      if (e.kind === "newhome" && !controls.propertyType.value) controls.propertyType.value = "Empty plot";
    }
    onEdit();
  }
  $("[data-to-brief]")?.addEventListener("click", () => { if (lastEstimate) attach(lastEstimate); });
  $("[data-brief-est-clear]")?.addEventListener("click", () => { attach(null); downloadButton.disabled ? controls.projectType.focus() : downloadButton.focus(); });
  $("#clear-brief")?.addEventListener("click", () => {
    if (!window.confirm("Clear every answer in this brief?")) return;
    briefForm.reset(); attached = null; estBox.hidden = true;
    Object.values(controls).forEach(c => setError(c, ""));
    setReady(false); updatePreview(); setStatus("Brief cleared.", "");
    controls.projectType.focus();
  });
  const restored = restoreDraft();
  updatePreview();
  if (restored) { const v = getValues(); if (v.projectType && v.propertyType && v.timeframe && v.budgetBand && v.scope.length >= MIN_SCOPE) validate({ focus: false }); setStatus("Your saved draft is back.", ""); }
}
