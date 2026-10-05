const menuButton = document.querySelector("[data-menu-toggle]");
const siteNav = document.querySelector("[data-site-nav]");

function setMenu(open) {
  if (!menuButton || !siteNav) return;
  menuButton.setAttribute("aria-expanded", String(open));
  siteNav.dataset.open = String(open);
}

if (menuButton && siteNav) {
  menuButton.addEventListener("click", () => {
    setMenu(menuButton.getAttribute("aria-expanded") !== "true");
  });
  siteNav.addEventListener("click", event => {
    if (event.target instanceof Element && event.target.closest("a")) setMenu(false);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
      setMenu(false);
      menuButton.focus();
    }
  });
}

const briefForm = document.querySelector("#brief-form");
const downloadButton = document.querySelector("#download-brief");

if (briefForm && downloadButton) {
  const controls = {
    projectType: briefForm.elements.namedItem("projectType"),
    propertyType: briefForm.elements.namedItem("propertyType"),
    scope: briefForm.elements.namedItem("scope"),
    timeframe: briefForm.elements.namedItem("timeframe"),
    budgetBand: briefForm.elements.namedItem("budgetBand")
  };
  const previewNodes = Object.fromEntries(
    [...document.querySelectorAll("[data-preview]")].map(node => [node.dataset.preview, node])
  );
  const formStatus = document.querySelector("#form-status");
  const scopeCount = document.querySelector("#scope-count");
  let briefReady = false;

  function getValues() {
    return Object.fromEntries(
      Object.entries(controls).map(([key, control]) => [key, control.value.trim()])
    );
  }

  function updatePreview() {
    const values = getValues();
    for (const key of ["projectType", "propertyType", "timeframe", "budgetBand"]) {
      previewNodes[key].textContent = values[key] || "Not selected";
    }
    previewNodes.scope.textContent = values.scope || "Your project notes will appear here as you write.";
    scopeCount.textContent = controls.scope.value.length + " / 800";
  }

  function setError(control, message) {
    const errorNode = document.querySelector("#" + control.id + "-error");
    control.setAttribute("aria-invalid", message ? "true" : "false");
    if (errorNode) errorNode.textContent = message;
  }

  function validate(shouldFocus = true) {
    let firstInvalid = null;
    const values = getValues();
    const checks = [
      ["projectType", "Choose a project type."],
      ["propertyType", "Choose a property type."],
      ["timeframe", "Choose a timeframe."],
      ["budgetBand", "Choose a budget band."]
    ];
    for (const [key, message] of checks) {
      const control = controls[key];
      const error = values[key] ? "" : message;
      setError(control, error);
      if (error && !firstInvalid) firstInvalid = control;
    }
    const scopeError = values.scope.length < 30 ? "Add at least 30 characters so the brief has useful scope." : values.scope.length > 800 ? "Keep the project scope within 800 characters." : "";
    setError(controls.scope, scopeError);
    if (scopeError && !firstInvalid) firstInvalid = controls.scope;
    if (firstInvalid) {
      briefReady = false;
      downloadButton.disabled = true;
      formStatus.textContent = "Complete the highlighted fields to prepare your brief.";
      if (shouldFocus) firstInvalid.focus();
      return false;
    }
    briefReady = true;
    downloadButton.disabled = false;
    formStatus.textContent = "Your local brief is ready to review and download.";
    updatePreview();
    return true;
  }

  function buildText(values) {
    return [
      "FIELD & FRAME | PROJECT STARTER",
      "Independent fictional portfolio concept. No construction services are offered.",
      "",
      "PROJECT TYPE", values.projectType, "",
      "PROPERTY TYPE", values.propertyType, "",
      "EARLY SCOPE", values.scope, "",
      "TIMEFRAME", values.timeframe, "",
      "BUDGET BAND", values.budgetBand + " (currency to be agreed)", "",
      "NEXT DISCUSSION",
      "Confirm services, location, approved photos, detailed scope, currency, timing, enquiry destination and hosting before agreeing any real project.",
      "",
      "This file was created locally in your browser. It has not been sent."
    ].join("\n");
  }

  for (const control of Object.values(controls)) {
    control.addEventListener("input", () => {
      updatePreview();
      if (briefReady || control.getAttribute("aria-invalid") === "true") validate(false);
    });
    control.addEventListener("change", () => {
      updatePreview();
      if (briefReady || control.getAttribute("aria-invalid") === "true") validate(false);
    });
  }
  briefForm.addEventListener("submit", event => {
    event.preventDefault();
    updatePreview();
    validate();
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
    formStatus.textContent = "The text brief was created in this browser. No details were sent.";
  });
  updatePreview();
}
