import { canonicalCatalog, hashBytes, parseCatalog } from "./toolroom-studio-core.mjs";

const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
const MAX_ARCHIVE_MEMBERS = 44;
const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_CATALOG_BYTES = 256 * 1024;
const MAX_TEXT_MEMBER_BYTES = 1024 * 1024;
const UTF8_FLAG = 0x0800;
const ZIP_DATE = 0x0021;
const ZIP_TIME = 0;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;
const FORBIDDEN_SEGMENT_CHARACTERS = /[<>:"|?*]/;

function invalid(message) {
  throw new Error("Release restore failed: " + message);
}

function requireRange(offset, size, limit, label) {
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(size) ||
    offset < 0 ||
    size < 0 ||
    offset + size > limit
  ) {
    invalid("The ZIP is truncated or has an invalid " + label + ".");
  }
}

function u16(view, offset, limit, label) {
  requireRange(offset, 2, limit, label);
  return view.getUint16(offset, true);
}

function u32(view, offset, limit, label) {
  requireRange(offset, 4, limit, label);
  return view.getUint32(offset, true);
}

function equalBytes(left, right) {
  if (left.byteLength !== right.byteLength) {
    return false;
  }
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function decodeUtf8(bytes, label) {
  try {
    const text = decoder.decode(bytes);
    if (!equalBytes(encoder.encode(text), bytes)) {
      invalid(label + " is not canonical UTF-8.");
    }
    return text;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Release restore failed:")) {
      throw error;
    }
    invalid(label + " is not valid UTF-8.");
  }
}

function decodeZipPath(bytes, label) {
  const path = decodeUtf8(bytes, label);
  assertSafePath(path);
  return path;
}

function assertSafePath(path) {
  if (
    typeof path !== "string" ||
    path.length === 0 ||
    path.startsWith("/") ||
    path.endsWith("/") ||
    path.includes("\\") ||
    path.includes(":") ||
    CONTROL_CHARACTERS.test(path) ||
    encoder.encode(path).byteLength > 1024
  ) {
    invalid("A ZIP member has an unsafe path.");
  }

  const segments = path.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    invalid("A ZIP member has an unsafe path.");
  }
  for (const segment of segments) {
    if (
      segment.startsWith(".") ||
      segment.endsWith(".") ||
      segment.endsWith(" ") ||
      FORBIDDEN_SEGMENT_CHARACTERS.test(segment)
    ) {
      invalid("A ZIP member has an unsafe path.");
    }
  }
}

function pathCollisionKey(path) {
  return path.normalize("NFC").toLocaleUpperCase("en-US");
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function parseStoredZip(snapshot) {
  if (snapshot.byteLength < 22) {
    invalid("The ZIP is too short to contain an end record.");
  }

  const view = new DataView(snapshot.buffer, snapshot.byteOffset, snapshot.byteLength);
  const endOffset = snapshot.byteLength - 22;
  if (u32(view, endOffset, snapshot.byteLength, "end record") !== 0x06054b50) {
    invalid("The ZIP end record is missing or has a trailing comment.");
  }

  const diskNumber = u16(view, endOffset + 4, snapshot.byteLength, "end record");
  const centralDisk = u16(view, endOffset + 6, snapshot.byteLength, "end record");
  const entriesOnDisk = u16(view, endOffset + 8, snapshot.byteLength, "end record");
  const entryCount = u16(view, endOffset + 10, snapshot.byteLength, "end record");
  const centralSize = u32(view, endOffset + 12, snapshot.byteLength, "end record");
  const centralOffset = u32(view, endOffset + 16, snapshot.byteLength, "end record");
  const commentLength = u16(view, endOffset + 20, snapshot.byteLength, "end record");

  if (commentLength !== 0) {
    invalid("ZIP comments are not supported.");
  }
  if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) {
    invalid("Multi-disk ZIP archives are not supported.");
  }
  if (
    entryCount === 0xffff ||
    centralSize === 0xffffffff ||
    centralOffset === 0xffffffff ||
    entryCount < 5 ||
    entryCount > MAX_ARCHIVE_MEMBERS
  ) {
    invalid("The ZIP entry count or directory uses an unsupported size.");
  }
  if (centralOffset + centralSize !== endOffset) {
    invalid("The ZIP central directory does not end at the end record.");
  }

  const centralEnd = centralOffset + centralSize;
  const records = [];
  const seenPaths = new Set();
  let cursor = centralOffset;

  for (let index = 0; index < entryCount; index += 1) {
    requireRange(cursor, 46, centralEnd, "central directory header");
    if (u32(view, cursor, centralEnd, "central directory header") !== 0x02014b50) {
      invalid("A central directory header is malformed.");
    }

    const madeBy = u16(view, cursor + 4, centralEnd, "central directory header");
    const neededVersion = u16(view, cursor + 6, centralEnd, "central directory header");
    const flags = u16(view, cursor + 8, centralEnd, "central directory header");
    const method = u16(view, cursor + 10, centralEnd, "central directory header");
    const time = u16(view, cursor + 12, centralEnd, "central directory header");
    const date = u16(view, cursor + 14, centralEnd, "central directory header");
    const checksum = u32(view, cursor + 16, centralEnd, "central directory header");
    const compressedSize = u32(view, cursor + 20, centralEnd, "central directory header");
    const uncompressedSize = u32(view, cursor + 24, centralEnd, "central directory header");
    const nameLength = u16(view, cursor + 28, centralEnd, "central directory header");
    const extraLength = u16(view, cursor + 30, centralEnd, "central directory header");
    const entryCommentLength = u16(view, cursor + 32, centralEnd, "central directory header");
    const diskStart = u16(view, cursor + 34, centralEnd, "central directory header");
    const internalAttributes = u16(view, cursor + 36, centralEnd, "central directory header");
    const externalAttributes = u32(view, cursor + 38, centralEnd, "central directory header");
    const localOffset = u32(view, cursor + 42, centralEnd, "central directory header");
    const centralNameStart = cursor + 46;

    if (
      madeBy !== 0x0314 ||
      neededVersion !== 20 ||
      flags !== UTF8_FLAG ||
      method !== 0 ||
      time !== ZIP_TIME ||
      date !== ZIP_DATE ||
      extraLength !== 0 ||
      entryCommentLength !== 0 ||
      diskStart !== 0 ||
      internalAttributes !== 0 ||
      externalAttributes !== 0
    ) {
      invalid("A ZIP member uses unsupported flags, metadata, or attributes.");
    }
    if (
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localOffset === 0xffffffff ||
      compressedSize !== uncompressedSize ||
      uncompressedSize > MAX_FILE_BYTES
    ) {
      invalid("A ZIP member uses Zip64 or exceeds the 10 MiB file limit.");
    }
    if (nameLength === 0) {
      invalid("A ZIP member has an empty path.");
    }
    requireRange(centralNameStart, nameLength, centralEnd, "central directory filename");

    const pathBytes = snapshot.subarray(centralNameStart, centralNameStart + nameLength);
    const path = decodeZipPath(pathBytes, "A ZIP member path");
    const collisionKey = pathCollisionKey(path);
    if (seenPaths.has(collisionKey)) {
      invalid("The ZIP contains duplicate or case-colliding paths.");
    }
    seenPaths.add(collisionKey);

    const recordEnd = centralNameStart + nameLength + extraLength + entryCommentLength;
    requireRange(cursor, recordEnd - cursor, centralEnd, "central directory entry");
    records.push({
      path,
      pathBytes: new Uint8Array(pathBytes),
      checksum,
      size: uncompressedSize,
      localOffset,
      centralOffset: cursor,
    });
    cursor = recordEnd;
  }

  if (cursor !== centralEnd) {
    invalid("The ZIP central directory contains extra or missing data.");
  }

  let nextLocalOffset = 0;
  for (const record of records) {
    if (record.localOffset !== nextLocalOffset) {
      invalid("ZIP local members must be contiguous and must not overlap.");
    }
    requireRange(record.localOffset, 30, centralOffset, "local file header");
    const localOffset = record.localOffset;
    if (u32(view, localOffset, centralOffset, "local file header") !== 0x04034b50) {
      invalid("A local file header is malformed.");
    }

    const neededVersion = u16(view, localOffset + 4, centralOffset, "local file header");
    const flags = u16(view, localOffset + 6, centralOffset, "local file header");
    const method = u16(view, localOffset + 8, centralOffset, "local file header");
    const time = u16(view, localOffset + 10, centralOffset, "local file header");
    const date = u16(view, localOffset + 12, centralOffset, "local file header");
    const checksum = u32(view, localOffset + 14, centralOffset, "local file header");
    const compressedSize = u32(view, localOffset + 18, centralOffset, "local file header");
    const uncompressedSize = u32(view, localOffset + 22, centralOffset, "local file header");
    const nameLength = u16(view, localOffset + 26, centralOffset, "local file header");
    const extraLength = u16(view, localOffset + 28, centralOffset, "local file header");

    if (
      neededVersion !== 20 ||
      flags !== UTF8_FLAG ||
      method !== 0 ||
      time !== ZIP_TIME ||
      date !== ZIP_DATE ||
      extraLength !== 0 ||
      checksum !== record.checksum ||
      compressedSize !== record.size ||
      uncompressedSize !== record.size ||
      nameLength !== record.pathBytes.byteLength
    ) {
      invalid("A local file header does not match its central directory entry.");
    }

    const localNameStart = localOffset + 30;
    requireRange(localNameStart, nameLength, centralOffset, "local filename");
    const localNameBytes = snapshot.subarray(localNameStart, localNameStart + nameLength);
    if (!equalBytes(localNameBytes, record.pathBytes)) {
      invalid("A local filename does not match its central directory entry.");
    }

    const dataStart = localNameStart + nameLength;
    requireRange(dataStart, record.size, centralOffset, "member data");
    const dataEnd = dataStart + record.size;
    const bytes = snapshot.slice(dataStart, dataEnd);
    if (crc32(bytes) !== record.checksum) {
      invalid("CRC-32 verification failed for " + record.path + ".");
    }
    record.bytes = bytes;
    nextLocalOffset = dataEnd;
  }

  if (nextLocalOffset !== centralOffset) {
    invalid("ZIP local members do not end at the central directory.");
  }
  return records;
}

function scanForDuplicateJsonKeys(text, label) {
  let index = 0;

  function skipWhitespace() {
    while (index < text.length && /[\u0009\u000a\u000d\u0020]/.test(text[index])) {
      index += 1;
    }
  }

  function readString() {
    const start = index;
    if (text[index] !== '"') {
      invalid(label + " contains malformed JSON.");
    }
    index += 1;
    while (index < text.length) {
      const character = text[index];
      index += 1;
      if (character === '"') {
        try {
          return JSON.parse(text.slice(start, index));
        } catch {
          invalid(label + " contains malformed JSON.");
        }
      }
      if (character === "\\") {
        if (index >= text.length) {
          invalid(label + " contains malformed JSON.");
        }
        if (text[index] === "u") {
          index += 5;
        } else {
          index += 1;
        }
      }
    }
    invalid(label + " contains an unterminated JSON string.");
  }

  function expect(character) {
    if (text[index] !== character) {
      invalid(label + " contains malformed JSON.");
    }
    index += 1;
  }

  function readValue(depth) {
    if (depth > 12) {
      invalid(label + " is nested too deeply.");
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
      invalid(label + " contains malformed JSON.");
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
        invalid(label + " contains duplicate JSON object keys.");
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
    invalid(label + " contains an unterminated JSON object.");
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
    invalid(label + " contains an unterminated JSON array.");
  }

  readValue(0);
  skipWhitespace();
  if (index !== text.length) {
    invalid(label + " contains extra content after its JSON value.");
  }
}

function parseJson(text, label) {
  scanForDuplicateJsonKeys(text, label);
  try {
    return JSON.parse(text);
  } catch {
    invalid(label + " contains malformed JSON.");
  }
}

function exactRecord(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    invalid(label + " must be an object.");
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    invalid(label + " has an unsafe prototype.");
  }

  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.length !== keys.length || ownKeys.some((key) => typeof key !== "string" || !keys.includes(key))) {
    invalid(label + " has missing, extra, or dangerous fields.");
  }

  const values = Object.create(null);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
      invalid(label + " contains an accessor or hidden field.");
    }
    values[key] = descriptor.value;
  }
  return values;
}

function exactArray(value, maximum, label) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum) {
    invalid(label + " must be a bounded array.");
  }
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1 || !keys.includes("length")) {
    invalid(label + " contains extra array fields.");
  }

  const values = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
      invalid(label + " contains a hole or accessor.");
    }
    values.push(descriptor.value);
  }
  return values;
}

function parseManifest(bytes) {
  if (bytes.byteLength > MAX_CATALOG_BYTES) {
    invalid("RELEASE.json exceeds the 256 KiB limit.");
  }
  const text = decodeUtf8(bytes, "RELEASE.json");
  const value = parseJson(text, "RELEASE.json");
  const manifest = exactRecord(value, ["schema", "version", "shopName", "members"], "RELEASE.json");
  if (manifest.schema !== "toolroom-release" || manifest.version !== 1) {
    invalid("RELEASE.json has an unsupported schema or version.");
  }
  if (typeof manifest.shopName !== "string") {
    invalid("RELEASE.json shopName must be a string.");
  }

  const members = exactArray(manifest.members, MAX_ARCHIVE_MEMBERS - 1, "RELEASE.json members").map(
    (member, index) => {
      const fields = exactRecord(member, ["path", "size", "sha256"], "RELEASE.json members[" + index + "]");
      if (typeof fields.path !== "string") {
        invalid("A RELEASE.json member path must be a string.");
      }
      assertSafePath(fields.path);
      if (!Number.isSafeInteger(fields.size) || fields.size < 1 || fields.size > MAX_FILE_BYTES) {
        invalid("A RELEASE.json member size is invalid.");
      }
      if (typeof fields.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(fields.sha256)) {
        invalid("A RELEASE.json member hash must be lowercase SHA-256.");
      }
      return { path: fields.path, size: fields.size, sha256: fields.sha256 };
    },
  );

  return { shopName: manifest.shopName, members };
}

function expectedMemberPaths(catalog) {
  const paths = ["index.html", "catalog.json"];
  for (const product of catalog.products) {
    if (!product.asset) {
      invalid("Every release product must include an attached file.");
    }
    if (!product.rightsConfirmed || !product.qaConfirmed) {
      invalid("The release catalog must contain rights and quality confirmations.");
    }
    paths.push("downloads/" + product.id + "/" + product.asset.fileName);
  }
  paths.push("README.txt", "RELEASE.json");
  return paths;
}

function requireTextMember(record, maximum, label) {
  if (record.bytes.byteLength > maximum) {
    invalid(label + " exceeds its size limit.");
  }
  decodeUtf8(record.bytes, label);
}

export async function restoreRelease(inputUint8Array) {
  if (!(inputUint8Array instanceof Uint8Array)) {
    invalid("Provide the release as a Uint8Array.");
  }
  if (inputUint8Array.byteLength > MAX_ARCHIVE_BYTES) {
    invalid("The ZIP exceeds the 32 MiB archive limit.");
  }

  const snapshot = new Uint8Array(inputUint8Array);
  const records = parseStoredZip(snapshot);
  const byPath = new Map(records.map((record) => [record.path, record]));
  const catalogRecord = byPath.get("catalog.json");
  const releaseRecord = byPath.get("RELEASE.json");
  const indexRecord = byPath.get("index.html");
  const readmeRecord = byPath.get("README.txt");

  if (!catalogRecord || !releaseRecord || !indexRecord || !readmeRecord) {
    invalid("The ZIP is missing a required Toolroom release file.");
  }
  if (catalogRecord.bytes.byteLength > MAX_CATALOG_BYTES) {
    invalid("catalog.json exceeds the 256 KiB limit.");
  }
  requireTextMember(indexRecord, MAX_TEXT_MEMBER_BYTES, "index.html");
  requireTextMember(readmeRecord, MAX_TEXT_MEMBER_BYTES, "README.txt");

  let catalog;
  try {
    const catalogText = decodeUtf8(catalogRecord.bytes, "catalog.json");
    catalog = canonicalCatalog(parseCatalog(catalogText));
  } catch (error) {
    invalid("catalog.json is invalid: " + error.message);
  }
  if (catalog.products.length < 1) {
    invalid("The release catalog must contain at least one product.");
  }

  const expectedPaths = expectedMemberPaths(catalog);
  if (records.length !== expectedPaths.length || records.some((record, index) => record.path !== expectedPaths[index])) {
    invalid("The ZIP member set or order does not match its catalog.");
  }

  const downloadRecords = [];
  let totalBytes = 0;
  for (const product of catalog.products) {
    const path = "downloads/" + product.id + "/" + product.asset.fileName;
    const record = byPath.get(path);
    if (!record) {
      invalid("The attached file is missing for product " + product.id + ".");
    }
    if (record.bytes.byteLength > MAX_FILE_BYTES) {
      invalid("A download exceeds the 10 MiB per-file limit.");
    }
    if (record.bytes.byteLength !== product.asset.size) {
      invalid("The attached file size does not match catalog metadata for product " + product.id + ".");
    }
    totalBytes += record.bytes.byteLength;
    if (totalBytes > MAX_DOWNLOAD_BYTES) {
      invalid("Downloads exceed the 25 MiB combined limit.");
    }
    downloadRecords.push({ product, record });
  }

  const manifest = parseManifest(releaseRecord.bytes);
  if (manifest.shopName !== catalog.shop.name) {
    invalid("RELEASE.json shopName does not match catalog.json.");
  }
  const expectedManifestRecords = records.filter((record) => record.path !== "RELEASE.json");
  if (manifest.members.length !== expectedManifestRecords.length) {
    invalid("RELEASE.json does not list every archive member except itself.");
  }

  const hashes = new Map();
  for (let index = 0; index < expectedManifestRecords.length; index += 1) {
    const record = expectedManifestRecords[index];
    const member = manifest.members[index];
    if (member.path !== record.path || member.size !== record.bytes.byteLength) {
      invalid("RELEASE.json member paths or sizes do not match the ZIP.");
    }
    const actualHash = await hashBytes(record.bytes);
    if (actualHash !== member.sha256) {
      invalid("SHA-256 verification failed for archive member " + record.path + ".");
    }
    hashes.set(record.path, actualHash);
  }

  const assets = new Map();
  for (const { product, record } of downloadRecords) {
    if (hashes.get(record.path) !== product.asset.sha256) {
      invalid("The download hash does not match catalog metadata for product " + product.id + ".");
    }
    assets.set(product.id, {
      fileName: product.asset.fileName,
      bytes: new Uint8Array(record.bytes),
    });
  }

  const restoredCatalog = canonicalCatalog({
    schema: catalog.schema,
    version: catalog.version,
    shop: {
      name: catalog.shop.name,
      tagline: catalog.shop.tagline,
      currency: catalog.shop.currency,
    },
    products: catalog.products.map((product) => ({
      ...product,
      rightsConfirmed: false,
      qaConfirmed: false,
    })),
  });

  return {
    catalog: restoredCatalog,
    assets,
    summary: {
      shopName: restoredCatalog.shop.name,
      products: restoredCatalog.products.length,
      totalBytes,
      members: records.length,
    },
  };
}
