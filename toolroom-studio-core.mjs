const MAX_CATALOG_JSON_BYTES = 256 * 1024;
const MAX_PRODUCTS = 40;
const MAX_ASSET_BYTES = 10 * 1024 * 1024;
const MAX_RELEASE_BYTES = 25 * 1024 * 1024;
const CURRENCIES = new Set(["USD", "EUR", "THB", "GBP"]);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;
const FILE_NAME_FORBIDDEN = /[<>:"/\\|?*]/;
const RESERVED_WINDOWS_NAME = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i;
const encoder = new TextEncoder();

function typeError(message) {
  throw new TypeError(message);
}

function utf8Size(value) {
  return encoder.encode(value).byteLength;
}

function ensureJsonTextSize(text) {
  if (text.length > MAX_CATALOG_JSON_BYTES || utf8Size(text) > MAX_CATALOG_JSON_BYTES) {
    throw new RangeError("Catalog JSON exceeds the 256 KiB limit.");
  }
}

function validateUnicode(value, field, allowNewlines = false) {
  const forbiddenControls = allowNewlines ? /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f-\u009f]|\r(?!\n)/ : CONTROL_CHARACTERS;
  if (forbiddenControls.test(value)) {
    typeError(field + " must not contain control characters.");
  }

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        typeError(field + " must contain well-formed Unicode.");
      }
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      typeError(field + " must contain well-formed Unicode.");
    }
  }
}

function validateString(value, field, minimum, maximum, allowNewlines = false) {
  if (typeof value !== "string") {
    typeError(field + " must be a string.");
  }

  if (value.length > maximum * 2) {
    typeError(field + " must be at most " + maximum + " characters.");
  }

  validateUnicode(value, field, allowNewlines);
  const characters = Array.from(value).length;
  if (characters < minimum || characters > maximum) {
    typeError(field + " must be between " + minimum + " and " + maximum + " characters.");
  }
  if (minimum > 0 && value.trim().length === 0) {
    typeError(field + " must not be blank.");
  }
  return value;
}

function readExactRecord(value, keys, field) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    typeError(field + " must be a plain object.");
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    typeError(field + " must have the standard object prototype.");
  }

  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length || ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))) {
    typeError(field + " has missing, extra, or dangerous fields.");
  }

  const values = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
      typeError(field + "." + key + " must be an enumerable data field.");
    }
    values[key] = descriptor.value;
  }
  return values;
}

function readProductArray(value) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    typeError("catalog.products must be a plain array.");
  }
  if (value.length > MAX_PRODUCTS) {
    typeError("catalog.products must contain no more than 40 products.");
  }

  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== value.length + 1 || !ownKeys.includes("length")) {
    typeError("catalog.products must not contain extra array fields.");
  }

  const products = [];
  for (let index = 0; index < value.length; index += 1) {
    const key = String(index);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
      typeError("catalog.products must not contain holes or accessors.");
    }
    products.push(descriptor.value);
  }
  return products;
}

function validateFileName(value, field) {
  validateString(value, field, 1, 120);
  if (
    value.startsWith(".") ||
    value === "." ||
    value === ".." ||
    FILE_NAME_FORBIDDEN.test(value) ||
    value.endsWith(".") ||
    value.endsWith(" ") ||
    RESERVED_WINDOWS_NAME.test(value)
  ) {
    typeError(field + " must be a safe basename.");
  }
  return value;
}

function canonicalAsset(value, field) {
  if (value === null) {
    return null;
  }

  const asset = readExactRecord(value, ["fileName", "size", "sha256"], field);
  const fileName = validateFileName(asset.fileName, field + ".fileName");
  if (!Number.isInteger(asset.size) || asset.size < 1 || asset.size > MAX_ASSET_BYTES) {
    typeError(field + ".size must be an integer from 1 to 10485760.");
  }
  if (typeof asset.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(asset.sha256)) {
    typeError(field + ".sha256 must be 64 lowercase hexadecimal characters.");
  }
  return { fileName, size: asset.size, sha256: asset.sha256 };
}

function canonicalProduct(value, index) {
  const field = "catalog.products[" + index + "]";
  const product = readExactRecord(
    value,
    ["id", "title", "category", "description", "priceCents", "version", "asset", "rightsConfirmed", "qaConfirmed"],
    field,
  );

  if (typeof product.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,47}$/.test(product.id)) {
    typeError(field + ".id must match /^[a-z0-9][a-z0-9-]{0,47}$/.");
  }
  const title = validateString(product.title, field + ".title", 1, 100);
  const category = validateString(product.category, field + ".category", 1, 40);
  const description = validateString(product.description, field + ".description", 1, 1200, true);
  if (!Number.isInteger(product.priceCents) || product.priceCents < 0 || product.priceCents > 100000000) {
    typeError(field + ".priceCents must be an integer from 0 to 100000000.");
  }
  const version = validateString(product.version, field + ".version", 1, 30);
  if (typeof product.rightsConfirmed !== "boolean" || typeof product.qaConfirmed !== "boolean") {
    typeError(field + " confirmation fields must be booleans.");
  }

  return {
    id: product.id,
    title,
    category,
    description,
    priceCents: product.priceCents,
    version,
    asset: canonicalAsset(product.asset, field + ".asset"),
    rightsConfirmed: product.rightsConfirmed,
    qaConfirmed: product.qaConfirmed,
  };
}

export function createCatalog() {
  return {
    schema: "toolroom-studio",
    version: 1,
    shop: { name: "My download catalog", tagline: "", currency: "USD" },
    products: [],
  };
}

export function canonicalCatalog(value) {
  const catalog = readExactRecord(value, ["schema", "version", "shop", "products"], "catalog");
  if (catalog.schema !== "toolroom-studio" || catalog.version !== 1) {
    typeError("catalog schema and version are not supported.");
  }

  const shop = readExactRecord(catalog.shop, ["name", "tagline", "currency"], "catalog.shop");
  const canonicalShop = {
    name: validateString(shop.name, "catalog.shop.name", 1, 80),
    tagline: validateString(shop.tagline, "catalog.shop.tagline", 0, 160, true),
    currency: shop.currency,
  };
  if (typeof canonicalShop.currency !== "string" || !CURRENCIES.has(canonicalShop.currency)) {
    typeError("catalog.shop.currency must be USD, EUR, THB, or GBP.");
  }

  const sourceProducts = readProductArray(catalog.products);
  const products = sourceProducts.map(canonicalProduct);
  const ids = new Set();
  for (const product of products) {
    if (ids.has(product.id)) {
      typeError("Product ids must be unique.");
    }
    ids.add(product.id);
  }

  const result = {
    schema: "toolroom-studio",
    version: 1,
    shop: canonicalShop,
    products,
  };
  ensureJsonTextSize(JSON.stringify(result));
  return result;
}

function scanForDuplicateJsonKeys(text) {
  let index = 0;

  function skipWhitespace() {
    while (index < text.length && /[\u0009\u000a\u000d\u0020]/.test(text[index])) {
      index += 1;
    }
  }

  function readString() {
    const start = index;
    if (text[index] !== '"') {
      throw new SyntaxError("Expected a JSON string.");
    }
    index += 1;
    while (index < text.length) {
      const character = text[index];
      index += 1;
      if (character === '"') {
        return JSON.parse(text.slice(start, index));
      }
      if (character === "\\") {
        if (index >= text.length) {
          throw new SyntaxError("Unterminated JSON escape.");
        }
        if (text[index] === "u") {
          index += 5;
        } else {
          index += 1;
        }
      }
    }
    throw new SyntaxError("Unterminated JSON string.");
  }

  function expect(character) {
    if (text[index] !== character) {
      throw new SyntaxError("Malformed JSON near character " + index + ".");
    }
    index += 1;
  }

  function readValue(depth) {
    if (depth > 12) {
      throw new SyntaxError("Catalog JSON is nested too deeply.");
    }
    skipWhitespace();
    const character = text[index];
    if (character === "{") {
      readObject(depth + 1);
      return;
    }
    if (character === "[") {
      readArray(depth + 1);
      return;
    }
    if (character === '"') {
      readString();
      return;
    }

    const start = index;
    while (index < text.length && !/[\u0009\u000a\u000d\u0020,\]}]/.test(text[index])) {
      index += 1;
    }
    if (index === start) {
      throw new SyntaxError("Expected a JSON value.");
    }
  }

  function readObject(depth) {
    expect("{");
    skipWhitespace();
    if (text[index] === "}") {
      index += 1;
      return;
    }

    const keys = new Set();
    while (index < text.length) {
      skipWhitespace();
      const key = readString();
      if (keys.has(key)) {
        throw new SyntaxError("Catalog JSON contains a duplicate object key.");
      }
      keys.add(key);
      skipWhitespace();
      expect(":");
      readValue(depth);
      skipWhitespace();
      if (text[index] === "}") {
        index += 1;
        return;
      }
      expect(",");
    }
    throw new SyntaxError("Unterminated JSON object.");
  }

  function readArray(depth) {
    expect("[");
    skipWhitespace();
    if (text[index] === "]") {
      index += 1;
      return;
    }

    while (index < text.length) {
      readValue(depth);
      skipWhitespace();
      if (text[index] === "]") {
        index += 1;
        return;
      }
      expect(",");
    }
    throw new SyntaxError("Unterminated JSON array.");
  }

  readValue(0);
  skipWhitespace();
  if (index !== text.length) {
    throw new SyntaxError("Unexpected content after catalog JSON.");
  }
}

export function parseCatalog(text) {
  if (typeof text !== "string") {
    typeError("Catalog import must be text.");
  }
  ensureJsonTextSize(text);
  scanForDuplicateJsonKeys(text);
  return canonicalCatalog(JSON.parse(text));
}

export function serializeCatalog(catalog) {
  const normalized = canonicalCatalog(catalog);
  const text = JSON.stringify(normalized, null, 2) + "\n";
  ensureJsonTextSize(text);
  return text;
}

export async function hashBytes(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    typeError("hashBytes expects a Uint8Array.");
  }
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error("Web Crypto SHA-256 is unavailable in this environment.");
  }

  const snapshot = new Uint8Array(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", snapshot);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readRuntimeAsset(value, field) {
  const asset = readExactRecord(value, ["fileName", "bytes"], field);
  const fileName = validateFileName(asset.fileName, field + ".fileName");
  if (!(asset.bytes instanceof Uint8Array)) {
    typeError(field + ".bytes must be a Uint8Array.");
  }
  return { fileName, bytes: asset.bytes };
}

function getMapValue(map, key) {
  return Map.prototype.get.call(map, key);
}

function hasMapKey(map, key) {
  return Map.prototype.has.call(map, key);
}

export function inspectRelease(catalog, assets) {
  const normalized = canonicalCatalog(catalog);
  const issues = [];
  let totalBytes = 0;

  if (normalized.products.length < 1) {
    issues.push({ productId: null, message: "Add at least one product before building a release." });
  }
  if (!(assets instanceof Map) && normalized.products.length > 0) {
    issues.push({ productId: null, message: "Assets must be provided as a Map keyed by product id." });
  }

  for (const product of normalized.products) {
    if (!product.asset) {
      issues.push({ productId: product.id, message: "Attach a file and save its filename, size, and SHA-256 metadata." });
    }
    if (!product.rightsConfirmed) {
      issues.push({ productId: product.id, message: "Confirm that you have the rights to distribute this file." });
    }
    if (!product.qaConfirmed) {
      issues.push({ productId: product.id, message: "Review the file and confirm its quality before release." });
    }

    if (!(assets instanceof Map) || !hasMapKey(assets, product.id)) {
      if (product.asset) {
        issues.push({ productId: product.id, message: "The attached file is missing from this release." });
      }
      continue;
    }

    let runtimeAsset;
    try {
      runtimeAsset = readRuntimeAsset(getMapValue(assets, product.id), "assets[" + product.id + "]");
    } catch (error) {
      issues.push({ productId: product.id, message: "The attached file data is invalid: " + error.message });
      continue;
    }

    totalBytes += runtimeAsset.bytes.byteLength;
    if (!product.asset) {
      continue;
    }
    if (runtimeAsset.fileName !== product.asset.fileName) {
      issues.push({ productId: product.id, message: "The attached filename does not match the catalog metadata." });
    }
    if (runtimeAsset.bytes.byteLength !== product.asset.size) {
      issues.push({ productId: product.id, message: "The attached file size does not match the catalog metadata." });
    }
  }

  if (totalBytes > MAX_RELEASE_BYTES) {
    issues.push({ productId: null, message: "Release downloads exceed the 25 MiB total limit." });
  }
  return { ready: issues.length === 0, issues, totalBytes };
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatReferencePrice(priceCents, currency) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(priceCents / 100);
  } catch {
    return currency + " " + (priceCents / 100).toFixed(2);
  }
}

function encodePathSegment(value) {
  return encodeURIComponent(value);
}

export function generateStorefront(catalog) {
  const normalized = canonicalCatalog(catalog);
  const categories = Array.from(new Set(normalized.products.map((product) => product.category))).sort();

  const options = categories
    .map((category) => '<option value="' + escapeHtml(category) + '">' + escapeHtml(category) + "</option>")
    .join("");
  const cards = normalized.products
    .map((product) => {
      const searchValue = escapeHtml((product.title + " " + product.category + " " + product.description).toLowerCase());
      const link = product.asset
        ? '<a class="download" href="downloads/' +
          encodePathSegment(product.id) + "/" + encodePathSegment(product.asset.fileName) +
          '" download="' +
          escapeHtml(product.asset.fileName) +
          '">Download file<span>Public file when hosted</span></a>'
        : '<span class="download unavailable">File not attached<span>Attach a file before release</span></span>';
      return (
        '<article class="product-card" data-category="' +
        escapeHtml(product.category) +
        '" data-search="' +
        searchValue +
        '">' +
        '<div class="card-top"><span class="category">' +
        escapeHtml(product.category) +
        "</span><span class=\"version\">v" +
        escapeHtml(product.version) +
        "</span></div>" +
        "<h2>" +
        escapeHtml(product.title) +
        "</h2>" +
        '<p class="description">' +
        escapeHtml(product.description) +
        "</p>" +
        '<div class="card-bottom"><div><span class="price-label">Reference price only</span><strong class="price">' +
        escapeHtml(formatReferencePrice(product.priceCents, normalized.shop.currency)) +
        "</strong></div>" +
        link +
        "</div></article>"
      );
    })
    .join("");

  const emptyState =
    '<p class="empty-state"' +
    (normalized.products.length > 0 ? " hidden" : "") +
    ">No products match these filters.</p>";
  const pageTitle = escapeHtml(normalized.shop.name);
  const tagline = normalized.shop.tagline
    ? '<p class="tagline">' + escapeHtml(normalized.shop.tagline) + "</p>"
    : '<p class="tagline">A considered collection of useful downloads.</p>';

  return (
    "<!doctype html>\n" +
    '<html lang="en">\n' +
    "<head>\n" +
    '<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    "<title>" +
    pageTitle +
    "</title>\n" +
    "<style>\n" +
    ":root{color-scheme:light;--paper:#f6f0e6;--ink:#28241f;--muted:#71695f;--line:#e3d8c9;--orange:#c45120;--orange-dark:#8e3514;--cream:#fffaf2;--shadow:0 18px 54px rgba(67,43,25,.09)" +
    "}*{box-sizing:border-box}body{margin:0;min-width:320px;background:radial-gradient(ellipse at 14% 0%,rgba(240,190,138,.25),transparent 34rem),var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;line-height:1.55}.shell{width:min(1120px,calc(100% - 36px));margin:0 auto;padding:38px 0 64px}.hero{position:relative;overflow:hidden;padding:clamp(28px,6vw,66px);border:1px solid rgba(255,255,255,.14);border-radius:30px;background:linear-gradient(128deg,#342921,#5d3827 65%,#9c421d);color:#fffaf2;box-shadow:var(--shadow)}.hero:after{position:absolute;right:-70px;bottom:-180px;width:420px;height:420px;border:1px solid rgba(255,255,255,.12);border-radius:50%;box-shadow:0 0 0 32px rgba(255,255,255,.035),0 0 0 76px rgba(255,255,255,.025);content:\"\"}.eyebrow{margin:0 0 15px;color:#f4b984;font-size:.75rem;font-weight:800;letter-spacing:.19em;text-transform:uppercase}.hero h1{max-width:760px;margin:0;font-family:Georgia,\"Times New Roman\",serif;font-size:clamp(2.5rem,7vw,5rem);font-weight:500;letter-spacing:-.045em;line-height:1.02;overflow-wrap:anywhere}.tagline{max-width:620px;margin:18px 0 0;color:#eadfd4;font-size:clamp(1rem,2.2vw,1.2rem);white-space:pre-wrap}.host-note{position:relative;z-index:1;margin:29px 0 0;padding:12px 15px;border:1px solid rgba(255,255,255,.25);border-radius:13px;background:rgba(255,255,255,.08);color:#fffaf2;font-size:.9rem}.catalog-tools{display:flex;align-items:end;justify-content:space-between;gap:18px;margin:30px 0 18px}.section-title{margin:0;font-family:Georgia,\"Times New Roman\",serif;font-size:1.8rem;font-weight:500}.result-count{margin:5px 0 0;color:var(--muted);font-size:.9rem}.filters{display:flex;gap:12px;flex-wrap:wrap}.field{display:grid;gap:5px;color:#50483f;font-size:.78rem;font-weight:750}.field input,.field select{width:min(280px,calc(100vw - 52px));min-height:44px;padding:9px 12px;border:1px solid #d7cbbb;border-radius:11px;background:var(--cream);color:var(--ink);font:inherit;font-size:.95rem}.field select{width:190px}.field input:focus,.field select:focus,.download:focus-visible{outline:3px solid #e19a6d;outline-offset:2px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.product-card{display:flex;min-height:310px;flex-direction:column;padding:21px;border:1px solid var(--line);border-radius:19px;background:rgba(255,250,242,.9);box-shadow:0 8px 24px rgba(67,43,25,.045)}.product-card[hidden]{display:none}.card-top{display:flex;align-items:center;justify-content:space-between;gap:10px}.category,.version{display:inline-flex;min-height:26px;align-items:center;padding:4px 9px;border-radius:999px;font-size:.72rem;font-weight:750}.category{background:#f5dfcd;color:#843711}.version{background:#eee8df;color:#675f55}.product-card h2{margin:19px 0 8px;font-family:Georgia,\"Times New Roman\",serif;font-size:1.42rem;font-weight:600;line-height:1.16;overflow-wrap:anywhere}.description{flex:1;margin:0;color:#645c52;font-size:.94rem;white-space:pre-wrap;overflow-wrap:anywhere}.card-bottom{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-top:23px;padding-top:17px;border-top:1px solid #eee4d7}.price-label{display:block;color:#786e62;font-size:.69rem;font-weight:750;letter-spacing:.06em;text-transform:uppercase}.price{display:block;margin-top:3px;font-size:1.16rem;font-variant-numeric:tabular-nums}.download{display:inline-flex;min-height:44px;flex-direction:column;align-items:center;justify-content:center;padding:7px 12px;border-radius:11px;background:var(--orange);color:white;font-size:.83rem;font-weight:800;line-height:1.15;text-align:center;text-decoration:none}.download:hover{background:var(--orange-dark)}.download span{margin-top:3px;color:#ffe5d5;font-size:.62rem;font-weight:600}.unavailable{background:#e8e0d5;color:#6f665b}.unavailable span{color:#6f665b}.empty-state{padding:38px 20px;border:1px dashed #c8b9a6;border-radius:16px;color:var(--muted);text-align:center}.footer{margin-top:25px;color:#71695f;font-size:.8rem}.footer p{margin:5px 0}.footer strong{color:#4a3d31}@media(max-width:850px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:580px){.shell{width:min(100% - 24px,1120px);padding-top:12px}.hero{padding:27px 22px;border-radius:23px}.catalog-tools{align-items:start;flex-direction:column}.filters{width:100%}.field{flex:1}.field input,.field select{width:100%}.grid{grid-template-columns:1fr;gap:12px}.product-card{min-height:280px}.card-bottom{align-items:center}.host-note{font-size:.83rem}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}\n" +
    "</style>\n" +
    "</head>\n" +
    "<body>\n" +
    '<main class="shell">\n' +
    '<header class="hero"><p class="eyebrow">Independent download catalog</p><h1>' +
    pageTitle +
    "</h1>" +
    tagline +
    '<p class="host-note"><strong>Hosting notice:</strong> downloads are public files when hosted. Anyone who can reach this page may access its files.</p></header>\n' +
    '<section class="catalog-tools" aria-labelledby="catalog-heading"><div><h2 class="section-title" id="catalog-heading">The collection</h2><p class="result-count" id="result-count" aria-live="polite"></p></div><div class="filters"><label class="field" for="catalog-search">Search products<input id="catalog-search" type="search" autocomplete="off" placeholder="Title, category, or detail"></label><label class="field" for="category-filter">Filter by category<select id="category-filter"><option value="">All categories</option>' +
    options +
    "</select></label></div></section>\n" +
    '<section class="grid" id="product-grid" aria-label="Download products">' +
    cards +
    "</section>\n" +
    emptyState +
    '<footer class="footer"><p><strong>Reference prices only.</strong> This catalog has no checkout or payment processing.</p><p>Review distribution rights and file quality before publishing.</p></footer>\n' +
    "</main>\n" +
    "<script>\n" +
    "const search=document.getElementById('catalog-search');const category=document.getElementById('category-filter');const cards=[...document.querySelectorAll('.product-card')];const count=document.getElementById('result-count');const empty=document.querySelector('.empty-state');function applyFilters(){const q=search.value.trim().toLowerCase();const selected=category.value;let visible=0;for(const card of cards){const show=(!q||card.dataset.search.includes(q))&&(!selected||card.dataset.category===selected);card.hidden=!show;if(show)visible+=1}count.textContent=visible+' '+(visible===1?'product':'products');empty.hidden=visible>0}search.addEventListener('input',applyFilters);category.addEventListener('change',applyFilters);applyFilters();\n" +
    "</script>\n" +
    "</body>\n" +
    "</html>\n"
  );
}

function makeCrc32Table() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

const CRC32_TABLE = makeCrc32Table();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStored(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const flags = 0x0800;
  const method = 0;
  const date = 0x0021;
  const time = 0;

  function write16(view, position, value) {
    view.setUint16(position, value, true);
  }
  function write32(view, position, value) {
    view.setUint32(position, value >>> 0, true);
  }

  for (const file of files) {
    const name = encoder.encode(file.path);
    const data = file.bytes;
    if (name.byteLength > 0xffff || data.byteLength > 0xffffffff || offset > 0xffffffff) {
      throw new RangeError("ZIP entry exceeds the non-Zip64 size limit.");
    }
    const checksum = crc32(data);
    const localHeader = new Uint8Array(30);
    const localView = new DataView(localHeader.buffer);
    write32(localView, 0, 0x04034b50);
    write16(localView, 4, 20);
    write16(localView, 6, flags);
    write16(localView, 8, method);
    write16(localView, 10, time);
    write16(localView, 12, date);
    write32(localView, 14, checksum);
    write32(localView, 18, data.byteLength);
    write32(localView, 22, data.byteLength);
    write16(localView, 26, name.byteLength);
    write16(localView, 28, 0);
    localParts.push(localHeader, name, data);

    const centralHeader = new Uint8Array(46);
    const centralView = new DataView(centralHeader.buffer);
    write32(centralView, 0, 0x02014b50);
    write16(centralView, 4, 0x0314);
    write16(centralView, 6, 20);
    write16(centralView, 8, flags);
    write16(centralView, 10, method);
    write16(centralView, 12, time);
    write16(centralView, 14, date);
    write32(centralView, 16, checksum);
    write32(centralView, 20, data.byteLength);
    write32(centralView, 24, data.byteLength);
    write16(centralView, 28, name.byteLength);
    write16(centralView, 30, 0);
    write16(centralView, 32, 0);
    write16(centralView, 34, 0);
    write16(centralView, 36, 0);
    write32(centralView, 38, 0);
    write32(centralView, 42, offset);
    centralParts.push(centralHeader, name);
    offset += localHeader.byteLength + name.byteLength + data.byteLength;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.byteLength, 0);
  const centralOffset = offset;
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  write32(endView, 0, 0x06054b50);
  write16(endView, 4, 0);
  write16(endView, 6, 0);
  write16(endView, 8, files.length);
  write16(endView, 10, files.length);
  write32(endView, 12, centralSize);
  write32(endView, 16, centralOffset);
  write16(endView, 20, 0);

  const totalLength = offset + centralSize + end.byteLength;
  const result = new Uint8Array(totalLength);
  let position = 0;
  for (const part of localParts) {
    result.set(part, position);
    position += part.byteLength;
  }
  for (const part of centralParts) {
    result.set(part, position);
    position += part.byteLength;
  }
  result.set(end, position);
  return result;
}

function encodeText(text) {
  return encoder.encode(text);
}

function createReadme() {
  return (
    "Toolroom Studio release\n" +
    "=======================\n\n" +
    "This ZIP contains a static catalog page and its listed download files.\n\n" +
    "Every download is a public file when hosted. Anyone who can reach the page URL may access the files. " +
    "This package does not provide payment processing, protected delivery, license enforcement, or customer acceptance.\n\n" +
    "Displayed prices are references only. Publish only files you are licensed to distribute and have reviewed.\n\n" +
    "RELEASE.json lists the SHA-256 hash and byte size for every other archive member. It omits its own hash because including that value would be self-referential.\n"
  );
}

export async function buildRelease(catalog, assets) {
  const normalized = canonicalCatalog(catalog);
  const initialInspection = inspectRelease(normalized, assets);
  if (!initialInspection.ready) {
    throw new Error(
      "Release is not ready: " +
        initialInspection.issues.map((issue) => issue.message).join(" "),
    );
  }

  const snapshotAssets = new Map();
  for (const product of normalized.products) {
    const source = readRuntimeAsset(getMapValue(assets, product.id), "assets[" + product.id + "]");
    snapshotAssets.set(product.id, { fileName: source.fileName, bytes: new Uint8Array(source.bytes) });
  }

  const inspection = inspectRelease(normalized, snapshotAssets);
  if (!inspection.ready) {
    throw new Error(
      "Release is not ready: " +
        inspection.issues.map((issue) => issue.message).join(" "),
    );
  }

  const contentFiles = [
    { path: "index.html", bytes: encodeText(generateStorefront(normalized)) },
    { path: "catalog.json", bytes: encodeText(serializeCatalog(normalized)) },
  ];

  for (const product of normalized.products) {
    const actual = getMapValue(snapshotAssets, product.id).bytes;
    const actualHash = await hashBytes(actual);
    if (actualHash !== product.asset.sha256) {
      throw new Error("SHA-256 mismatch for product " + product.id + ".");
    }
    contentFiles.push({
      path: "downloads/" + product.id + "/" + product.asset.fileName,
      bytes: actual,
    });
  }

  contentFiles.push({ path: "README.txt", bytes: encodeText(createReadme()) });
  const manifestMembers = [];
  for (const file of contentFiles) {
    manifestMembers.push({
      path: file.path,
      size: file.bytes.byteLength,
      sha256: await hashBytes(file.bytes),
    });
  }

  const manifest = {
    schema: "toolroom-release",
    version: 1,
    shopName: normalized.shop.name,
    members: manifestMembers,
  };
  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  const files = contentFiles.concat([{ path: "RELEASE.json", bytes: encodeText(manifestText) }]);
  return { bytes: zipStored(files), manifest };
}
