// Browser port of sop_to_work_instruction.py 1.0.0 (parse_docx and serialize_outputs).
// Same checks in the same order, same error codes and messages, same JSON and CSV bytes.
// Needs DOMParser and crypto.subtle, so it runs in a browser.
export const PARSER_VERSION = "1.0.0";
export const SCHEMA_VERSION = "work-instruction-preview/1";
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_MEMBER_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 16 * 1024 * 1024;
const MAX_MEMBER_COUNT = 256;
const MAX_COMPRESSION_RATIO = 250;
const MAX_CONTENT_TYPES_BYTES = 256 * 1024;
const MAX_ROOT_RELS_BYTES = 128 * 1024;
const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types";
const MAIN_DOCUMENT_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";

export class WorkInstructionError extends Error {
  constructor(code, message, paragraph) { super(message); this.code = code; this.message = message; this.paragraph = paragraph; }
}
// Something the Python tool does not catch, so it would stop with a traceback instead of an ERROR line.
export class Uncaught extends Error { constructor(kind) { super(kind); this.kind = kind; } }
const E = (code, message, paragraph) => new WorkInstructionError(code, message, paragraph);

// Python str.isspace() characters, used by strip(), lstrip() and \s.
const PY_WS = "\\t\\n\\v\\f\\r\\x1c-\\x20\\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const STRIP = new RegExp(`^[${PY_WS}]+|[${PY_WS}]+$`, "g");
const LSTRIP = new RegExp(`^[${PY_WS}]+`);
const pyStrip = s => s.replace(STRIP, "");
const STEP = new RegExp(`^Step[${PY_WS}]+([0-9]+):`);

// ---------- CRC32 and a small raw inflate with an output cap, like zlib under ZipExtFile ----------
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(bytes) { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CLORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
function huff(lengths) {
  const counts = new Uint16Array(16), symbols = new Uint16Array(lengths.length), offs = new Uint16Array(16);
  for (const l of lengths) counts[l]++;
  counts[0] = 0;
  for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + counts[i - 1];
  for (let s = 0; s < lengths.length; s++) if (lengths[s]) symbols[offs[lengths[s]]++] = s;
  return { counts, symbols };
}
const EOF = Symbol("eof");
export function inflateRaw(src, cap) {
  let pos = 0, bit = 0, bits = 0;
  const out = [];
  const need = n => { while (bits < n) { if (pos >= src.length) throw EOF; bit |= src[pos++] << bits; bits += 8; } };
  const get = n => { if (!n) return 0; need(n); const v = bit & ((1 << n) - 1); bit >>>= n; bits -= n; return v; };
  const decode = h => { let code = 0, first = 0, index = 0; for (let len = 1; len < 16; len++) { code |= get(1); const c = h.counts[len]; if (code - c < first) return h.symbols[index + (code - first)]; index += c; first += c; first <<= 1; code <<= 1; } throw new Error("invalid code"); };
  const full = () => out.length >= cap;
  let fixedL, fixedD;
  try {
    for (;;) {
      if (full()) return { out: Uint8Array.from(out.slice(0, cap)), ended: false, capped: true };
      const last = get(1), type = get(2);
      if (type === 0) {
        bit = 0; bits = 0;
        if (pos + 4 > src.length) throw EOF;
        const len = src[pos] | src[pos + 1] << 8, nlen = src[pos + 2] | src[pos + 3] << 8; pos += 4;
        if ((len ^ 0xffff) !== nlen) throw new Error("invalid stored block lengths");
        for (let i = 0; i < len; i++) { if (pos >= src.length) throw EOF; out.push(src[pos++]); if (full()) return { out: Uint8Array.from(out.slice(0, cap)), ended: false, capped: true }; }
      } else if (type === 1 || type === 2) {
        let L, D;
        if (type === 1) {
          if (!fixedL) { const l = new Uint8Array(288); l.fill(8, 0, 144); l.fill(9, 144, 256); l.fill(7, 256, 280); l.fill(8, 280, 288); fixedL = huff(l); fixedD = huff(new Uint8Array(30).fill(5)); }
          L = fixedL; D = fixedD;
        } else {
          const hlit = get(5) + 257, hdist = get(5) + 1, hclen = get(4) + 4;
          if (hlit > 286 || hdist > 30) throw new Error("too many length or distance symbols");
          const cl = new Uint8Array(19); for (let i = 0; i < hclen; i++) cl[CLORDER[i]] = get(3);
          const ch = huff(cl), lens = new Uint8Array(hlit + hdist);
          for (let i = 0; i < hlit + hdist;) {
            const sym = decode(ch);
            if (sym < 16) lens[i++] = sym;
            else { let rep, val = 0; if (sym === 16) { if (!i) throw new Error("invalid bit length repeat"); val = lens[i - 1]; rep = 3 + get(2); } else if (sym === 17) rep = 3 + get(3); else rep = 11 + get(7); if (i + rep > hlit + hdist) throw new Error("invalid bit length repeat"); while (rep--) lens[i++] = val; }
          }
          L = huff(lens.subarray(0, hlit)); D = huff(lens.subarray(hlit));
        }
        for (;;) {
          const sym = decode(L);
          if (sym < 256) { out.push(sym); if (full()) return { out: Uint8Array.from(out.slice(0, cap)), ended: false, capped: true }; }
          else if (sym === 256) break;
          else {
            const li = sym - 257; if (li >= 29) throw new Error("invalid literal/length code");
            const len = LBASE[li] + get(LEXT[li]);
            const di = decode(D); if (di >= 30) throw new Error("invalid distance code");
            const dist = DBASE[di] + get(DEXT[di]);
            if (dist > out.length) throw new Error("invalid distance too far back");
            for (let k = 0; k < len; k++) { out.push(out[out.length - dist]); if (full()) return { out: Uint8Array.from(out.slice(0, cap)), ended: false, capped: true }; }
          }
        }
      } else throw new Error("invalid block type");
      if (last) return { out: Uint8Array.from(out), ended: true };
    }
  } catch (e) {
    if (e === EOF) return { out: Uint8Array.from(out), ended: false, truncated: true };
    throw new Uncaught("zlib.error: " + e.message);
  }
}

// ---------- ZIP reading with Python zipfile's rules ----------
const CP437 = "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";
function decodeName(bytes, utf8) {
  if (utf8) { try { return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); } catch { throw new Uncaught("UnicodeDecodeError"); } }
  let s = ""; for (const b of bytes) s += b < 128 ? String.fromCharCode(b) : CP437[b - 128]; return s;
}
const u16 = (d, o) => d[o] | d[o + 1] << 8;
const u32 = (d, o) => (d[o] | d[o + 1] << 8 | d[o + 2] << 16 | d[o + 3] << 24) >>> 0;
const sig = (d, o, s) => o >= 0 && o + 4 <= d.length && u32(d, o) === s;
class BadZip extends Error {}

function openZip(data) {
  // _EndRecData: the last 22 bytes first, then the last signature within the comment window.
  let eocd = -1, endLoc;
  if (data.length >= 22 && sig(data, data.length - 22, 0x06054b50) && data[data.length - 2] === 0 && data[data.length - 1] === 0) eocd = data.length - 22;
  else {
    const start = Math.max(data.length - 65536 - 22, 0);
    for (let i = data.length - 4; i >= start; i--) if (sig(data, i, 0x06054b50)) { eocd = i; break; }
    if (eocd >= 0 && eocd + 22 > data.length) eocd = -1;
  }
  if (eocd < 0) throw new BadZip("File is not a zip file");
  endLoc = eocd;
  if (sig(data, eocd - 20, 0x07064b50)) throw new Uncaught("zip64 archive, not modelled here");
  const sizeCd = u32(data, eocd + 12), offsetCd = u32(data, eocd + 16);
  const concat = endLoc - sizeCd - offsetCd;
  const startDir = offsetCd + concat;
  if (startDir < 0) throw new BadZip("Bad offset for central directory");
  const cd = data.subarray(startDir, startDir + sizeCd);
  const infos = [];
  let p = 0, total = 0;
  while (total < sizeCd) {
    if (p + 46 > cd.length) throw new BadZip("Truncated central directory");
    if (u32(cd, p) !== 0x02014b50) throw new BadZip("Bad magic number for central directory");
    const flag = u16(cd, p + 8), method = u16(cd, p + 10), crc = u32(cd, p + 16), csize = u32(cd, p + 20), usize = u32(cd, p + 24);
    const nlen = u16(cd, p + 28), xlen = u16(cd, p + 30), clen = u16(cd, p + 32), hoff = u32(cd, p + 42), extractVersion = cd[p + 6];
    const nameBytes = cd.subarray(p + 46, p + 46 + nlen);
    const orig = decodeName(nameBytes, flag & 0x800);
    const extra = cd.subarray(p + 46 + nlen, p + 46 + nlen + xlen);
    if (extractVersion > 63) throw new Uncaught("NotImplementedError: zip file version");
    for (let e = 0; e + 4 <= extra.length;) { const ln = u16(extra, e + 2); if (ln + 4 > extra.length - e) throw new BadZip("Corrupt extra field"); if (u16(extra, e) === 1) throw new Uncaught("zip64 extra field, not modelled here"); e += ln + 4; }
    const nul = orig.indexOf("\0");
    const filename = nul >= 0 ? orig.slice(0, nul) : orig;
    infos.push({ filename, orig, flag, method, crc, csize, usize, hoff: hoff + concat, isDir: filename.endsWith("/") });
    p += 46 + nlen + xlen + clen;
    total += 46 + nlen + xlen + clen;
  }
  // Python 3.12 marks where each entry must end, to refuse overlapping entries.
  let end = startDir;
  for (const info of [...infos].sort((a, b) => b.hoff - a.hoff)) { info.end = end; end = info.hoff; }
  return infos;
}

function validateArchive(infos) {
  if (infos.length > MAX_MEMBER_COUNT) throw E("ZIP_MEMBER_COUNT_LIMIT", "DOCX archive has too many members.");
  const parts = new Map();
  let total = 0;
  for (const info of infos) {
    const name = info.filename;
    if (parts.has(name)) throw E("ZIP_DUPLICATE_MEMBER", `DOCX archive repeats a member: ${name}.`);
    const clean = name.replace(/\/+$/, "");
    const pieces = clean.split("/");
    if (!clean || name.startsWith("/") || name.includes("\\") || name.includes(":") || pieces.some(x => x === "" || x === "." || x === "..")) throw E("ZIP_UNSAFE_MEMBER", "DOCX archive contains an unsafe member name.");
    if (info.flag & 0x1) throw E("ZIP_ENCRYPTED_MEMBER", `DOCX archive has an encrypted member: ${name}.`);
    if (info.method !== 0 && info.method !== 8) throw E("ZIP_UNSUPPORTED_COMPRESSION", `DOCX archive uses unsupported compression: ${name}.`);
    if (info.usize > MAX_MEMBER_BYTES) throw E("ZIP_MEMBER_LIMIT", `DOCX archive member exceeds the size limit: ${name}.`);
    total += info.usize;
    if (total > MAX_TOTAL_UNCOMPRESSED_BYTES) throw E("ZIP_TOTAL_SIZE_LIMIT", "DOCX archive exceeds the total uncompressed size limit.");
    if (info.usize) {
      if (!info.csize) throw E("ZIP_COMPRESSION_RATIO_LIMIT", `DOCX archive member has an unsafe compression ratio: ${name}.`);
      if (info.usize / info.csize > MAX_COMPRESSION_RATIO) throw E("ZIP_COMPRESSION_RATIO_LIMIT", `DOCX archive member has an unsafe compression ratio: ${name}.`);
    }
    if (!info.isDir) parts.set(name, info);
  }
  return parts;
}

function readMember(data, info) {
  // ZipFile.open then ZipExtFile.read: BadZipFile, EOFError and NotImplementedError all become ZIP_MEMBER_READ_FAILED.
  const h = info.hoff;
  if (h < 0 || h + 30 > data.length) throw new BadZip("Truncated file header");
  if (u32(data, h) !== 0x04034b50) throw new BadZip("Bad magic number for file header");
  const nlen = u16(data, h + 26), xlen = u16(data, h + 28), lflag = u16(data, h + 6);
  if (info.flag & 0x20 || info.flag & 0x40) throw new BadZip("NotImplementedError");
  const fname = decodeName(data.subarray(h + 30, h + 30 + nlen), lflag & 0x800);
  if (fname !== info.orig) throw new BadZip("File name in directory and header differ");
  const start = h + 30 + nlen + xlen;
  if (start + info.csize > info.end) throw new BadZip("Overlapped entries");
  const avail = data.subarray(Math.min(start, data.length), Math.min(start + info.csize, data.length));
  const truncated = avail.length < info.csize;
  let out;
  if (info.method === 0) {
    out = avail.subarray(0, info.usize);
    if (out.length < info.usize && truncated) throw new BadZip("EOFError");
  } else {
    const r = inflateRaw(avail, info.usize);
    out = r.out;
    if (!r.capped && !r.ended && truncated && out.length < info.usize) throw new BadZip("EOFError");
  }
  if (crc32(out) !== info.crc) throw new BadZip("Bad CRC-32");
  return out;
}

function readPart(data, parts, name, limit) {
  const info = parts.get(name);
  if (!info) throw E("DOCX_MISSING_PART", `Required DOCX part is missing: ${name}.`);
  if (info.usize > limit) throw E("ZIP_MEMBER_LIMIT", `DOCX part exceeds its size limit: ${name}.`);
  let bytes;
  try { bytes = readMember(data, info); } catch (e) { if (e instanceof BadZip) throw E("ZIP_MEMBER_READ_FAILED", `Could not read DOCX part: ${name}.`); throw e; }
  if (bytes.length > limit) throw E("ZIP_MEMBER_LIMIT", `DOCX part exceeds its size limit: ${name}.`);
  if (bytes.length !== info.usize) throw E("ZIP_SIZE_MISMATCH", `DOCX part has an inconsistent size: ${name}.`);
  return bytes;
}

// ---------- XML ----------
const UNSAFE = new RegExp(`<![${PY_WS}]*(?:[Dd][Oo][Cc][Tt][Yy][Pp][Ee]|[Ee][Nn][Tt][IiıİI][Tt][Yy])(?![\\p{L}\\p{N}_])`, "u");
function xmlRoot(part, data, ns, local) {
  const b = data;
  const starts = (...s) => s.every((x, i) => b[i] === x);
  if (starts(0xff, 0xfe) || starts(0xfe, 0xff) || starts(0, 0, 0xfe, 0xff) || starts(0xff, 0xfe, 0, 0)) throw E("XML_UNSUPPORTED_ENCODING", `${part} must use UTF-8 XML for this preview.`);
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(data); } catch { throw E("XML_UNSUPPORTED_ENCODING", `${part} is not valid UTF-8 XML.`); }
  if (UNSAFE.test(text)) throw E("XML_UNSAFE_DECLARATION", `${part} contains a DTD or entity declaration.`);
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const bad = doc.getElementsByTagNameNS("http://www.w3.org/1999/xhtml", "parsererror").length || doc.getElementsByTagNameNS("http://www.mozilla.org/newlayout/xml/parsererror.xml", "parsererror").length || doc.getElementsByTagName("parsererror").length;
  if (bad || !doc.documentElement) throw E("XML_MALFORMED", `${part} is not well-formed XML.`);
  const root = doc.documentElement;
  if (root.namespaceURI !== ns || root.localName !== local) throw E("DOCX_PART_ROOT", `${part} has an unexpected root element.`);
  return root;
}
const attr = (el, name, dflt = null) => el.hasAttributeNS(null, name) ? el.getAttributeNS(null, name) : dflt;
const isW = (el, local) => el.namespaceURI === WORD_NS && el.localName === local;
const kids = el => [...el.children];
const anyW = (root, ...locals) => locals.some(l => root.getElementsByTagNameNS(WORD_NS, l).length > 0 || isW(root, l));

// ElementTree .text: character data before the first child element, comments and PIs dropped.
function etText(el) {
  let s = "";
  for (const n of el.childNodes) { if (n.nodeType === 1) break; if (n.nodeType === 3 || n.nodeType === 4) s += n.data; }
  return s;
}
function paragraphText(p) {
  const pieces = [];
  const visit = el => {
    if (isW(el, "pPr") || isW(el, "rPr")) return;
    if (isW(el, "t")) { pieces.push(etText(el)); return; }
    if (isW(el, "tab")) { pieces.push("\t"); return; }
    if (isW(el, "br") || isW(el, "cr")) {
      const type = el.hasAttributeNS(WORD_NS, "type") ? el.getAttributeNS(WORD_NS, "type") : "textWrapping";
      if (type !== "textWrapping") throw E("UNSUPPORTED_BREAK_TYPE", "Only ordinary line breaks are supported inside a paragraph.");
      pieces.push("\n"); return;
    }
    for (const c of kids(el)) visit(c);
  };
  visit(p);
  return pyStrip(pieces.join("").replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
}

function checkUnsupportedContent(doc, parts) {
  if (anyW(doc, "tbl")) throw E("UNSUPPORTED_TABLE", "Tables are not supported by this preview.");
  if (anyW(doc, "drawing", "pict", "object", "txbxContent") || [...parts.keys()].some(n => n.startsWith("word/media/"))) throw E("UNSUPPORTED_IMAGE", "Images and drawing content are not supported by this preview.");
  if (anyW(doc, "numPr") || parts.has("word/numbering.xml")) throw E("UNSUPPORTED_NUMBERING", "Word numbering and list formatting are not supported by this preview.");
  if (anyW(doc, "hyperlink", "altChunk", "fldSimple", "fldChar", "instrText", "footnoteReference", "endnoteReference", "commentReference", "commentRangeStart", "commentRangeEnd", "del", "ins", "moveFrom", "moveTo", "sdt", "customXml", "sym")) throw E("UNSUPPORTED_WORD_CONTENT", "Fields, tracked changes, comments, links, symbols, and content controls are not supported.");
  if (anyW(doc, "vanish")) throw E("UNSUPPORTED_HIDDEN_TEXT", "Hidden text is not supported by this preview.");
}
function checkPackageParts(parts) {
  for (const name of parts.keys()) {
    const lowered = name.toLowerCase(), last = lowered.split("/").pop();
    if (lowered.startsWith("word/embeddings/") || lowered.startsWith("word/activex/") || last.includes("vbaproject") || last === "vbadata.xml" || lowered.startsWith("customui/")) throw E("UNSUPPORTED_PACKAGE_CONTENT", "Macro, ActiveX, and embedded package content are not supported.");
  }
}

async function sha256hex(bytes) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(b => b.toString(16).padStart(2, "0")).join(""); }

// Returns { parsed } on success. On refusal throws WorkInstructionError. info.paragraphs is filled
// as soon as the body has been read, so the page can show the source even when the template is refused.
export async function parseDocx(bytes, info = {}) {
  if (bytes.length > MAX_INPUT_BYTES) throw E("INPUT_SIZE_LIMIT", "Source DOCX exceeds the 8 MiB input limit.");
  const sourceHash = await sha256hex(bytes);
  let infos;
  try { infos = openZip(bytes); } catch (e) { if (e instanceof BadZip) throw E("ZIP_INVALID", "Source file is not a valid DOCX ZIP archive."); throw e; }
  const parts = validateArchive(infos);
  checkPackageParts(parts);
  const ctBytes = readPart(bytes, parts, "[Content_Types].xml", MAX_CONTENT_TYPES_BYTES);
  const relBytes = readPart(bytes, parts, "_rels/.rels", MAX_ROOT_RELS_BYTES);
  const docBytes = readPart(bytes, parts, "word/document.xml", MAX_MEMBER_BYTES);
  const ct = xmlRoot("[Content_Types].xml", ctBytes, CT_NS, "Types");
  const overrides = kids(ct).filter(el => el.namespaceURI === CT_NS && el.localName === "Override" && attr(el, "PartName") === "/word/document.xml");
  const packageTypes = kids(ct).map(el => attr(el, "ContentType", "").toLowerCase());
  if (packageTypes.some(t => t.includes("macroenabled") || t.includes("vbaproject"))) throw E("UNSUPPORTED_PACKAGE_CONTENT", "Macro-enabled documents are not supported by this preview.");
  if (!overrides.some(el => attr(el, "ContentType") === MAIN_DOCUMENT_CONTENT_TYPE)) throw E("DOCX_CONTENT_TYPE", "DOCX does not declare a Word main document part.");
  const rels = xmlRoot("_rels/.rels", relBytes, REL_NS, "Relationships");
  const office = kids(rels).filter(el => el.namespaceURI === REL_NS && el.localName === "Relationship" && attr(el, "Type", "").endsWith("/officeDocument"));
  if (office.length !== 1) throw E("DOCX_ROOT_RELATIONSHIP", "DOCX must contain one main document relationship.");
  const target = attr(office[0], "Target", "").replace(/^\/+/, "");
  if (attr(office[0], "TargetMode") === "External" || target !== "word/document.xml") throw E("DOCX_ROOT_RELATIONSHIP", "DOCX main document relationship has an unsupported target.");
  const document = xmlRoot("word/document.xml", docBytes, WORD_NS, "document");

  checkUnsupportedContent(document, parts);
  const body = kids(document).find(el => isW(el, "body"));
  if (!body) throw E("DOCX_BODY_MISSING", "DOCX main document has no body element.");
  for (const el of kids(body)) if (!isW(el, "p") && !isW(el, "sectPr")) throw E("UNSUPPORTED_BODY_CONTENT", "Only main body paragraphs are supported by this preview.");

  const paragraphs = [];
  let n = 0;
  for (const el of kids(body)) if (isW(el, "p")) { n++; paragraphs.push([n, paragraphText(el)]); }
  info.paragraphs = paragraphs;

  let title = null, safety = null, stepsStarted = false;
  const steps = [], seen = new Set();
  for (const [index, text] of paragraphs) {
    if (!text) continue;
    if (text.startsWith("Work Instruction:")) {
      if (title !== null) throw E("TEMPLATE_DUPLICATE_LABEL", "Template repeats the Work Instruction title label.", index);
      if (safety !== null || stepsStarted) throw E("TEMPLATE_AMBIGUOUS_CONTENT", "Work Instruction title must be the first labeled paragraph.", index);
      const value = pyStrip(text.slice("Work Instruction:".length));
      if (!value) throw E("TEMPLATE_EMPTY_TITLE", "Work Instruction title is empty.", index);
      if (value.includes("\n")) throw E("TEMPLATE_MULTILINE_TITLE", "Work Instruction title must fit on one line.", index);
      title = { source_paragraph_index: index, text: value };
      continue;
    }
    if (title === null) throw E("TEMPLATE_MISSING_TITLE", "First non-empty paragraph must start with Work Instruction:.", index);
    if (text.startsWith("Safety Notes:")) {
      if (safety !== null) throw E("TEMPLATE_DUPLICATE_LABEL", "Template repeats the Safety Notes label.", index);
      if (stepsStarted) throw E("TEMPLATE_AMBIGUOUS_CONTENT", "Safety Notes must appear before the first step.", index);
      const value = pyStrip(text.slice("Safety Notes:".length));
      if (!value) throw E("TEMPLATE_EMPTY_SAFETY_NOTES", "Safety Notes label has no text.", index);
      safety = { source_paragraph_index: index, text: value };
      continue;
    }
    const m = STEP.exec(text);
    if (m) {
      stepsStarted = true;
      const digits = m[1];
      if (digits.length > 9) throw E("TEMPLATE_STEP_NUMBER_LIMIT", "Step number labels may contain at most nine digits.", index);
      const number = Number(digits);
      if (seen.has(number)) throw E("TEMPLATE_DUPLICATE_LABEL", `Template repeats Step ${number}.`, index);
      if (number < 1) throw E("TEMPLATE_STEP_SEQUENCE", "Step numbers must start at 1.", index);
      const value = pyStrip(text.slice(m[0].length));
      if (!value || !value.split("\n").some(l => pyStrip(l))) throw E("TEMPLATE_EMPTY_STEP", `Step ${number} has no instruction text.`, index);
      seen.add(number);
      steps.push({ source_paragraph_index: index, step_number: number, text: value });
      continue;
    }
    throw E("TEMPLATE_AMBIGUOUS_CONTENT", `Paragraph ${index} is not a supported title, safety note, or Step N: heading.`, index);
  }
  if (title === null) throw E("TEMPLATE_MISSING_TITLE", "Template has no Work Instruction title heading.");
  if (!steps.length) throw E("TEMPLATE_NO_STEPS", "Template has no Step N: instruction headings.");
  steps.forEach((s, i) => { if (s.step_number !== i + 1) throw E("TEMPLATE_STEP_SEQUENCE", `Expected Step ${i + 1}, found Step ${s.step_number}.`, s.source_paragraph_index); });
  return { parser_version: PARSER_VERSION, source_sha256: sourceHash, source_size_bytes: bytes.length, title, safety_notes: safety, steps };
}

// ---------- outputs ----------
const csvSafe = v => /^[=+\-@]/.test(v.replace(LSTRIP, "")) ? "'" + v : v;
const csvField = v => { const s = String(v); return /[,"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csvRow = r => r.map(csvField).join(",") + "\n";
const baseName = s => s.split(/[\\/]/).pop();
export function serializeOutputs(parsed, sourceName) {
  const preview = {
    parser_version: parsed.parser_version,
    safety_notes: parsed.safety_notes,
    schema_version: SCHEMA_VERSION,
    source: { filename: baseName(sourceName), paragraph_indexing: "One-based paragraphs in the main document body, including blank paragraphs.", sha256: parsed.source_sha256, size_bytes: parsed.source_size_bytes },
    steps: parsed.steps,
    title: parsed.title,
  };
  const json = JSON.stringify(preview, null, 2) + "\n";
  let csv = csvRow(["record_type", "step_number", "text", "source_paragraph_index", "source_sha256"]);
  csv += csvRow(["title", "", csvSafe(parsed.title.text), parsed.title.source_paragraph_index, parsed.source_sha256]);
  if (parsed.safety_notes) csv += csvRow(["safety_notes", "", csvSafe(parsed.safety_notes.text), parsed.safety_notes.source_paragraph_index, parsed.source_sha256]);
  for (const s of parsed.steps) csv += csvRow(["step", s.step_number, csvSafe(s.text), s.source_paragraph_index, parsed.source_sha256]);
  return { json, csv };
}
export const stdoutLine = parsed => `Created JSON and CSV previews for ${parsed.steps.length} steps. Source SHA-256: ${parsed.source_sha256}`;
export const stderrLine = e => `ERROR[${e.code}]: ${e.message}`;

// ---------- building a DOCX from editor blocks, same XML as tests/fixture_factory.py, stored not deflated ----------
const CONTENT_TYPES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n  <Default Extension="xml" ContentType="application/xml"/>\n  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>\n</Types>';
const ROOT_RELS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>\n</Relationships>';
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const INSERTS = {
  list: { label: "Word list", pre: '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>' },
  tracked: { label: "Tracked change", post: '<w:ins w:id="1" w:author="Reviewer" w:date="2026-10-19T00:00:00Z"><w:r><w:t xml:space="preserve"> checked</w:t></w:r></w:ins>' },
  field: { label: "Date field", post: '<w:fldSimple w:instr=" DATE "><w:r><w:t>19.10.2026</w:t></w:r></w:fldSimple>' },
  hidden: { label: "Hidden text", post: '<w:r><w:rPr><w:vanish/></w:rPr><w:t xml:space="preserve"> hidden note</w:t></w:r>' },
  pagebreak: { label: "Page break", post: '<w:r><w:br w:type="page"/></w:r>' },
};
export const TABLE_XML = '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid><w:gridCol w:w="4500"/></w:tblGrid><w:tr><w:tc><w:p><w:r><w:t>Cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';
export function documentXml(blocks) {
  const body = blocks.map(b => {
    if (b.type === "table") return TABLE_XML;
    const flags = b.flags || [];
    const runs = b.text.split("\n").map((line, i) => (i ? "<w:br/>" : "") + `<w:r><w:t xml:space="preserve">${esc(line)}</w:t></w:r>`).join("");
    return `<w:p>${flags.map(f => INSERTS[f].pre || "").join("")}${runs}${flags.map(f => INSERTS[f].post || "").join("")}</w:p>`;
  }).join("") + "<w:sectPr/>";
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' + `<w:body>${body}</w:body></w:document>`;
}
export function storedZip(entries) {
  const enc = new TextEncoder();
  const chunks = [], central = [];
  let offset = 0;
  const le = (n, size) => { const a = new Uint8Array(size); for (let i = 0; i < size; i++) a[i] = n >>> (8 * i) & 0xff; return a; };
  for (const [name, text] of entries) {
    const nb = enc.encode(name), data = typeof text === "string" ? enc.encode(text) : text, crc = crc32(data);
    const common = [le(20, 2), le(0, 2), le(0, 2), le(0, 2), le(0x5021, 2), le(crc, 4), le(data.length, 4), le(data.length, 4), le(nb.length, 2), le(0, 2)];
    const local = [le(0x04034b50, 4), ...common, nb, data];
    central.push([le(0x02014b50, 4), le(20, 2), ...common, le(0, 2), le(0, 2), le(0, 2), le(0x1800000, 4), le(offset, 4), nb]);
    for (const c of local) { chunks.push(c); offset += c.length; }
  }
  let cdSize = 0; for (const c of central.flat()) { chunks.push(c); cdSize += c.length; }
  chunks.push(le(0x06054b50, 4), le(0, 2), le(0, 2), le(entries.length, 2), le(entries.length, 2), le(cdSize, 4), le(offset, 4), le(0, 2));
  const out = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0)); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
export const buildDocx = blocks => storedZip([["[Content_Types].xml", CONTENT_TYPES], ["_rels/.rels", ROOT_RELS], ["word/document.xml", documentXml(blocks)]]);

// How the template loop would read one paragraph on its own, for the margin notes in the editor.
export function classify(raw) {
  const s = pyStrip(raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n"));
  if (!s) return { kind: "blank", label: "blank" };
  if (s.startsWith("Work Instruction:")) return { kind: "title", label: "title" };
  if (s.startsWith("Safety Notes:")) return { kind: "safety", label: "safety notes" };
  const m = STEP.exec(s);
  if (m) return { kind: "step", label: "step " + (m[1].length > 9 ? m[1] : Number(m[1])) };
  return { kind: "other", label: "not a label" };
}

// One call for the page: run the parser and serialize, like main() without writing files.
export async function run(bytes, name) {
  const info = {};
  try {
    const parsed = await parseDocx(bytes, info);
    const { json, csv } = serializeOutputs(parsed, name);
    return { ok: true, parsed, json, csv, stdout: stdoutLine(parsed), paragraphs: info.paragraphs };
  } catch (e) {
    if (e instanceof WorkInstructionError) return { ok: false, code: e.code, message: e.message, paragraph: e.paragraph, stderr: stderrLine(e), paragraphs: info.paragraphs };
    if (e instanceof Uncaught) return { ok: false, uncaught: e.kind, paragraphs: info.paragraphs };
    throw e;
  }
}
