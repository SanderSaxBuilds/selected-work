"use strict";

/* Mobile navigation: open, close, Escape, outside click, focus trap */
const menuButton = document.querySelector("[data-menu-toggle]");
const siteNav = document.querySelector("[data-site-nav]");
const phoneNav = window.matchMedia("(max-width: 860px)");

function menuIsOpen() {
  return menuButton?.getAttribute("aria-expanded") === "true";
}

function setMenu(open, { returnFocus = false } = {}) {
  if (!menuButton || !siteNav) return;
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.querySelector(".menu-label").textContent = open ? "Close" : "Menu";
  siteNav.dataset.open = String(open);
  document.body.dataset.menuOpen = String(open);
  if (open) siteNav.querySelector("a")?.focus();
  else if (returnFocus) menuButton.focus();
}

if (menuButton && siteNav) {
  menuButton.addEventListener("click", () => setMenu(!menuIsOpen()));
  siteNav.addEventListener("click", event => {
    if (event.target instanceof Element && event.target.closest("a")) setMenu(false);
  });
  document.addEventListener("click", event => {
    if (!menuIsOpen() || !(event.target instanceof Element)) return;
    if (!event.target.closest("[data-site-nav]") && !event.target.closest("[data-menu-toggle]")) setMenu(false);
  });
  document.addEventListener("keydown", event => {
    if (!menuIsOpen()) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setMenu(false, { returnFocus: true });
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [menuButton, ...siteNav.querySelectorAll("a")];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const index = focusable.indexOf(document.activeElement);
    if (event.shiftKey && (document.activeElement === first || index === -1)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || index === -1)) {
      event.preventDefault();
      first.focus();
    }
  });
  phoneNav.addEventListener("change", event => {
    if (!event.matches && menuIsOpen()) setMenu(false);
  });
}

/* Project brief planner. Everything stays in this page until the visitor downloads the text file. */
const briefForm = document.querySelector("#brief-form");
const downloadButton = document.querySelector("#download-brief");
const MIN_SCOPE = 30;
const MAX_SCOPE = 800;
const EMPTY = "Not chosen yet";

if (briefForm && downloadButton) {
  const controls = {
    projectType: briefForm.elements.namedItem("projectType"),
    propertyType: briefForm.elements.namedItem("propertyType"),
    scope: briefForm.elements.namedItem("scope"),
    timeframe: briefForm.elements.namedItem("timeframe"),
    budgetBand: briefForm.elements.namedItem("budgetBand")
  };
  const priorityInputs = [...briefForm.querySelectorAll('input[name="priorities"]')];
  const previewNodes = Object.fromEntries(
    [...document.querySelectorAll("[data-preview]")].map(node => [node.dataset.preview, node])
  );
  const formStatus = document.querySelector("#form-status");
  const scopeCount = document.querySelector("#scope-count");
  const previewState = document.querySelector("#preview-state");
  let briefReady = false;

  const getValues = () => ({
    ...Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control.value.trim()])),
    priorities: priorityInputs.filter(input => input.checked).map(input => input.value)
  });

  function setStatus(message, tone = "") {
    formStatus.textContent = message;
    formStatus.dataset.tone = tone;
  }

  function setReady(ready) {
    briefReady = ready;
    downloadButton.disabled = !ready;
    previewState.dataset.ready = String(ready);
    previewState.textContent = ready ? "Ready" : "In progress";
  }

  function updatePreview() {
    const values = getValues();
    for (const key of ["projectType", "propertyType", "timeframe", "budgetBand"]) {
      previewNodes[key].textContent = values[key] || EMPTY;
    }
    previewNodes.priorities.textContent = values.priorities.length ? values.priorities.join(", ") : "None picked";
    previewNodes.scope.textContent = values.scope || "Your notes appear here as you type.";
    // Count the trimmed text, because that is what validation and the download use.
    scopeCount.textContent = `${values.scope.length} / ${MAX_SCOPE}`;
  }

  function setError(control, message) {
    const errorNode = document.getElementById(control.id + "-error");
    if (message) control.setAttribute("aria-invalid", "true");
    else control.removeAttribute("aria-invalid");
    if (errorNode) errorNode.textContent = message;
  }

  function scopeError(scope) {
    if (scope.length < MIN_SCOPE) {
      const missing = MIN_SCOPE - scope.length;
      return `Add ${missing} more ${missing === 1 ? "character" : "characters"} so we understand the job.`;
    }
    if (scope.length > MAX_SCOPE) return `Keep this under ${MAX_SCOPE} characters.`;
    return "";
  }

  function validate({ focus = true } = {}) {
    const values = getValues();
    const checks = [
      ["projectType", "Choose a project type."],
      ["propertyType", "Choose a property type."],
      ["scope", null],
      ["timeframe", "Choose when you would like to start."],
      ["budgetBand", "Choose a budget range."]
    ];
    let firstInvalid = null;
    for (const [key, message] of checks) {
      const error = key === "scope" ? scopeError(values.scope) : values[key] ? "" : message;
      setError(controls[key], error);
      if (error && !firstInvalid) firstInvalid = controls[key];
    }
    if (firstInvalid) {
      setReady(false);
      setStatus("A few answers are missing. Check the highlighted fields.", "error");
      if (focus) firstInvalid.focus();
      return false;
    }
    setReady(true);
    setStatus("Your brief is ready to download.", "ok");
    return true;
  }

  function buildText(values) {
    const lines = [
      "FIELD & FRAME PROJECT BRIEF",
      "",
      `Project: ${values.projectType}`,
      `Property: ${values.propertyType}`,
      `Start: ${values.timeframe}`,
      `Budget: ${values.budgetBand}`,
      `Priorities: ${values.priorities.length ? values.priorities.join(", ") : "None picked"}`,
      "",
      "What should change",
      values.scope,
      "",
      "Bring this brief to your site visit. We will walk the house with you, measure up and follow with a written scope and fixed price.",
      "",
      "Prepared on this device. Nothing was sent."
    ];
    return lines.join("\r\n") + "\r\n";
  }

  function onEdit() {
    updatePreview();
    if (briefReady || briefForm.querySelector('[aria-invalid="true"]')) validate({ focus: false });
  }

  for (const control of Object.values(controls)) {
    control.addEventListener("input", onEdit);
    control.addEventListener("change", onEdit);
  }
  for (const input of priorityInputs) input.addEventListener("change", updatePreview);

  briefForm.addEventListener("submit", event => {
    event.preventDefault();
    updatePreview();
    if (validate()) downloadButton.focus();
  });

  downloadButton.addEventListener("click", () => {
    if (!briefReady || !validate()) return;
    const file = new Blob([buildText(getValues())], { type: "text/plain;charset=utf-8" });
    const fileUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = "field-frame-project-brief.txt";
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
    setStatus("Brief downloaded to your device. Nothing was sent.", "ok");
  });

  /* Service links preselect the matching project type */
  document.querySelectorAll("a[data-project]").forEach(link => {
    link.addEventListener("click", () => {
      controls.projectType.value = link.dataset.project;
      onEdit();
    });
  });

  updatePreview();
}
