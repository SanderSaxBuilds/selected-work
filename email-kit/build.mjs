// Builds the Inkpost emails.
//
//   node build.mjs            writes dist/ and the preview page index.html
//   node build.mjs --check    builds in memory and fails if dist/ is out of date
//
// For each email: render its template with the shared layout and partials,
// inline src/styles/inline.css into style attributes, put head.css, dark.css,
// font.css and mso.css in the head, drop developer comments, then render the
// plain text version from its own template with the same data.
// No npm dependencies. Node 20 or newer.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compile, render } from './lib/template.mjs';
import { parseRules, minify, inline } from './lib/css.mjs';
import { tokenize } from './lib/html.mjs';

export const ROOT = dirname(fileURLToPath(import.meta.url));
export const GMAIL_CLIP_BYTES = 102 * 1000;
const TEXT_WIDTH = 72;
const ROW_WIDTH = 56;

const read = p => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const readJSON = p => JSON.parse(read(p));

export function money(cents, currency = '£') {
  const sign = cents < 0 ? '−' : '';
  return `${sign}${currency}${(Math.abs(cents) / 100).toFixed(2)}`;
}

export function textRow(left, right, width = ROW_WIDTH) {
  const gap = Math.max(2, width - left.length - right.length);
  return left + ' '.repeat(gap) + right;
}

// Wrap prose at word boundaries. Indented lines keep their indent, and a
// long word such as a URL is never split.
export function wrapText(text, width = TEXT_WIDTH) {
  return text.split('\n').map(line => {
    if (line.length <= width) return line;
    const indent = /^\s*/.exec(line)[0];
    const words = line.trim().split(/\s+/);
    const out = [];
    let cur = indent;
    for (const w of words) {
      if (cur.trim() && (cur + ' ' + w).length > width) { out.push(cur); cur = indent + w; }
      else cur = cur.trim() ? cur + ' ' + w : indent + w;
    }
    if (cur.trim()) out.push(cur);
    return out.join('\n');
  }).join('\n');
}

// "kit:images/logo.png" becomes an absolute URL on the published kit.
function resolveKit(value, base) {
  if (typeof value === 'string') return value.startsWith('kit:') ? new URL(value.slice(4), base).href : value;
  if (Array.isArray(value)) return value.map(v => resolveKit(v, base));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveKit(v, base)]));
  return value;
}

// Derived values the templates need. Money is kept in pence and only
// formatted here, so the totals always add up.
function derive(id, ctx) {
  const cur = ctx.brand.currency;
  if (ctx.lines) {
    let subtotal = 0;
    let coffee = 0;
    ctx.lines = ctx.lines.map(l => {
      const cents = l.qty * l.unit;
      subtotal += cents;
      if (l.coffee) coffee += cents;
      return { ...l, cents, unitPrice: money(l.unit, cur), lineTotal: money(cents, cur), textRow: textRow(`${l.qty} x ${l.name}`, money(cents, cur)) };
    });
    const discount = Math.round((coffee * ctx.discount.percent) / 100);
    const total = subtotal - discount + ctx.shipping.cents;
    ctx.totals = [
      { label: 'Subtotal', value: money(subtotal, cur) },
      { label: ctx.discount.label, value: money(-discount, cur) },
      { label: ctx.shipping.label, value: money(ctx.shipping.cents, cur) }
    ].map(t => ({ ...t, textRow: textRow(t.label, t.value) }));
    ctx.grandTotal = money(total, cur);
    ctx.grandTextRow = textRow('Total paid', ctx.grandTotal);
    ctx.textRule = '-'.repeat(ROW_WIDTH);
    ctx.amounts = { subtotal, coffee, discount, shipping: ctx.shipping.cents, total };
  }
  if (ctx.products) {
    ctx.products = ctx.products.map(p => ({ ...p, priceText: `${money(p.price, cur)} for ${p.size}` }));
    ctx.productRows = [];
    for (let i = 0; i < ctx.products.length; i += 2) ctx.productRows.push(ctx.products.slice(i, i + 2));
  }
  return ctx;
}

// Keep Outlook conditional comments, drop the rest, tidy whitespace.
export function cleanHtml(html) {
  let out = '';
  for (const t of tokenize(html)) {
    const raw = html.slice(t.start, t.end);
    if (t.type === 'comment' && !/^(\[if |<!\[endif\]|\s*<!\[endif\])/.test(t.value) && !/^\[if [^\]]*\]><!$/.test(t.value)) continue;
    out += raw;
  }
  return out.replace(/[ \t]+$/gm, '').replace(/\n{2,}/g, '\n').trim() + '\n';
}

const loadDir = (dir, ext) => Object.fromEntries(readdirSync(join(ROOT, dir)).filter(f => extname(f) === ext).map(f => [basename(f, ext), compile(read(join(dir, f)), `${dir}/${f}`)]));

export function buildAll() {
  const site = readJSON('src/data/brand.json');
  const htmlPartials = loadDir('src/partials', '.html');
  const textPartials = loadDir('src/partials', '.txt');
  const layoutHtml = compile(read('src/layouts/email.html'), 'src/layouts/email.html');
  const layoutText = compile(read('src/layouts/email.txt'), 'src/layouts/email.txt');
  const rules = parseRules(read('src/styles/inline.css'));
  const css = {
    head: minify(read('src/styles/head.css')),
    dark: minify(read('src/styles/dark.css')),
    font: minify(read('src/styles/font.css')),
    mso: minify(read('src/styles/mso.css'))
  };
  const used = new Set();
  const files = {};
  const emails = [];
  for (const id of site.emails) {
    const data = readJSON(`src/data/${id}.json`);
    const ctx = derive(id, resolveKit({
      ...data,
      kit: site.kit,
      brand: site.brand,
      links: { ...site.links, ...data.links },
      images: { ...site.images, ...data.images },
      viewInBrowser: `kit:dist/${id}.html`
    }, site.base));
    ctx.preheaderSpacer = '&#8199;&#847;&zwnj;&nbsp;'.repeat(48);
    ctx.css = css;

    const body = render(compile(read(`src/templates/${id}.html`), `src/templates/${id}.html`), ctx, { partials: htmlPartials });
    const page = render(layoutHtml, { ...ctx, body }, { partials: htmlPartials });
    const inlined = inline(page, rules);
    inlined.used.forEach(r => used.add(r));
    const html = cleanHtml(inlined.html);

    const textBody = render(compile(read(`src/templates/${id}.txt`), `src/templates/${id}.txt`), ctx, { partials: textPartials, escape: v => String(v) });
    const text = wrapText(render(layoutText, { ...ctx, body: textBody.trim() }, { partials: textPartials, escape: v => String(v) }))
      .replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim() + '\n';

    const bytes = Buffer.byteLength(html, 'utf8');
    if (bytes >= GMAIL_CLIP_BYTES) throw new Error(`${id}.html is ${bytes} bytes, over the Gmail clipping limit`);
    files[`dist/${id}.html`] = html;
    files[`dist/${id}.txt`] = text;
    emails.push({
      id,
      name: data.name,
      subject: data.subject,
      preheader: data.preheader,
      summary: data.summary,
      handles: data.handles,
      html: `dist/${id}.html`,
      text: `dist/${id}.txt`,
      url: ctx.viewInBrowser,
      bytes,
      kb: (bytes / 1024).toFixed(1),
      textBytes: Buffer.byteLength(text, 'utf8'),
      amounts: ctx.amounts || null
    });
  }
  const unused = rules.filter(r => !used.has(r)).map(r => r.selector);
  const manifest = { kit: site.kit, base: site.base, clipLimit: GMAIL_CLIP_BYTES, emails };
  files['dist/manifest.json'] = JSON.stringify(manifest, null, 2) + '\n';
  const preview = compile(read('src/preview/index.html'), 'src/preview/index.html');
  files['index.html'] = render(preview, { ...manifest, brand: site.brand, emails: emails.map((e, i) => ({ ...e, first: i === 0, handles: e.handles })) });
  return { files, manifest, unused };
}

export function writeAll(files, root = ROOT) {
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), content);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { files, manifest, unused } = buildAll();
  if (unused.length) console.warn('Inline rules no email uses: ' + unused.join(', '));
  if (process.argv.includes('--check')) {
    const stale = Object.entries(files).filter(([rel, content]) => { try { return readFileSync(join(ROOT, rel), 'utf8') !== content; } catch { return true; } }).map(([rel]) => rel);
    if (stale.length) { console.error('Out of date: ' + stale.join(', ') + '. Run node build.mjs'); process.exit(1); }
    console.log('dist is up to date');
  } else {
    writeAll(files);
    for (const e of manifest.emails) console.log(`${e.html.padEnd(30)} ${String(e.bytes).padStart(6)} bytes  ${e.text} ${e.textBytes} bytes`);
    console.log('index.html');
  }
}
