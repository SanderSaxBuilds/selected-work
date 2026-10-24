(() => {
  "use strict";

  const colors = [
    { key: "moss", label: "Moss", swatch: "#6f8570" },
    { key: "glacier", label: "Glacier", swatch: "#a9bcb8" },
    { key: "ember", label: "Ember", swatch: "#b96f58" }
  ];
  const sizes = ["500 ml", "750 ml"];
  const variants = [
    { id: "8901001", color: "moss", size: "500 ml", priceCents: 3600, available: true, media: ["assets/moss-front.svg", "assets/moss-detail.svg"] },
    { id: "8901002", color: "moss", size: "750 ml", priceCents: 4200, available: true, media: ["assets/moss-front.svg", "assets/moss-detail.svg"] },
    { id: "8901003", color: "glacier", size: "500 ml", priceCents: 3800, available: true, media: ["assets/glacier-front.svg", "assets/glacier-detail.svg"] },
    { id: "8901004", color: "glacier", size: "750 ml", priceCents: 4400, available: false, media: ["assets/glacier-front.svg", "assets/glacier-detail.svg"] },
    { id: "8901005", color: "ember", size: "500 ml", priceCents: 3700, available: true, media: ["assets/ember-front.svg", "assets/ember-detail.svg"] },
    { id: "8901006", color: "ember", size: "750 ml", priceCents: 4300, available: true, media: ["assets/ember-front.svg", "assets/ember-detail.svg"] }
  ];
  const MISSING_IMAGE = "qa-fixtures/intentional-404.svg";
  const MAX_QTY = 9;

  const byId = new Map(variants.map((variant) => [variant.id, variant]));
  const byOptions = new Map(variants.map((variant) => [`${variant.color}|${variant.size}`, variant]));
  const $ = (selector) => document.querySelector(selector);
  const colorOptions = $("#colorOptions");
  const sizeOptions = $("#sizeOptions");
  const galleryThumbnails = $("#galleryThumbnails");
  const mainImage = $("#mainImage");
  const mediaStage = $("#mediaStage");
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

  let activeVariant = variants[0];
  let activeMediaIndex = 0;
  let renderedMediaKey = "";
  let requestToken = 0;
  let isUnknownLink = false;
  let behavior = "fixed";
  let quantity = 1;
  let toastTimer = 0;
  const bag = new Map();

  const formatUsd = (cents) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  const colorLabel = (key) => colors.find((color) => color.key === key)?.label ?? key;
  const viewName = (index) => (index === 0 ? "Front view" : "Detail view");
  const optionName = (variant) => `${colorLabel(variant.color)}, ${variant.size}`;
  const optionShort = (variant) => `${colorLabel(variant.color)} ${variant.size}`;

  function mediaAlt(variant, index) {
    return `${colorLabel(variant.color)} Stillwater Bottle, ${variant.size}, ${viewName(index).toLowerCase()}`;
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
      const price = document.createElement("span");
      price.className = "size-price figure";
      const note = document.createElement("span");
      note.className = "option-note";
      label.append(radio, text, price, note);
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
  }

  function updatePriceAndAvailability() {
    priceValue.textContent = formatUsd(activeVariant.priceCents);
    $("#priceMeta").textContent = `${activeVariant.size}, ${colorLabel(activeVariant.color)}`;
    availabilityCard.dataset.available = String(activeVariant.available);
    $("#availabilityLabel").textContent = activeVariant.available ? "In stock" : "Sold out";
    $("#availabilityDescription").textContent = activeVariant.available
      ? "Ships in 1 to 2 business days."
      : `${optionShort(activeVariant)} is restocking. The other options ship now.`;
    const swap = $("#swapOption");
    const alt = activeVariant.available ? null
      : variants.find((v) => v.available && v.color === activeVariant.color) || variants.find((v) => v.available && v.size === activeVariant.size);
    swap.hidden = !alt;
    if (alt) { swap.dataset.variant = alt.id; swap.textContent = `Show ${optionShort(alt)} instead, ${formatUsd(alt.priceCents)}`; }
    addButton.disabled = !activeVariant.available;
    addButton.textContent = activeVariant.available ? `Add to bag, ${formatUsd(activeVariant.priceCents * quantity)}` : "Sold out";
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
    $("#imageIndex").textContent = count ? `${activeMediaIndex + 1} of ${count}` : "No photo";
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
        image.width = 96;
        image.height = 90;
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
  }

  function paintMedia() {
    requestToken += 1;
    const token = requestToken;
    if (behavior === "stale") {
      mediaStage.dataset.galleryState = "synthetic-stale";
      mediaStage.setAttribute("aria-busy", "false");
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
    liveStatus.textContent = `${linkStatus}${prefix}${optionName(activeVariant)}, ${formatUsd(activeVariant.priceCents)}. ${availability}. ${mediaStatus}`;
  }

  function syncView({ writeLink = false } = {}) {
    updateControls();
    updatePriceAndAvailability();
    renderThumbnails();
    paintMedia();
    if (writeLink) writeUrl();
    updateLiveStatus();
  }

  function selectMedia(index, { focus = false } = {}) {
    const count = activeVariant.media.length;
    if (!count) return;
    activeMediaIndex = (index + count) % count;
    renderThumbnails();
    paintMedia();
    updateLiveStatus();
    if (focus) galleryThumbnails.querySelectorAll(".thumb-button")[activeMediaIndex]?.focus();
  }

  function onOptionChange() {
    const colorInput = colorOptions.querySelector('input[name="color"]:checked');
    const sizeInput = sizeOptions.querySelector('input[name="size"]:checked');
    const next = byOptions.get(`${colorInput?.value}|${sizeInput?.value}`);
    if (!next) return;
    activeVariant = next;
    activeMediaIndex = 0;
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

  /* Bag */
  function bagItemCount() {
    let count = 0;
    bag.forEach((qty) => { count += qty; });
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
    bag.forEach((qty, id) => {
      const variant = byId.get(id);
      subtotal += variant.priceCents * qty;
      const row = document.createElement("div");
      row.className = "bag-line";
      const swatch = document.createElement("span");
      swatch.className = "bag-swatch";
      swatch.style.setProperty("--swatch", colors.find((c) => c.key === variant.color).swatch);
      swatch.setAttribute("aria-hidden", "true");
      const text = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = "Stillwater Bottle";
      const meta = document.createElement("span");
      meta.textContent = `${optionName(variant)}, ${formatUsd(variant.priceCents)} each`;
      text.append(name, meta);
      const price = document.createElement("span");
      price.className = "figure";
      price.textContent = formatUsd(variant.priceCents * qty);
      const actions = document.createElement("div");
      actions.className = "line-actions";
      const stepper = document.createElement("div");
      stepper.className = "line-qty";
      stepper.setAttribute("role", "group");
      stepper.setAttribute("aria-label", `Quantity, ${optionName(variant)}`);
      const less = document.createElement("button");
      less.type = "button";
      less.dataset.step = "-1";
      less.dataset.id = id;
      less.textContent = "\u2212";
      less.disabled = qty <= 1;
      less.setAttribute("aria-label", `One fewer ${optionShort(variant)}`);
      const shown = document.createElement("output");
      shown.textContent = String(qty);
      const more = document.createElement("button");
      more.type = "button";
      more.dataset.step = "1";
      more.dataset.id = id;
      more.textContent = "+";
      more.disabled = qty >= MAX_QTY;
      more.setAttribute("aria-label", `One more ${optionShort(variant)}`);
      stepper.append(less, shown, more);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "text-button";
      remove.dataset.remove = id;
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Remove ${optionName(variant)}`);
      actions.append(stepper, remove);
      row.append(swatch, text, price, actions);
      lines.append(row);
    });
    $("#bagSubtotal").textContent = formatUsd(subtotal);
    const FREE_SHIP = 5000;
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

  /* Wiring */
  buildOptions();
  readUrl();

  $("#variantForm").addEventListener("change", onOptionChange);

  galleryThumbnails.addEventListener("click", (event) => {
    const button = event.target.closest(".thumb-button");
    if (button) selectMedia(Number(button.dataset.index));
  });
  galleryThumbnails.addEventListener("keydown", (event) => {
    if (!event.target.closest(".thumb-button")) return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      selectMedia(activeMediaIndex + (event.key === "ArrowRight" ? 1 : -1), { focus: true });
    }
  });

  behaviorMode.addEventListener("change", () => {
    behavior = behaviorMode.value;
    defectNote.hidden = behavior !== "stale";
    missingAssetNote.hidden = behavior !== "missing-file";
    document.body.dataset.exampleMode = behavior;
    if (behavior === "stale") {
      requestToken += 1;
      mediaStage.dataset.galleryState = "synthetic-stale";
      mediaStage.setAttribute("aria-busy", "false");
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

  addButton.addEventListener("click", () => {
    if (!activeVariant.available) return;
    const current = bag.get(activeVariant.id) ?? 0;
    const added = Math.min(quantity, MAX_QTY - current);
    if (added <= 0) {
      toast(`You already have ${MAX_QTY} of the ${optionShort(activeVariant)} in your bag.`);
      return;
    }
    bag.set(activeVariant.id, current + added);
    renderBag();
    toast(`Added ${added} ${optionShort(activeVariant)} to your bag.`);
    setQuantity(1);
  });

  $("#bagButton").addEventListener("click", () => {
    renderBag();
    bagDialog.showModal();
  });
  $("#bagClose").addEventListener("click", () => bagDialog.close());
  bagDialog.addEventListener("click", (event) => {
    if (event.target === bagDialog || event.target.closest("[data-close]")) { bagDialog.close(); return; }
    const step = event.target.closest("[data-step]");
    if (step) {
      const id = step.dataset.id;
      const next = Math.min(MAX_QTY, Math.max(1, (bag.get(id) ?? 0) + Number(step.dataset.step)));
      bag.set(id, next);
      renderBag();
      const again = bagDialog.querySelector(`[data-id="${id}"][data-step="${step.dataset.step}"]`);
      (again && !again.disabled ? again : bagDialog.querySelector(`[data-id="${id}"]:not(:disabled)`) ?? $("#bagClose")).focus();
      liveStatus.textContent = `${optionShort(byId.get(id))}, quantity ${next}.`;
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
