// Renders every built email in headless Chromium at 375 and 680 pixels, in
// light and dark mode, and checks what a reader would hit: horizontal
// overflow, broken images, text under 14 pixels, tap targets under 44
// pixels, contrast under WCAG AA, columns that fail to stack or to sit side
// by side, and console errors. Saves a full length screenshot of each.
// This is Chromium only. It says nothing about Outlook, Gmail or Apple Mail.
// Usage: node checks/render.mjs [baseUrl]   (serve this folder, default http://127.0.0.1:8934/)
import { launch, checker, sleep } from './cdp.mjs';
import { servePublished } from './intercept.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const base = process.argv[2] || 'http://127.0.0.1:8934/';
const shots = join(root, 'shots');
mkdirSync(shots, { recursive: true });
const manifest = JSON.parse(readFileSync(join(root, 'dist', 'manifest.json'), 'utf8'));

// Runs inside the page.
function audit() {
  const W = document.documentElement.clientWidth;
  const shown = el => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    for (let p = el; p && p.nodeType === 1; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    }
    return true;
  };
  const rgb = c => { const v = c.match(/[\d.]+/g).map(Number); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = x => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = el => { for (let p = el; p && p.nodeType === 1; p = p.parentElement) { const c = rgb(getComputedStyle(p).backgroundColor); if (c.a > 0.5) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

  const sticking = [...document.querySelectorAll('body *')].filter(e => shown(e) && e.getBoundingClientRect().right > W + 1).slice(0, 5).map(e => e.tagName + '.' + e.className);
  const brokenImages = [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.src);

  let minFont = Infinity;
  let minContrast = Infinity;
  let minContrastText = '';
  const smallText = [];
  const lowContrast = [];
  let textNodes = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.nodeValue.replace(/[\s ‌͏ ﻿]/g, '');
    if (!text || !shown(n.parentElement)) continue;
    textNodes++;
    const s = getComputedStyle(n.parentElement);
    const size = parseFloat(s.fontSize);
    minFont = Math.min(minFont, size);
    if (size < 14) smallText.push(text.slice(0, 30) + ' ' + size);
    const cr = ratio(rgb(s.color), bgOf(n.parentElement));
    const large = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700);
    if (cr < minContrast) { minContrast = cr; minContrastText = text.slice(0, 30); }
    if (cr < (large ? 3 : 4.5)) lowContrast.push(text.slice(0, 30) + ' ' + cr.toFixed(2));
  }

  const links = [...document.querySelectorAll('a[href]')].filter(shown).map(a => { const r = a.getBoundingClientRect(); return { text: a.textContent.trim().slice(0, 30) || a.querySelector('img')?.alt, w: Math.round(r.width), h: Math.round(r.height) }; });
  const smallTargets = links.filter(l => l.w < 44 || l.h < 44);

  const groups = new Map();
  document.querySelectorAll('.col').forEach(c => { if (!groups.has(c.parentElement)) groups.set(c.parentElement, []); groups.get(c.parentElement).push(c.getBoundingClientRect()); });
  const columns = [...groups.values()].map(rs => (rs.every(r => Math.abs(r.top - rs[0].top) < 2) ? 'side' : rs.every((r, i) => i === 0 || r.top >= rs[i - 1].bottom - 1) ? 'stacked' : 'mixed'));
  const colWidths = [...document.querySelectorAll('.col')].map(c => Math.round(c.getBoundingClientRect().width));

  return {
    W,
    scrollWidth: document.documentElement.scrollWidth,
    sticking,
    brokenImages,
    images: document.images.length,
    textNodes,
    minFont,
    smallText,
    minContrast: Number(minContrast.toFixed(2)),
    minContrastText,
    lowContrast,
    links: links.length,
    smallTargets,
    columns,
    colWidths,
    pageLum: Number(lum(rgb(getComputedStyle(document.body).backgroundColor)).toFixed(3)),
    cardLum: Number(lum(rgb(getComputedStyle(document.querySelector('.bg-card')).backgroundColor)).toFixed(3)),
    headingFont: getComputedStyle(document.querySelector('h1')).fontFamily,
    webFontLoaded: document.fonts.check('30px "Young Serif"'),
    height: Math.ceil(document.documentElement.scrollHeight)
  };
}

const c = checker('Email renders');
const results = [];
const page = await launch({ width: 680, height: 900 });
try {
  const served = await servePublished(page, root);
  for (const email of manifest.emails) {
    for (const width of [375, 680]) {
      for (const scheme of ['light', 'dark']) {
        const tag = `${email.id} ${width} ${scheme}`;
        await page.send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-color-scheme', value: scheme }] });
        await page.size(width, 900);
        page.problems.length = 0;
        await page.goto(base + email.html, 'document.readyState === "complete" && [...document.images].every(i => i.complete)');
        await page.eval('document.fonts.ready.then(() => true)');
        await sleep(150);
        const r = await page.eval(`(${audit.toString()})()`);
        // The browser asks the local server for /favicon.ico on its own. That request is not part of the email.
        r.problems = page.problems.filter(p => !/\/favicon\.ico\b/.test(p));
        results.push({ email: email.id, width, scheme, ...r });

        c.ok(r.scrollWidth <= r.W && r.sticking.length === 0, `${tag}: no horizontal overflow`, { scrollWidth: r.scrollWidth, sticking: r.sticking });
        c.ok(r.brokenImages.length === 0 && r.images > 0, `${tag}: all ${r.images} images load`, r.brokenImages);
        c.ok(r.minFont >= 14 && r.smallText.length === 0, `${tag}: no visible text under 14px, smallest ${r.minFont}px`, r.smallText);
        c.ok(r.smallTargets.length === 0, `${tag}: all ${r.links} links are at least 44 by 44`, r.smallTargets);
        c.ok(r.lowContrast.length === 0, `${tag}: text contrast meets AA, lowest ${r.minContrast}`, r.lowContrast);
        const want = width < 600 ? 'stacked' : 'side';
        c.ok(r.columns.length > 0 ? r.columns.every(x => x === want) : true, `${tag}: columns ${want}` + (r.columns.length ? ` in ${r.columns.length} row${r.columns.length > 1 ? 's' : ''}` : ', none in this email'), r.columns);
        c.ok(scheme === 'dark' ? r.pageLum < 0.05 && r.cardLum < 0.05 : r.pageLum > 0.7 && r.cardLum > 0.9, `${tag}: ${scheme} palette applied`, { pageLum: r.pageLum, cardLum: r.cardLum });
        c.ok(r.problems.length === 0, `${tag}: no console errors`, r.problems);

        await page.size(width, Math.min(r.height, 8000));
        await sleep(150);
        writeFileSync(join(shots, `email-${email.id}-${width}-${scheme}.png`), await page.screenshot());
      }
    }
  }
  const missing = served.filter(s => s.status !== 200);
  c.ok(missing.length === 0, `every published asset request resolved to a file in the kit, ${served.length} requests`, missing);
} finally {
  await page.close();
}
writeFileSync(join(here, 'render-results.json'), JSON.stringify(results, null, 1) + '\n');
process.exit(c.done() ? 1 : 0);
