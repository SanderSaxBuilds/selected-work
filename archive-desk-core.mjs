const UTF8 = new TextEncoder()
const UTF8_FATAL = new TextDecoder("utf-8", { fatal: true })
const UTF8_FLAG = 0x0800
const ZIP_LOCAL = 0x04034b50
const ZIP_CENTRAL = 0x02014b50
const ZIP_EOCD = 0x06054b50
const ZIP_MAX_NAME_BYTES = 0xffff
const MANIFEST_PATH = "ArchiveDesk/manifest.json"
const FILE_PREFIX = "files/"
const MAX_ARCHIVE_BYTES = 52 * 1024 * 1024
const MAX_PATH_BYTES = 1024

export const LIMITS = Object.freeze({
  maxFiles: 500,
  maxFileBytes: 20 * 1024 * 1024,
  maxTotalBytes: 50 * 1024 * 1024
})

function fail(message) {
  throw new Error(message)
}

function getRecord(value, allowed, required, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object.`)
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    fail(`${label} must be a plain object.`)
  }
  const result = Object.create(null)
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowed.has(key)) {
      fail(`${label} contains an unsupported field.`)
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !("value" in descriptor)) {
      fail(`${label} fields must be ordinary values.`)
    }
    result[key] = descriptor.value
  }
  for (const key of required) {
    if (!Object.hasOwn(result, key)) fail(`${label} is missing ${key}.`)
  }
  return result
}

function validateIsoUtc(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    fail(`${label} must be a valid ISO UTC date with milliseconds.`)
  }
  const date = new Date(value)
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    fail(`${label} must be a valid ISO UTC date with milliseconds.`)
  }
  return value
}

function validateModifiedAt(value, label) {
  if (!Number.isSafeInteger(value) || Math.abs(value) > 8.64e15 || !Number.isFinite(new Date(value).getTime())) {
    fail(`${label} must be a valid integer timestamp in milliseconds.`)
  }
  return value
}

function encodePath(path, label, maxBytes = MAX_PATH_BYTES + FILE_PREFIX.length) {
  if (typeof path !== "string" || path.length === 0) fail(`${label} must be a non-empty relative path.`)
  if (path.length > maxBytes) fail(`${label} is too long for this ZIP format.`)
  if (path.startsWith("/") || /^[A-Za-z]:/.test(path) || path.includes("\\")) {
    fail(`${label} must be a safe relative path using forward slashes.`)
  }
  if (/[\u0000-\u001f\u007f-\u009f]/u.test(path)) fail(`${label} contains a control character.`)
  const segments = path.split("/")
  for (const segment of segments) {
    if (segment.length > 255) fail(`${label} contains a filename component longer than 255 UTF-16 code units.`)
    if (segment.length === 0 || segment === "." || segment === "..") {
      fail(`${label} contains an empty, current, or parent path segment.`)
    }
    if (/[<>:"|?*]/u.test(segment)) fail(`${label} contains a Windows-invalid filename character.`)
    if (/[. ]$/u.test(segment)) fail(`${label} contains a segment ending in a dot or space.`)
    const deviceName = segment.split(".", 1)[0].replace(/[ .]+$/gu, "").toUpperCase()
    if (/^(CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|COM[1-9¹²³]|LPT[1-9¹²³])$/u.test(deviceName)) {
      fail(`${label} contains a Windows-reserved filename.`)
    }
  }
  let encoded
  try {
    encoded = UTF8.encode(path)
    if (UTF8_FATAL.decode(encoded) !== path) fail(`${label} contains invalid Unicode.`)
  } catch {
    fail(`${label} contains invalid Unicode.`)
  }
  if (encoded.byteLength > maxBytes) fail(`${label} is too long for this ZIP format.`)
  return encoded
}

function collisionKey(path) {
  return path.normalize("NFC").toLowerCase()
}

function assertUniquePaths(items, getPath, label) {
  const seen = new Set()
  for (const item of items) {
    const path = getPath(item)
    const key = collisionKey(path)
    if (seen.has(key)) fail(`${label} contains duplicate or case-insensitive filename collisions.`)
    seen.add(key)
  }
  for (const path of seen) {
    let split = path.indexOf("/")
    while (split !== -1) {
      if (seen.has(path.slice(0, split))) fail(`${label} contains a file and folder path collision.`)
      split = path.indexOf("/", split + 1)
    }
  }
}

function byteSource(value, label) {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  fail(`${label} must be a Uint8Array or ArrayBuffer.`)
}

function copyBytes(source, label) {
  try {
    const copy = new Uint8Array(source.byteLength)
    copy.set(source)
    return copy
  } catch {
    fail(`${label} could not be read as bytes.`)
  }
}

function snapshotFiles(files) {
  if (!Array.isArray(files)) fail("Files must be an array.")
  if (files.length === 0) fail("Choose at least one file to create a backup.")
  if (files.length > LIMITS.maxFiles) fail(`A backup can contain at most ${LIMITS.maxFiles} files.`)

  const pending = []
  let total = 0
  const allowed = new Set(["path", "data", "modifiedAt"])
  for (let index = 0; index < files.length; index += 1) {
    if (!Object.hasOwn(files, index)) fail("Files cannot contain empty selection slots.")
    const item = getRecord(files[index], allowed, new Set(["path", "data"]), `File ${index + 1}`)
    const pathBytes = encodePath(item.path, `File ${index + 1} path`, MAX_PATH_BYTES)
    const source = byteSource(item.data, `File ${index + 1} data`)
    if (source.byteLength > LIMITS.maxFileBytes) {
      fail(`File ${item.path} is larger than the ${formatBytes(LIMITS.maxFileBytes)} per-file limit.`)
    }
    total += source.byteLength
    if (total > LIMITS.maxTotalBytes) {
      fail(`Selected files exceed the ${formatBytes(LIMITS.maxTotalBytes)} total limit.`)
    }
    const modifiedAt = Object.hasOwn(item, "modifiedAt") ? validateModifiedAt(item.modifiedAt, `File ${item.path} modifiedAt`) : Date.now()
    pending.push({ path: item.path, pathBytes, source, bytes: source.byteLength, modifiedAt })
  }
  assertUniquePaths(pending, item => item.path, "File selection")

  return pending.map(item => ({
    path: item.path,
    pathBytes: item.pathBytes,
    data: copyBytes(item.source, `File ${item.path}`),
    bytes: item.bytes,
    modifiedAt: item.modifiedAt
  }))
}

function subtleCrypto() {
  const subtle = globalThis.crypto?.subtle
  if (!subtle || typeof subtle.digest !== "function") {
    fail("SHA-256 is unavailable in this browser or runtime context.")
  }
  return subtle
}

async function sha256Hex(data) {
  let digest
  try {
    digest = new Uint8Array(await subtleCrypto().digest("SHA-256", data))
  } catch (error) {
    if (error instanceof Error && error.message === "SHA-256 is unavailable in this browser or runtime context.") throw error
    fail("SHA-256 could not be calculated in this browser or runtime context.")
  }
  return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("")
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let value = 0; value < 256; value += 1) {
    let current = value
    for (let bit = 0; bit < 8; bit += 1) current = (current & 1) ? (0xedb88320 ^ (current >>> 1)) : (current >>> 1)
    table[value] = current >>> 0
  }
  return table
})()

function crc32(bytes) {
  let crc = 0xffffffff
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function dosDateTime(timestamp) {
  const min = Date.UTC(1980, 0, 1, 0, 0, 0, 0)
  const max = Date.UTC(2107, 11, 31, 23, 59, 58, 999)
  const clamped = Math.min(max, Math.max(min, timestamp))
  const date = new Date(clamped)
  const year = date.getUTCFullYear()
  const dosDate = ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate()
  const dosTime = (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (Math.floor(date.getUTCSeconds() / 2))
  return { dosDate, dosTime }
}

function writeZip(entries) {
  if (entries.length > 0xffff) fail("This ZIP has too many entries for the supported format.")
  let totalLength = 22
  const prepared = entries.map(entry => {
    if (entry.data.byteLength > 0xffffffff || entry.nameBytes.byteLength > ZIP_MAX_NAME_BYTES) {
      fail("A ZIP entry is too large for the supported format.")
    }
    const { dosDate, dosTime } = dosDateTime(entry.modifiedAt)
    const crc = crc32(entry.data)
    totalLength += 30 + entry.nameBytes.byteLength + entry.data.byteLength
    totalLength += 46 + entry.nameBytes.byteLength
    if (!Number.isSafeInteger(totalLength) || totalLength > 0xffffffff) fail("The ZIP is too large for the supported format.")
    return { ...entry, dosDate, dosTime, crc, localOffset: 0 }
  })

  const output = new Uint8Array(totalLength)
  const view = new DataView(output.buffer)
  let offset = 0
  for (const entry of prepared) {
    entry.localOffset = offset
    view.setUint32(offset, ZIP_LOCAL, true)
    view.setUint16(offset + 4, 20, true)
    view.setUint16(offset + 6, UTF8_FLAG, true)
    view.setUint16(offset + 8, 0, true)
    view.setUint16(offset + 10, entry.dosTime, true)
    view.setUint16(offset + 12, entry.dosDate, true)
    view.setUint32(offset + 14, entry.crc, true)
    view.setUint32(offset + 18, entry.data.byteLength, true)
    view.setUint32(offset + 22, entry.data.byteLength, true)
    view.setUint16(offset + 26, entry.nameBytes.byteLength, true)
    view.setUint16(offset + 28, 0, true)
    offset += 30
    output.set(entry.nameBytes, offset)
    offset += entry.nameBytes.byteLength
    output.set(entry.data, offset)
    offset += entry.data.byteLength
  }

  const centralOffset = offset
  for (const entry of prepared) {
    view.setUint32(offset, ZIP_CENTRAL, true)
    view.setUint16(offset + 4, 20, true)
    view.setUint16(offset + 6, 20, true)
    view.setUint16(offset + 8, UTF8_FLAG, true)
    view.setUint16(offset + 10, 0, true)
    view.setUint16(offset + 12, entry.dosTime, true)
    view.setUint16(offset + 14, entry.dosDate, true)
    view.setUint32(offset + 16, entry.crc, true)
    view.setUint32(offset + 20, entry.data.byteLength, true)
    view.setUint32(offset + 24, entry.data.byteLength, true)
    view.setUint16(offset + 28, entry.nameBytes.byteLength, true)
    view.setUint16(offset + 30, 0, true)
    view.setUint16(offset + 32, 0, true)
    view.setUint16(offset + 34, 0, true)
    view.setUint16(offset + 36, 0, true)
    view.setUint32(offset + 38, 0, true)
    view.setUint32(offset + 42, entry.localOffset, true)
    offset += 46
    output.set(entry.nameBytes, offset)
    offset += entry.nameBytes.byteLength
  }

  const centralSize = offset - centralOffset
  view.setUint32(offset, ZIP_EOCD, true)
  view.setUint16(offset + 4, 0, true)
  view.setUint16(offset + 6, 0, true)
  view.setUint16(offset + 8, prepared.length, true)
  view.setUint16(offset + 10, prepared.length, true)
  view.setUint32(offset + 12, centralSize, true)
  view.setUint32(offset + 16, centralOffset, true)
  view.setUint16(offset + 20, 0, true)
  return output
}

export async function buildArchive(files, options = {}) {
  const optionValues = getRecord(options, new Set(["createdAt"]), new Set(), "Archive options")
  const createdAt = validateIsoUtc(Object.hasOwn(optionValues, "createdAt") ? optionValues.createdAt : new Date().toISOString(), "createdAt")
  const snapshot = snapshotFiles(files)
  const manifestFiles = []
  for (const file of snapshot) {
    manifestFiles.push({
      path: file.path,
      bytes: file.bytes,
      sha256: await sha256Hex(file.data),
      modifiedAt: file.modifiedAt
    })
  }
  const manifest = { format: "archive-desk", version: 1, createdAt, files: manifestFiles }
  const manifestData = UTF8.encode(JSON.stringify(manifest))
  const entries = [{
    nameBytes: UTF8.encode(MANIFEST_PATH),
    data: manifestData,
    modifiedAt: Date.parse(createdAt)
  }]
  for (const file of snapshot) {
    entries.push({
      nameBytes: UTF8.encode(FILE_PREFIX + file.path),
      data: file.data,
      modifiedAt: file.modifiedAt
    })
  }
  return writeZip(entries)
}

function archiveBytes(value) {
  const bytes = byteSource(value, "Archive")
  if (bytes.byteLength > MAX_ARCHIVE_BYTES) fail("Archive exceeds the supported size limit for this format.")
  return copyBytes(bytes, "Archive")
}

function dataView(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

function checkRange(offset, length, limit, message) {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > limit) {
    fail(message)
  }
}

function decodeZipName(raw, label) {
  let name
  try {
    name = UTF8_FATAL.decode(raw)
  } catch {
    fail(`${label} is not valid UTF-8.`)
  }
  const encoded = encodePath(name, label)
  if (encoded.byteLength !== raw.byteLength) fail(`${label} is not encoded canonically as UTF-8.`)
  for (let index = 0; index < encoded.length; index += 1) {
    if (encoded[index] !== raw[index]) fail(`${label} is not encoded canonically as UTF-8.`)
  }
  return name
}

function validDosDateTime(dateBits, timeBits, label) {
  const year = 1980 + ((dateBits >>> 9) & 0x7f)
  const month = (dateBits >>> 5) & 0x0f
  const day = dateBits & 0x1f
  const hour = (timeBits >>> 11) & 0x1f
  const minute = (timeBits >>> 5) & 0x3f
  const second = (timeBits & 0x1f) * 2
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 58) fail(`${label} has an invalid ZIP timestamp.`)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (day < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    fail(`${label} has an invalid ZIP timestamp.`)
  }
}

function parseZip(bytes) {
  if (bytes.byteLength < 22) fail("Unsupported or invalid ZIP archive: the end record is missing.")
  const view = dataView(bytes)
  const eocdOffset = bytes.byteLength - 22
  if (view.getUint32(eocdOffset, true) !== ZIP_EOCD) {
    fail("Unsupported ZIP archive: comments, trailing data, ZIP64, and nonstandard end records are not supported.")
  }
  if (view.getUint16(eocdOffset + 20, true) !== 0) fail("Unsupported ZIP archive: archive comments are not supported.")
  const disk = view.getUint16(eocdOffset + 4, true)
  const centralDisk = view.getUint16(eocdOffset + 6, true)
  const entriesOnDisk = view.getUint16(eocdOffset + 8, true)
  const entryCount = view.getUint16(eocdOffset + 10, true)
  const centralSize = view.getUint32(eocdOffset + 12, true)
  const centralOffset = view.getUint32(eocdOffset + 16, true)
  if (disk !== 0 || centralDisk !== 0 || entriesOnDisk !== entryCount) fail("Unsupported ZIP archive: split archives are not supported.")
  if (entriesOnDisk === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) fail("Unsupported ZIP archive: ZIP64 is not supported.")
  if (entryCount < 2 || entryCount > LIMITS.maxFiles + 1) fail("Unsupported Archive Desk backup: its file count is outside the supported limits.")
  if (centralOffset + centralSize !== eocdOffset) fail("Invalid ZIP archive: the central directory bounds do not match the end record.")
  checkRange(centralOffset, centralSize, eocdOffset, "Invalid ZIP archive: the central directory is truncated.")

  const entries = []
  let offset = centralOffset
  let previousLocalOffset = -1
  for (let index = 0; index < entryCount; index += 1) {
    checkRange(offset, 46, centralOffset + centralSize, "Invalid ZIP archive: a central directory record is truncated.")
    if (view.getUint32(offset, true) !== ZIP_CENTRAL) fail("Unsupported ZIP archive: an unrecognized central directory record was found.")
    const madeBy = view.getUint16(offset + 4, true)
    const needed = view.getUint16(offset + 6, true)
    const flags = view.getUint16(offset + 8, true)
    const method = view.getUint16(offset + 10, true)
    const timeBits = view.getUint16(offset + 12, true)
    const dateBits = view.getUint16(offset + 14, true)
    const crc = view.getUint32(offset + 16, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const uncompressedSize = view.getUint32(offset + 24, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const startDisk = view.getUint16(offset + 34, true)
    const internalAttributes = view.getUint16(offset + 36, true)
    const externalAttributes = view.getUint32(offset + 38, true)
    const localOffset = view.getUint32(offset + 42, true)
    if (madeBy !== 20 || needed !== 20 || flags !== UTF8_FLAG || method !== 0 || extraLength !== 0 || commentLength !== 0 || startDisk !== 0 || internalAttributes !== 0 || externalAttributes !== 0) {
      fail("Unsupported ZIP archive: only UTF-8, unencrypted ZIP STORE entries without extra fields are supported.")
    }
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) fail("Unsupported ZIP archive: ZIP64 is not supported.")
    if (compressedSize !== uncompressedSize) fail("Unsupported ZIP archive: compressed entries are not supported.")
    if (nameLength === 0) fail("Invalid ZIP archive: an entry has an empty filename.")
    validDosDateTime(dateBits, timeBits, "Central directory entry")
    checkRange(offset + 46, nameLength, centralOffset + centralSize, "Invalid ZIP archive: a central filename is truncated.")
    const rawName = bytes.subarray(offset + 46, offset + 46 + nameLength)
    const name = decodeZipName(rawName, "ZIP filename")
    if (localOffset <= previousLocalOffset) fail("Invalid ZIP archive: local records are out of order.")
    previousLocalOffset = localOffset
    entries.push({ name, rawName, crc, size: uncompressedSize, localOffset, timeBits, dateBits })
    offset += 46 + nameLength
  }
  if (offset !== centralOffset + centralSize) fail("Invalid ZIP archive: the central directory size does not match its records.")
  assertUniquePaths(entries, entry => entry.name, "ZIP archive")

  let expectedLocalOffset = 0
  for (const entry of entries) {
    const local = entry.localOffset
    checkRange(local, 30, centralOffset, "Invalid ZIP archive: a local file header is truncated or outside the data area.")
    if (view.getUint32(local, true) !== ZIP_LOCAL) fail("Unsupported ZIP archive: a local file record is missing.")
    const needed = view.getUint16(local + 4, true)
    const flags = view.getUint16(local + 6, true)
    const method = view.getUint16(local + 8, true)
    const timeBits = view.getUint16(local + 10, true)
    const dateBits = view.getUint16(local + 12, true)
    const crc = view.getUint32(local + 14, true)
    const compressedSize = view.getUint32(local + 18, true)
    const uncompressedSize = view.getUint32(local + 22, true)
    const nameLength = view.getUint16(local + 26, true)
    const extraLength = view.getUint16(local + 28, true)
    if (needed !== 20 || flags !== UTF8_FLAG || method !== 0 || extraLength !== 0) fail("Unsupported ZIP archive: local records use unsupported flags, compression, or extra fields.")
    if (compressedSize !== entry.size || uncompressedSize !== entry.size || crc !== entry.crc || timeBits !== entry.timeBits || dateBits !== entry.dateBits) {
      fail("Invalid ZIP archive: local and central file records do not match.")
    }
    validDosDateTime(dateBits, timeBits, "Local file entry")
    if (nameLength !== entry.rawName.byteLength) fail("Invalid ZIP archive: local and central filenames do not match.")
    checkRange(local + 30, nameLength, centralOffset, "Invalid ZIP archive: a local filename is truncated.")
    const localName = bytes.subarray(local + 30, local + 30 + nameLength)
    for (let index = 0; index < nameLength; index += 1) {
      if (localName[index] !== entry.rawName[index]) fail("Invalid ZIP archive: local and central filenames do not match.")
    }
    const dataStart = local + 30 + nameLength
    const dataEnd = dataStart + entry.size
    checkRange(dataStart, entry.size, centralOffset, "Invalid ZIP archive: file data is truncated or overlaps the central directory.")
    if (local !== expectedLocalOffset) fail("Invalid ZIP archive: local records overlap or contain unrecognized gaps.")
    entry.dataStart = dataStart
    entry.dataEnd = dataEnd
    expectedLocalOffset = dataEnd
  }
  if (expectedLocalOffset !== centralOffset) fail("Invalid ZIP archive: local records do not end at the central directory.")
  return { entries, view }
}

function assertExactKeys(value, expected, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object.`)
  const actual = Object.keys(value)
  if (actual.length !== expected.length || expected.some(key => !Object.hasOwn(value, key))) {
    fail(`${label} contains missing or unsupported fields.`)
  }
}

function parseJsonWithoutDuplicateKeys(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    fail("Backup manifest is not valid UTF-8 JSON.")
  }
  let index = 0
  const skipWhitespace = () => {
    while (index < text.length && /[\u0009\u000a\u000d\u0020]/u.test(text[index])) index += 1
  }
  const readString = () => {
    const start = index
    index += 1
    while (index < text.length) {
      const char = text[index]
      if (char === "\\") {
        index += 2
      } else if (char === '"') {
        index += 1
        return JSON.parse(text.slice(start, index))
      } else {
        index += 1
      }
    }
    fail("Backup manifest is not valid UTF-8 JSON.")
  }
  const scanValue = () => {
    skipWhitespace()
    if (text[index] === "{") {
      index += 1
      skipWhitespace()
      const keys = new Set()
      if (text[index] === "}") {
        index += 1
        return
      }
      while (index < text.length) {
        skipWhitespace()
        const key = readString()
        if (keys.has(key)) fail("Backup manifest contains a duplicate JSON field.")
        keys.add(key)
        skipWhitespace()
        index += 1
        scanValue()
        skipWhitespace()
        if (text[index] === "}") {
          index += 1
          return
        }
        index += 1
      }
      fail("Backup manifest is not valid UTF-8 JSON.")
    }
    if (text[index] === "[") {
      index += 1
      skipWhitespace()
      if (text[index] === "]") {
        index += 1
        return
      }
      while (index < text.length) {
        scanValue()
        skipWhitespace()
        if (text[index] === "]") {
          index += 1
          return
        }
        index += 1
      }
      fail("Backup manifest is not valid UTF-8 JSON.")
    }
    if (text[index] === '"') {
      readString()
      return
    }
    while (index < text.length && !/[\u0009\u000a\u000d\u0020,\]}]/u.test(text[index])) index += 1
  }
  scanValue()
  skipWhitespace()
  if (index !== text.length) fail("Backup manifest is not valid UTF-8 JSON.")
  return parsed
}

function validateManifest(value) {
  assertExactKeys(value, ["format", "version", "createdAt", "files"], "Backup manifest")
  if (value.format !== "archive-desk" || value.version !== 1) fail("Unsupported Archive Desk backup format or version.")
  validateIsoUtc(value.createdAt, "Backup manifest createdAt")
  if (!Array.isArray(value.files) || value.files.length === 0 || value.files.length > LIMITS.maxFiles) {
    fail("Backup manifest file count is outside the supported limits.")
  }
  let total = 0
  const files = value.files.map((file, index) => {
    assertExactKeys(file, ["path", "bytes", "sha256", "modifiedAt"], `Backup manifest file ${index + 1}`)
    const pathBytes = encodePath(file.path, `Backup manifest file ${index + 1} path`, MAX_PATH_BYTES)
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 0 || file.bytes > LIMITS.maxFileBytes) {
      fail(`Backup manifest file ${file.path} has a size outside the supported limits.`)
    }
    if (typeof file.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(file.sha256)) {
      fail(`Backup manifest file ${file.path} has an invalid SHA-256 value.`)
    }
    validateModifiedAt(file.modifiedAt, `Backup manifest file ${file.path} modifiedAt`)
    total += file.bytes
    if (total > LIMITS.maxTotalBytes) fail("Backup manifest exceeds the total file size limit.")
    return { path: file.path, pathBytes, bytes: file.bytes, sha256: file.sha256, modifiedAt: file.modifiedAt }
  })
  assertUniquePaths(files, file => file.path, "Backup manifest")
  return files
}

function bytesEqual(left, right) {
  if (left.byteLength !== right.byteLength) return false
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export async function verifyArchive(input) {
  const bytes = archiveBytes(input)
  const { entries } = parseZip(bytes)
  const manifestEntries = entries.filter(entry => entry.name === MANIFEST_PATH)
  if (manifestEntries.length !== 1) fail(`Unsupported Archive Desk backup: it must contain exactly one ${MANIFEST_PATH}.`)
  const manifestEntry = manifestEntries[0]
  if (manifestEntry.size > 1024 * 1024) {
    fail("Backup manifest exceeds the supported size limit.")
  }
  const manifestData = bytes.subarray(manifestEntry.dataStart, manifestEntry.dataEnd)
  if (crc32(manifestData) !== manifestEntry.crc) fail("Backup manifest failed its ZIP CRC check.")
  let manifestText
  try {
    manifestText = UTF8_FATAL.decode(manifestData)
  } catch {
    fail("Backup manifest is not valid UTF-8 JSON.")
  }
  const manifest = parseJsonWithoutDuplicateKeys(manifestText)
  const files = validateManifest(manifest)
  if (entries.length !== files.length + 1) fail("Archive Desk backup contains unexpected or missing files.")

  const archiveByPath = new Map(entries.map(entry => [entry.name, entry]))
  const expectedNames = new Set([MANIFEST_PATH])
  const verified = []
  for (const file of files) {
    const archivePath = FILE_PREFIX + file.path
    if (expectedNames.has(archivePath)) fail("Backup manifest paths collide with an Archive Desk product file.")
    expectedNames.add(archivePath)
    const entry = archiveByPath.get(archivePath)
    if (!entry) fail(`Backup is missing file data for ${file.path}.`)
    if (entry.size !== file.bytes) fail(`Backup file size does not match its manifest for ${file.path}.`)
    const data = bytes.subarray(entry.dataStart, entry.dataEnd)
    if (crc32(data) !== entry.crc) fail(`Backup file ${file.path} failed its ZIP CRC check.`)
    const sha256 = await sha256Hex(data)
    if (sha256 !== file.sha256) fail(`Backup file ${file.path} failed its SHA-256 check.`)
    verified.push({ file, data, sha256 })
  }
  for (const entry of entries) {
    if (!expectedNames.has(entry.name)) fail(`Archive Desk backup contains an unexpected file: ${entry.name}.`)
  }

  return {
    manifest,
    files: verified.map(({ file, data, sha256 }) => ({
      path: file.path,
      data: copyBytes(data, `Backup file ${file.path}`),
      bytes: file.bytes,
      sha256,
      modifiedAt: file.modifiedAt
    }))
  }
}

export async function compareArchiveToFiles(bytes, files) {
  const before = await verifyArchive(bytes)
  const after = snapshotFiles(files)
  const afterWithHashes = []
  for (const file of after) afterWithHashes.push({ ...file, sha256: await sha256Hex(file.data) })
  const beforeByPath = new Map(before.files.map(file => [file.path, file]))
  const afterByPath = new Map(afterWithHashes.map(file => [file.path, file]))
  const paths = Array.from(new Set([...beforeByPath.keys(), ...afterByPath.keys()]))
    .sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
  const counts = { added: 0, removed: 0, changed: 0, unchanged: 0 }
  const rows = paths.map(path => {
    const oldFile = beforeByPath.get(path)
    const newFile = afterByPath.get(path)
    let status
    if (!oldFile) status = "added"
    else if (!newFile) status = "removed"
    else if (oldFile.bytes !== newFile.bytes || oldFile.sha256 !== newFile.sha256) status = "changed"
    else status = "unchanged"
    counts[status] += 1
    return {
      path,
      status,
      beforeBytes: oldFile ? oldFile.bytes : null,
      afterBytes: newFile ? newFile.bytes : null
    }
  })
  return { rows, counts }
}

export async function createRecoveryZip(bytes) {
  const verified = await verifyArchive(bytes)
  const entries = verified.files.map(file => ({
    nameBytes: encodePath(file.path, `Recovery file ${file.path}`),
    data: file.data,
    modifiedAt: file.modifiedAt
  }))
  return writeZip(entries)
}

export function formatBytes(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    fail("Byte count must be a finite non-negative number.")
  }
  if (value < 1024) return `${Math.round(value)} B`
  const units = ["KiB", "MiB", "GiB", "TiB", "PiB"]
  let amount = value
  let unit = -1
  do {
    amount /= 1024
    unit += 1
  } while (amount >= 1024 && unit < units.length - 1)
  return `${amount.toFixed(1)} ${units[unit]}`
}
