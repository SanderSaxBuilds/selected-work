(() => {
  "use strict";

  const colors = [
    { key: "moss", label: "Moss", swatch: "#748674" },
    { key: "glacier", label: "Glacier", swatch: "#aebdb9" },
    { key: "ember", label: "Ember", swatch: "#b96f58" }
  ];
  const sizes = ["500 ml", "750 ml"];
  const variants = [
    { id: "8901001", color: "moss", size: "500 ml", priceCents: 3600, available: true, media: ["assets/moss-front.svg", "assets/moss-detail.svg"] },
    { id: "8901002", color: "moss", size: "750 ml", priceCents: 4200, available: true, media: ["assets/moss-front.svg", "assets/moss-detail.svg"] },
    { id: "8901003", color: "glacier", size: "500 ml", priceCents: 3785, available: true, media: ["assets/glacier-front.svg", "assets/glacier-detail.svg"] },
    { id: "8901004", color: "glacier", size: "750 ml", priceCents: 4400, available: false, media: [] },
    { id: "8901005", color: "ember", size: "500 ml", priceCents: 3525, available: true, media: ["assets/ember-front.svg", "assets/ember-detail.svg"] },
    { id: "8901006", color: "ember", size: "750 ml", priceCents: 4125, available: true, media: ["assets/ember-front.svg", "assets/ember-detail.svg"] }
  ];

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

  let activeVariant = variants[0];
  let activeMediaIndex = 0;
  let requestToken = 0;
  let isUnknownLink = false;
  let behavior = "fixed";

  function formatUsdCents(cents) {
    const sign = cents < 0 ? "−" : "";
    const absolute = Math.abs(cents);
    const wholeDollars = Math.floor(absolute / 100);
    const remainder = String(absolute % 100).padStart(2, "0");
    const dollars = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(wholeDollars);
    return `${sign}${dollars}.${remainder}`;
  }

  function colorLabel(key) {
    return colors.find((color) => color.key === key)?.label ?? key;
  }

  function mediaAlt(variant, index) {
    const view = index === 0 ? "front view" : "detail view";
    return `${colorLabel(variant.color)} Stillwater Bottle, ${variant.size}, ${view}`;
  }

  function renderColorOptions() {
    colorOptions.replaceChildren();
    colors.forEach((color) => {
      const label = document.createElement("label");
      label.className = "color-choice";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "color";
      radio.value = color.key;
      radio.id = `color-${color.key}`;
      radio.checked = activeVariant.color === color.key;
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.setProperty("--swatch", color.swatch);
      swatch.setAttribute("aria-hidden", "true");
      const text = document.createElement("span");
      text.textContent = color.label;
      label.htmlFor = radio.id;
      label.append(radio, swatch, text);
      colorOptions.append(label);
    });
  }

  function renderSizeOptions() {
    sizeOptions.replaceChildren();
    sizes.forEach((size, index) => {
      const variant = byOptions.get(`${activeVariant.color}|${size}`);
      const label = document.createElement("label");
      label.className = "size-choice";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "size";
      radio.value = size;
      radio.id = `size-${index}`;
      radio.checked = activeVariant.size === size;
      const text = document.createElement("span");
      text.className = "size-label";
      text.textContent = size;
      const note = document.createElement("span");
      note.className = "option-note";
      note.textContent = variant.available ? "" : "Sold out";
      if (!variant.available) note.setAttribute("aria-label", "Sold out");
      label.htmlFor = radio.id;
      label.append(radio, text, note);
      sizeOptions.append(label);
    });
  }

  function updateControls() {
    colorOptions.querySelectorAll('input[name="color"]').forEach((radio) => {
      radio.checked = radio.value === activeVariant.color;
    });
    $("#currentColor").textContent = colorLabel(activeVariant.color);
    $("#currentSize").textContent = activeVariant.size;
    renderSizeOptions();
  }

  function updatePriceAndAvailability() {
    const price = formatUsdCents(activeVariant.priceCents);
    priceValue.textContent = price;
    priceValue.setAttribute("aria-label", `Price ${price} USD`);
    availabilityCard.dataset.available = String(activeVariant.available);
    $("#availabilityLabel").textContent = activeVariant.available ? "Available" : "Sold out";
    $("#availabilityDescription").textContent = activeVariant.available
      ? "Ready for this color and capacity."
      : "This color and capacity are currently unavailable.";
    document.body.dataset.variantId = activeVariant.id;
    document.body.dataset.exampleMode = behavior;
  }

  function updateUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set("variant", activeVariant.id);
    window.history.replaceState(null, "", url);
    isUnknownLink = false;
    linkMessage.hidden = true;
  }

  function updateThumbnails() {
    galleryThumbnails.replaceChildren();
    const currentMedia = activeVariant.media;
    currentMedia.forEach((src, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "thumb-button";
      button.setAttribute("aria-label", index === 0 ? "Front view" : "Detail view");
      button.setAttribute("aria-pressed", String(index === activeMediaIndex));
      const image = document.createElement("img");
      image.src = src;
      image.alt = "";
      image.loading = "eager";
      button.append(image);
      button.addEventListener("click", () => {
        activeMediaIndex = index;
        paintMedia();
        updateThumbnails();
        updateLiveStatus();
      });
      galleryThumbnails.append(button);
    });
    const empty = currentMedia.length === 0;
    $("#imageIndex").innerHTML = empty ? "— <span aria-hidden=\"true\">/</span> —" : `${String(activeMediaIndex + 1).padStart(2, "0")} <span aria-hidden="true">/</span> ${String(currentMedia.length).padStart(2, "0")}`;
    $("#galleryCaption").innerHTML = empty
      ? "No product image supplied <span aria-hidden=\"true\">·</span> Fallback shown"
      : `${activeMediaIndex === 0 ? "Front view" : "Detail view"} <span aria-hidden="true">·</span> Original vector artwork`;
  }

  function showFallback(message) {
    mainImage.hidden = true;
    mainImage.removeAttribute("srcset");
    mainImage.removeAttribute("sizes");
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

    mediaStage.dataset.galleryState = "loading";
    mainImage.removeAttribute("srcset");
    mainImage.removeAttribute("sizes");
    mainImage.removeAttribute("src");
    mainImage.dataset.renderedVariantId = "";
    mainImage.dataset.mediaIndex = "";
    mainImage.hidden = true;
    mediaFallback.hidden = true;

    const src = behavior === "missing-file"
      ? "qa-fixtures/intentional-404.svg"
      : activeVariant.media[activeMediaIndex];
    if (!src) {
      showFallback(`No image is assigned to the ${colorLabel(activeVariant.color)} ${activeVariant.size} option.`);
      return;
    }

    mediaStage.setAttribute("aria-busy", "true");
    mediaSkeleton.hidden = false;
    const probe = new Image();
    probe.onload = () => {
      if (token !== requestToken || behavior === "stale") return;
      mainImage.onload = () => {
        if (token !== requestToken || behavior === "stale") return;
        mainImage.dataset.renderedVariantId = activeVariant.id;
        mainImage.dataset.mediaIndex = String(activeMediaIndex);
        mainImage.alt = mediaAlt(activeVariant, activeMediaIndex);
        mainImage.hidden = false;
        mediaSkeleton.hidden = true;
        mediaStage.dataset.galleryState = "ready";
        mediaStage.setAttribute("aria-busy", "false");
        updateLiveStatus();
      };
      mainImage.onerror = () => {
        if (token !== requestToken || behavior === "stale") return;
        showFallback("The product image could not be loaded. The selected options and price are still available to review.");
        updateLiveStatus();
      };
      mainImage.removeAttribute("srcset");
      mainImage.removeAttribute("sizes");
      mainImage.src = src;
      if (mainImage.complete && mainImage.naturalWidth > 0) {
        mainImage.onload();
      }
    };
    probe.onerror = () => {
      if (token !== requestToken || behavior === "stale") return;
      showFallback("The product image could not be loaded. The selected options and price are still available to review.");
      updateLiveStatus();
    };
    probe.src = src;
  }

  function updateLiveStatus(prefix = "") {
    const price = formatUsdCents(activeVariant.priceCents);
    const availability = activeVariant.available ? "Available" : "Sold out";
    const linkStatus = isUnknownLink ? "Unrecognized variant link. Showing the default option. " : "";
    let mediaStatus;
    if (behavior === "stale") {
      mediaStatus = mainImage.dataset.renderedVariantId !== activeVariant.id
        ? "The image is still showing the earlier option."
        : "The current image remains in place.";
    } else if (mediaStage.dataset.galleryState === "loading") {
      mediaStatus = "Image loading.";
    } else if (mediaStage.dataset.galleryState === "ready") {
      mediaStatus = "Image updated.";
    } else {
      mediaStatus = "Image preview unavailable.";
    }
    liveStatus.textContent = `${linkStatus}${prefix}${colorLabel(activeVariant.color)}, ${activeVariant.size}, ${price} USD. ${availability}. ${mediaStatus}`;
  }

  function syncView({ fromUser = false } = {}) {
    updateControls();
    updatePriceAndAvailability();
    updateThumbnails();
    paintMedia();
    if (fromUser) updateUrl();
    updateLiveStatus();
  }

  function onOptionChange(event) {
    const colorInput = colorOptions.querySelector('input[name="color"]:checked');
    const sizeInput = sizeOptions.querySelector('input[name="size"]:checked');
    const next = byOptions.get(`${colorInput?.value}|${sizeInput?.value}`);
    if (!next) return;
    activeVariant = next;
    activeMediaIndex = 0;
    defectNote.hidden = behavior !== "stale";
    missingAssetNote.hidden = behavior !== "missing-file";
    syncView({ fromUser: true });
  }

  function initializeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("variant")) return;
    const requested = params.get("variant");
    const match = requested === null ? undefined : byId.get(requested);
    if (match) {
      activeVariant = match;
      return;
    }
    isUnknownLink = true;
    activeVariant = variants[0];
    linkMessage.hidden = false;
  }

  renderColorOptions();
  initializeFromUrl();
  behaviorMode.addEventListener("change", () => {
    behavior = behaviorMode.value;
    defectNote.hidden = behavior !== "stale";
    missingAssetNote.hidden = behavior !== "missing-file";
    document.body.dataset.exampleMode = behavior;
    if (behavior === "fixed") {
      paintMedia();
      updateLiveStatus("Working gallery restored. ");
    } else if (behavior === "stale") {
      requestToken += 1;
      mediaStage.dataset.galleryState = "synthetic-stale";
      mediaStage.setAttribute("aria-busy", "false");
      updateLiveStatus("Synthetic stale-image defect selected. ");
    } else {
      paintMedia();
      updateLiveStatus("Synthetic missing-image request selected. ");
    }
  });
  $("#variantForm").addEventListener("change", onOptionChange);
  syncView();
})();
