(() => {
  "use strict";

  const colors = [
    { key: "moss", label: "Moss", swatch: "#5f7462", note: "Green grey" },
    { key: "glacier", label: "Glacier", swatch: "#b3c3c5", note: "Cold blue grey" },
    { key: "basalt", label: "Basalt", swatch: "#303336", note: "Soft black" }
  ];
  const sizes = ["500 ml", "750 ml"];
  const VIEWS = ["front", "open", "detail", "sizes"];
  const VIEW_NAMES = ["Front", "Lid off", "Cap and lip", "Both sizes"];
  const media = (color, size) => VIEWS.map((view) => `assets/${color}-${size.slice(0, 3)}-${view}.svg`);
  const variants = [
    { id: "8901001", color: "moss", size: "500 ml", priceCents: 3600, available: true },
    { id: "8901002", color: "moss", size: "750 ml", priceCents: 4200, available: true },
    { id: "8901003", color: "glacier", size: "500 ml", priceCents: 3800, available: true },
    { id: "8901004", color: "glacier", size: "750 ml", priceCents: 4400, available: false },
    { id: "8901005", color: "basalt", size: "500 ml", priceCents: 3700, available: true },
    { id: "8901006", color: "basalt", size: "750 ml", priceCents: 4300, available: true }
  ].map((variant) => ({ ...variant, media: media(variant.color, variant.size) }));
  const MISSING_IMAGE = "qa-fixtures/intentional-404.svg";
  const MAX_QTY = 9;
  const ENGRAVE_CENTS = 600;
  const FREE_SHIP = 5000;
  /* Engraving sits on the lower body. These match the render geometry in the SVG files. */
  const ENGRAVE_Y = { "500 ml": 876, "750 ml": 841 };

  const byId = new Map(variants.map((variant) => [variant.id, variant]));
  const byOptions = new Map(variants.map((variant) => [`${variant.color}|${variant.size}`, variant]));
  const $ = (selector) => document.querySelector(selector);
  const colorOptions = $("#colorOptions");
  const sizeOptions = $("#sizeOptions");
  const galleryThumbnails = $("#galleryThumbnails");
  const mainImage = $("#mainImage");
  const mediaStage = $("#mediaStage");
  const zoomFrame = $("#zoomFrame");
  const mediaSkeleton = $("#mediaSkeleton");
  const mediaFallback = $("#mediaFallback");
  const fallbackDescription = $("#fallbackDescription");
  const behaviorMode = $("#behaviorMode");
  const defectNote = $("#defectNote");
  const missingAssetNote = $("#missingAssetNote");
  const liveStatus = $("#liveStatus");
  const linkMessage = $("#linkMessage");
  const priceValue = $("#priceValue");
  const availabilityCard = $("#availabilityCard");
  const addButton = $("#addToBag");
  const qtyValue = $("#qtyValue");
  const bagDialog = $("#bagDialog");
  const engraveOn = $("#engraveOn");
  const engraveInput = $("#engraveInput");
  const engraveLayer = $("#engraveLayer");
  const engraveText = $("#engraveText");
  const zoomButton = $("#zoomButton");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  let activeVariant = variants[0];
  let activeMediaIndex = 0;
  let renderedMediaKey = "";
  let requestToken = 0;
  let isUnknownLink = false;
  let behavior = "fixed";
  let quantity = 1;
  let toastTimer = 0;
  let zoomed = false;
  const bag = new Map();

  const formatUsd = (cents) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  const colorLabel = (key) => colors.find((color) => color.key === key)?.label ?? key;
  const viewName = (index) => VIEW_NAMES[index] ?? "View";
  const optionName = (variant) => `${colorLabel(variant.color)}, ${variant.size}`;
  const optionShort = (variant) => `${colorLabel(variant.color)} ${variant.size}`;
  const engraving = () => (engraveOn.checked ? engraveInput.value.trim().replace(/\s+/g, " ") : "");
  const unitCents = () => activeVariant.priceCents + (engraving() ? ENGRAVE_CENTS : 0);

  function mediaAlt(variant, index) {
    const base = `${colorLabel(variant.color)} Stillwater Bottle, ${variant.size}`;
    return [
      `${base}, front view on a studio sweep`,
      `${base}, lid off and set down beside the bottle, showing the threaded steel neck`,
      `${base}, close view of the cap, its knurled grip and the bare steel lip`,
      `${colorLabel(variant.color)} Stillwater Bottle in 750 ml and 500 ml side by side, ${variant.size} marked`
    ][index] ?? base;
  }

  /* Options are built once. Later updates change them in place so keyboard focus is never lost. */
  function buildOptions() {
    colors.forEach((color) => {
      const label = document.createElement("label");
      label.className = "color-choice";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "color";
      radio.value = color.key;
      radio.id = `color-${color.key}`;
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.setProperty("--swatch", color.swatch);
      swatch.setAttribute("aria-hidden", "true");
      const text = document.createElement("span");
      text.className = "choice-text";
      text.textContent = color.label;
      label.append(radio, swatch, text);
      colorOptions.append(label);
    });
    sizes.forEach((size, index) => {
      const label = document.createElement("label");
      label.className = "size-choice";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "size";
      radio.value = size;
      radio.id = `size-${index}`;
      const text = document.createElement("span");
      text.className = "size-label";
      text.textContent = size;
      const hint = document.createElement("span");
      hint.className = "size-hint";
      hint.textContent = index === 0 ? "Fits a cup holder" : "For a long day";
      const price = document.createElement("span");
      price.className = "size-price figure";
      const note = document.createElement("span");
      note.className = "option-note";
      label.append(radio, text, hint, price, note);
      sizeOptions.append(label);
    });
  }

  function updateControls() {
    colorOptions.querySelectorAll('input[name="color"]').forEach((radio) => {
      radio.checked = radio.value === activeVariant.color;
    });
    sizeOptions.querySelectorAll(".size-choice").forEach((label) => {
      const radio = label.querySelector("input");
      const variant = byOptions.get(`${activeVariant.color}|${radio.value}`);
      radio.checked = radio.value === activeVariant.size;
      label.dataset.available = String(variant.available);
      label.querySelector(".size-price").textContent = formatUsd(variant.priceCents);
      label.querySelector(".option-note").textContent = variant.available ? "" : "Sold out";
    });
    $("#currentColor").textContent = colorLabel(activeVariant.color);
    $("#currentSize").textContent = activeVariant.size;
    document.body.dataset.tone = activeVariant.color;
    const swatch = colors.find((c) => c.key === activeVariant.color).swatch;
    $("#buyBarSwatch").style.background = swatch;
    $("#storyImage").src = `assets/${activeVariant.color}-500-detail.svg`;
    $("#storyImage").alt = `Close view of the ${colorLabel(activeVariant.color)} cap, its knurled grip and the bare steel lip`;
    $("#sizesImage").src = `assets/${activeVariant.color}-${activeVariant.size.slice(0, 3)}-sizes.svg`;
    $("#sizesImage").alt = mediaAlt(activeVariant, 3);
  }

  function updatePriceAndAvailability() {
    const unit = unitCents();
    priceValue.textContent = formatUsd(unit);
    $("#priceMeta").textContent = `${activeVariant.size}, ${colorLabel(activeVariant.color)}${engraving() ? ", engraved" : ""}`;
    availabilityCard.dataset.available = String(activeVariant.available);
    $("#availabilityLabel").textContent = activeVariant.available ? "In stock" : "Sold out";
    $("#availabilityDescription").textContent = activeVariant.available
      ? (engraving() ? "Engraved and shipped in 3 to 4 business days." : "Ships in 1 to 2 business days.")
      : `${optionShort(activeVariant)} is restocking. The other options ship now.`;
    const swap = $("#swapOption");
    const alt = activeVariant.available ? null
      : variants.find((v) => v.available && v.color === activeVariant.color) || variants.find((v) => v.available && v.size === activeVariant.size);
    swap.hidden = !alt;
    if (alt) { swap.dataset.variant = alt.id; swap.textContent = `Show ${optionShort(alt)} instead, ${formatUsd(alt.priceCents)}`; }
    addButton.disabled = !activeVariant.available;
    addButton.textContent = activeVariant.available ? `Add to bag, ${formatUsd(unit * quantity)}` : "Sold out";
    const barAdd = $("#buyBarAdd");
    barAdd.disabled = !activeVariant.available;
    barAdd.textContent = activeVariant.available ? `Add, ${formatUsd(unit * quantity)}` : "Sold out";
    $("#buyBarMeta").textContent = `${optionName(activeVariant)}${engraving() ? `, "${engraving()}"` : ""}`;
    document.body.dataset.variantId = activeVariant.id;
    document.body.dataset.exampleMode = behavior;
  }

  function writeUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set("variant", activeVariant.id);
    window.history.replaceState(window.history.state, "", url);
    isUnknownLink = false;
    linkMessage.hidden = true;
  }

  function setIndexLabel() {
    const count = activeVariant.media.length;
    $("#imageIndex").textContent = count ? `${activeMediaIndex + 1} / ${count}` : "No photo";
    $("#viewName").textContent = viewName(activeMediaIndex);
  }

  function renderThumbnails() {
    const key = activeVariant.media.join("|");
    if (key !== renderedMediaKey) {
      renderedMediaKey = key;
      galleryThumbnails.replaceChildren();
      activeVariant.media.forEach((src, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "thumb-button";
        button.dataset.index = String(index);
        const image = document.createElement("img");
        image.src = src;
        image.alt = "";
        image.width = 80;
        image.height = 100;
        button.append(image);
        galleryThumbnails.append(button);
      });
    }
    galleryThumbnails.querySelectorAll(".thumb-button").forEach((button, index) => {
      button.setAttribute("aria-label", `${viewName(index)}, ${optionName(activeVariant)}`);
      button.setAttribute("aria-pressed", String(index === activeMediaIndex));
    });
    setIndexLabel();
  }

  function showFallback(message) {
    mainImage.hidden = true;
    mediaSkeleton.hidden = true;
    mediaFallback.hidden = false;
    fallbackDescription.textContent = message;
    mediaStage.dataset.galleryState = "fallback";
    mediaStage.setAttribute("aria-busy", "false");
    syncEngraveLayer();
  }

  function syncEngraveLayer() {
    const text = engraving();
    const show = Boolean(text) && behavior === "fixed" && mediaStage.dataset.galleryState === "ready"
      && mainImage.dataset.mediaIndex === "0" && mainImage.dataset.renderedVariantId === activeVariant.id;
    engraveText.textContent = text.toUpperCase();
    engraveText.setAttribute("y", String(ENGRAVE_Y[activeVariant.size]));
    engraveLayer.toggleAttribute("hidden", !show);
  }

  function paintMedia() {
    requestToken += 1;
    const token = requestToken;
    if (behavior === "stale") {
      mediaStage.dataset.galleryState = "synthetic-stale";
      mediaStage.setAttribute("aria-busy", "false");
      syncEngraveLayer();
      return;
    }

    const src = behavior === "missing-file" ? MISSING_IMAGE : activeVariant.media[activeMediaIndex];
    mediaFallback.hidden = true;
    if (!src) {
      showFallback(`There is no photo for ${optionShort(activeVariant)} yet.`);
      return;
    }

    mediaStage.dataset.galleryState = "loading";
    mediaStage.setAttribute("aria-busy", "true");
    const keepPrevious = !mainImage.hidden && mainImage.getAttribute("src");
    mediaSkeleton.hidden = Boolean(keepPrevious);
    const variant = activeVariant;
    const index = activeMediaIndex;
    const probe = new Image();
    probe.onload = () => {
      if (token !== requestToken || behavior === "stale") return;
      mainImage.src = src;
      mainImage.alt = mediaAlt(variant, index);
      mainImage.dataset.renderedVariantId = variant.id;
      mainImage.dataset.mediaIndex = String(index);
      mainImage.hidden = false;
      mediaSkeleton.hidden = true;
      mediaStage.dataset.galleryState = "ready";
      mediaStage.setAttribute("aria-busy", "false");
      syncEngraveLayer();
      updateLiveStatus();
    };
    probe.onerror = () => {
      if (token !== requestToken || behavior === "stale") return;
      mainImage.dataset.renderedVariantId = "";
      showFallback("The photo could not be loaded. You can still pick an option and add it to your bag.");
      updateLiveStatus();
    };
    probe.src = src;
  }

  function updateLiveStatus(prefix = "") {
    const availability = activeVariant.available ? "In stock" : "Sold out";
    const linkStatus = isUnknownLink ? "That link points to an option we don't have, so the default is shown. " : "";
    let mediaStatus;
    if (behavior === "stale") {
      mediaStatus = mainImage.dataset.renderedVariantId !== activeVariant.id ? "The photo still shows the earlier option." : "Photo unchanged.";
    } else if (mediaStage.dataset.galleryState === "loading") {
      mediaStatus = "Photo loading.";
    } else if (mediaStage.dataset.galleryState === "ready") {
      mediaStatus = `${viewName(activeMediaIndex)} shown.`;
    } else {
      mediaStatus = "Photo unavailable.";
    }
    liveStatus.textContent = `${linkStatus}${prefix}${optionName(activeVariant)}, ${formatUsd(unitCents())}. ${availability}. ${mediaStatus}`;
  }

  function syncView({ writeLink = false } = {}) {
    updateControls();
    updatePriceAndAvailability();
    renderThumbnails();
    paintMedia();
    if (writeLink) writeUrl();
    updateLiveStatus();
    updateDayAnswer();
  }

  function selectMedia(index, { focus = false } = {}) {
    const count = activeVariant.media.length;
    if (!count) return;
    activeMediaIndex = (index + count) % count;
    setZoom(false);
    renderThumbnails();
    paintMedia();
    updateLiveStatus();
    if (focus) galleryThumbnails.querySelectorAll(".thumb-button")[activeMediaIndex]?.focus();
  }

  function onOptionChange(event) {
    if (!event.target.matches('input[name="color"], input[name="size"]')) return;
    const colorInput = colorOptions.querySelector('input[name="color"]:checked');
    const sizeInput = sizeOptions.querySelector('input[name="size"]:checked');
    const next = byOptions.get(`${colorInput?.value}|${sizeInput?.value}`);
    if (!next) return;
    activeVariant = next;
    activeMediaIndex = 0;
    setZoom(false);
    syncView({ writeLink: true });
  }

  /* Reads ?variant= from the current address. Used on load and on Back or Forward. */
  function readUrl() {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("variant");
    if (requested === null) {
      isUnknownLink = false;
      activeVariant = variants[0];
    } else if (byId.has(requested)) {
      isUnknownLink = false;
      activeVariant = byId.get(requested);
    } else {
      isUnknownLink = true;
      activeVariant = variants[0];
    }
    linkMessage.hidden = !isUnknownLink;
  }

  /* Zoom: the stage scales the photo and follows the pointer, or pans by keyboard */
  let origin = { x: 50, y: 42 };
  function setZoom(on) {
    zoomed = on && mediaStage.dataset.galleryState === "ready";
    mediaStage.dataset.zoom = zoomed ? "on" : "off";
    zoomButton.setAttribute("aria-pressed", String(zoomed));
    $("#zoomLabel").textContent = zoomed ? "Zoom out" : "Zoom";
    if (!zoomed) origin = { x: 50, y: 42 };
    zoomFrame.style.transformOrigin = `${origin.x}% ${origin.y}%`;
  }
  function panTo(x, y) {
    origin = { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) };
    zoomFrame.style.transformOrigin = `${origin.x}% ${origin.y}%`;
  }
  zoomButton.addEventListener("click", () => {
    setZoom(!zoomed);
    liveStatus.textContent = zoomed ? "Zoomed in. Move the pointer or use the arrow keys on the zoom button to look around." : "Zoomed out.";
  });
  zoomButton.addEventListener("keydown", (event) => {
    if (!zoomed) return;
    const step = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8] }[event.key];
    if (step) { event.preventDefault(); panTo(origin.x + step[0], origin.y + step[1]); }
    if (event.key === "Escape") setZoom(false);
  });

  let swipe = null;
  zoomFrame.addEventListener("pointerdown", (event) => {
    swipe = { x: event.clientX, y: event.clientY, id: event.pointerId };
    if (zoomed && event.pointerType !== "mouse") zoomFrame.setPointerCapture(event.pointerId);
  });
  zoomFrame.addEventListener("pointermove", (event) => {
    if (!zoomed) return;
    const rect = zoomFrame.getBoundingClientRect();
    if (event.pointerType === "mouse" || swipe) panTo(((event.clientX - rect.left) / rect.width) * 100, ((event.clientY - rect.top) / rect.height) * 100);
  });
  zoomFrame.addEventListener("pointerup", (event) => {
    if (!swipe) return;
    const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
    swipe = null;
    if (zoomed) return;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) selectMedia(activeMediaIndex + (dx < 0 ? 1 : -1));
    else if (Math.abs(dx) < 6 && Math.abs(dy) < 6 && event.pointerType === "mouse") setZoom(true);
  });
  zoomFrame.addEventListener("pointercancel", () => { swipe = null; });
  mediaStage.addEventListener("mouseleave", () => { if (zoomed) setZoom(false); });
  $("#prevView").addEventListener("click", () => selectMedia(activeMediaIndex - 1));
  $("#nextView").addEventListener("click", () => selectMedia(activeMediaIndex + 1));

  /* Engraving */
  function sanitize(value) { return value.replace(/[^A-Za-z0-9 .\-]/g, "").slice(0, 14); }
  engraveOn.addEventListener("change", () => {
    $("#engraveField").hidden = !engraveOn.checked;
    if (engraveOn.checked) {
      engraveInput.focus();
      if (activeMediaIndex !== 0) selectMedia(0);
    }
    syncEngraveLayer();
    updatePriceAndAvailability();
    updateLiveStatus(engraveOn.checked ? "Engraving on, plus $6. " : "Engraving off. ");
  });
  engraveInput.addEventListener("input", () => {
    const clean = sanitize(engraveInput.value);
    if (clean !== engraveInput.value) engraveInput.value = clean;
    $("#engraveCount").textContent = `${clean.length}/14`;
    if (activeMediaIndex !== 0 && clean) selectMedia(0);
    syncEngraveLayer();
    updatePriceAndAvailability();
  });

  /* Size advice */
  function updateDayAnswer() {
    const hours = Number($("#hoursOut").value);
    $("#hoursOut-out").textContent = `${hours} ${hours === 1 ? "hour" : "hours"}`;
    const ml = hours * 125;
    const pick = ml > 560 ? "750 ml" : "500 ml";
    const variant = byOptions.get(`${activeVariant.color}|${pick}`);
    const refills = ml > 750 ? " with one refill on the way" : "";
    $("#dayAnswer").innerHTML = "";
    const strong = document.createElement("strong");
    strong.textContent = pick;
    $("#dayAnswer").append("About ", `${ml} ml of water. `, strong, ` covers it${refills}${pick === "500 ml" ? " and stays lighter in the bag" : ""}.`);
    const button = $("#pickSize");
    button.dataset.size = pick;
    const chosen = activeVariant.size === pick;
    button.textContent = chosen ? `${pick} is selected` : (variant.available ? `Choose ${pick}` : `Choose ${pick}, sold out in ${colorLabel(activeVariant.color)}`);
    button.disabled = chosen;
  }
  $("#hoursOut").addEventListener("input", updateDayAnswer);
  $("#pickSize").addEventListener("click", (event) => {
    const next = byOptions.get(`${activeVariant.color}|${event.currentTarget.dataset.size}`);
    if (!next) return;
    activeVariant = next;
    activeMediaIndex = 0;
    syncView({ writeLink: true });
    toast(`${optionShort(next)} selected.`);
  });

  /* Bag, one line per variant and engraving */
  const lineKey = (id, text) => `${id}|${text}`;
  function bagItemCount() {
    let count = 0;
    bag.forEach((line) => { count += line.qty; });
    return count;
  }

  function renderBag() {
    const count = bagItemCount();
    $("#bagCount").textContent = String(count);
    $("#bagButton").setAttribute("aria-label", `Bag, ${count} ${count === 1 ? "item" : "items"}`);
    const lines = $("#bagLines");
    lines.replaceChildren();
    if (!count) {
      const wrap = document.createElement("div");
      wrap.className = "bag-empty-wrap";
      const empty = document.createElement("p");
      empty.className = "bag-empty";
      empty.textContent = "Your bag is empty. Orders of $50 or more ship free.";
      const back = document.createElement("button");
      back.type = "button";
      back.className = "ghost-button";
      back.dataset.close = "";
      back.textContent = "Keep looking";
      wrap.append(empty, back);
      lines.append(wrap);
      $("#bagFoot").hidden = true;
      return;
    }
    let subtotal = 0;
    bag.forEach((line, key) => {
      const variant = byId.get(line.id);
      const unit = variant.priceCents + (line.text ? ENGRAVE_CENTS : 0);
      subtotal += unit * line.qty;
      const row = document.createElement("div");
      row.className = "bag-line";
      const thumb = document.createElement("img");
      thumb.className = "bag-thumb";
      thumb.src = variant.media[0];
      thumb.alt = "";
      thumb.width = 56;
      thumb.height = 70;
      const text = document.createElement("div");
      text.className = "bag-text";
      const name = document.createElement("strong");
      name.textContent = "Stillwater Bottle";
      const meta = document.createElement("span");
      meta.textContent = `${optionName(variant)}, ${formatUsd(unit)} each`;
      text.append(name, meta);
      if (line.text) {
        const engr = document.createElement("span");
        engr.className = "bag-engrave";
        engr.textContent = `Engraved "${line.text.toUpperCase()}"`;
        text.append(engr);
      }
      const price = document.createElement("span");
      price.className = "figure bag-price";
      price.textContent = formatUsd(unit * line.qty);
      const actions = document.createElement("div");
      actions.className = "line-actions";
      const stepper = document.createElement("div");
      stepper.className = "line-qty";
      stepper.setAttribute("role", "group");
      stepper.setAttribute("aria-label", `Quantity, ${optionName(variant)}`);
      const less = document.createElement("button");
      less.type = "button";
      less.dataset.step = "-1";
      less.dataset.key = key;
      less.textContent = "−";
      less.disabled = line.qty <= 1;
      less.setAttribute("aria-label", `One fewer ${optionShort(variant)}`);
      const shown = document.createElement("output");
      shown.textContent = String(line.qty);
      const more = document.createElement("button");
      more.type = "button";
      more.dataset.step = "1";
      more.dataset.key = key;
      more.textContent = "+";
      more.disabled = line.qty >= MAX_QTY;
      more.setAttribute("aria-label", `One more ${optionShort(variant)}`);
      stepper.append(less, shown, more);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "text-button";
      remove.dataset.remove = key;
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Remove ${optionName(variant)}`);
      actions.append(stepper, remove);
      row.append(thumb, text, price, actions);
      lines.append(row);
    });
    $("#bagSubtotal").textContent = formatUsd(subtotal);
    const meter = $("#shipMeter");
    meter.dataset.done = String(subtotal >= FREE_SHIP);
    $("#shipText").textContent = subtotal >= FREE_SHIP ? "Free shipping on this order." : `${formatUsd(FREE_SHIP - subtotal)} away from free shipping.`;
    $("#shipFill").style.width = `${Math.min(100, (subtotal / FREE_SHIP) * 100)}%`;
    $("#bagFoot").hidden = false;
  }

  function toast(message) {
    const node = $("#toast");
    node.textContent = message;
    node.classList.add("visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => node.classList.remove("visible"), 3200);
  }

  function setQuantity(next) {
    quantity = Math.min(MAX_QTY, Math.max(1, next));
    qtyValue.textContent = String(quantity);
    $("#qtyDown").disabled = quantity <= 1;
    $("#qtyUp").disabled = quantity >= MAX_QTY;
    updatePriceAndAvailability();
  }

  function addToBag() {
    if (!activeVariant.available) return;
    if (engraveOn.checked && !engraving()) {
      engraveInput.focus();
      toast("Type the engraving first, or switch engraving off.");
      return;
    }
    const key = lineKey(activeVariant.id, engraving());
    const current = bag.get(key)?.qty ?? 0;
    const added = Math.min(quantity, MAX_QTY - current);
    if (added <= 0) {
      toast(`You already have ${MAX_QTY} of the ${optionShort(activeVariant)} in your bag.`);
      return;
    }
    bag.set(key, { id: activeVariant.id, text: engraving(), qty: current + added });
    renderBag();
    const count = $("#bagCount");
    count.classList.remove("bump");
    void count.offsetWidth;
    if (!reduce.matches) count.classList.add("bump");
    toast(`Added ${added} ${optionShort(activeVariant)}${engraving() ? `, engraved "${engraving().toUpperCase()}"` : ""} to your bag.`);
    setQuantity(1);
  }

  /* Wiring */
  buildOptions();
  readUrl();

  $("#variantForm").addEventListener("change", onOptionChange);
  $("#variantForm").addEventListener("submit", (event) => event.preventDefault());

  galleryThumbnails.addEventListener("click", (event) => {
    const button = event.target.closest(".thumb-button");
    if (button) selectMedia(Number(button.dataset.index));
  });
  galleryThumbnails.addEventListener("keydown", (event) => {
    if (!event.target.closest(".thumb-button")) return;
    const next = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (next) {
      event.preventDefault();
      selectMedia(activeMediaIndex + next, { focus: true });
    }
  });

  behaviorMode.addEventListener("change", () => {
    behavior = behaviorMode.value;
    defectNote.hidden = behavior !== "stale";
    missingAssetNote.hidden = behavior !== "missing-file";
    document.body.dataset.exampleMode = behavior;
    setZoom(false);
    if (behavior === "stale") {
      requestToken += 1;
      mediaStage.dataset.galleryState = "synthetic-stale";
      mediaStage.setAttribute("aria-busy", "false");
      syncEngraveLayer();
      updateLiveStatus("Stale photo bug switched on. ");
    } else {
      paintMedia();
      updateLiveStatus(behavior === "fixed" ? "Working gallery restored. " : "Missing photo bug switched on. ");
    }
  });

  window.addEventListener("popstate", () => {
    readUrl();
    activeMediaIndex = 0;
    syncView();
  });

  $("#swapOption").addEventListener("click", (event) => {
    const next = byId.get(event.currentTarget.dataset.variant);
    if (!next) return;
    activeVariant = next;
    activeMediaIndex = 0;
    syncView({ writeLink: true });
    addButton.focus();
  });
  $("#qtyDown").addEventListener("click", () => setQuantity(quantity - 1));
  $("#qtyUp").addEventListener("click", () => setQuantity(quantity + 1));
  addButton.addEventListener("click", addToBag);
  $("#buyBarAdd").addEventListener("click", addToBag);

  /* The slim buy bar shows while the main add button is off screen */
  const buyBar = $("#buyBar");
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      const show = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      buyBar.classList.toggle("show", show);
      buyBar.setAttribute("aria-hidden", String(!show));
      $("#buyBarAdd").tabIndex = show ? 0 : -1;
    }).observe($("#buyRow"));
  }

  $("#bagButton").addEventListener("click", () => {
    renderBag();
    bagDialog.showModal();
  });
  $("#bagClose").addEventListener("click", () => bagDialog.close());
  bagDialog.addEventListener("click", (event) => {
    if (event.target === bagDialog || event.target.closest("[data-close]")) { bagDialog.close(); return; }
    const step = event.target.closest("[data-step]");
    if (step) {
      const key = step.dataset.key;
      const line = bag.get(key);
      if (!line) return;
      line.qty = Math.min(MAX_QTY, Math.max(1, line.qty + Number(step.dataset.step)));
      renderBag();
      const again = [...bagDialog.querySelectorAll(`[data-step="${step.dataset.step}"]`)].find((b) => b.dataset.key === key);
      const any = [...bagDialog.querySelectorAll("[data-key]")].find((b) => b.dataset.key === key && !b.disabled);
      (again && !again.disabled ? again : any ?? $("#bagClose")).focus();
      liveStatus.textContent = `${optionShort(byId.get(line.id))}, quantity ${line.qty}.`;
      return;
    }
    const remove = event.target.closest("[data-remove]");
    if (remove) {
      bag.delete(remove.dataset.remove);
      renderBag();
      (bagDialog.querySelector("[data-remove]") ?? $("#bagClose")).focus();
    }
  });

  renderBag();
  setQuantity(1);
  syncView();
})();
