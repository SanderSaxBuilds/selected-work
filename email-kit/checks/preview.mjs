// Checks the Inkpost preview page at 320, 390, 768 and 1440 pixels: no
// horizontal overflow, no console errors, 44 pixel controls, the email frame
// loaded. Then drives it: tabs by click and keyboard, the width and mode
// toggles, the source view, the download links and a deep link.
// The page is loaded at its published address, answered from this folder,
// and once more from the local server to cover the local URL rewrite.
// Usage: node checks/preview.mjs [localBaseUrl]   (default http://127.0.0.1:8934/)
import { launch, checker, sleep } from './cdp.mjs';
import { servePublished, PUBLISHED } from './intercept.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const local = process.argv[2] || 'http://127.0.0.1:8934/';
const shots = join(root, 'shots');
mkdirSync(shots, { recursive: true });
const manifest = JSON.parse(readFileSync(join(root, 'dist', 'manifest.json'), 'utf8'));
const READY = 'document.documentElement.dataset.ready === "true"';
const notFavicon = list => list.filter(p => !/\/favicon\.ico\b/.test(p));

const layout = `(() => {
  const W = document.documentElement.clientWidth;
  const clipped = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) return true; } return false; };
  const shown = el => { const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false; for (let p = el; p; p = p.parentElement) { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden') return false; } return true; };
  const over = [...document.querySelectorAll('body *')].filter(e => shown(e) && e.getBoundingClientRect().right > W + 1 && !clipped(e) && !e.classList.contains('skip')).slice(0, 6).map(e => e.tagName + '.' + e.className);
  const controls = [...document.querySelectorAll('a[href], button, .seg span')].filter(e => shown(e) && !e.classList.contains('skip')).map(e => { const r = e.getBoundingClientRect(); return { t: (e.textContent || '').trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) }; });
  const small = controls.filter(c => c.w < 44 || c.h < 44);
  const panel = document.querySelector('[role="tabpanel"]:not([hidden])');
  const frame = panel && panel.querySelector('iframe');
  const doc = frame && frame.contentDocument;
  const box = panel && panel.querySelector('.frame-box').getBoundingClientRect();
  return {
    W, scrollWidth: document.documentElement.scrollWidth, over, controls: controls.length, small,
    frameLoaded: !!(doc && doc.querySelector('[role="article"]')),
    frameImages: doc ? [...doc.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.src) : ['no frame'],
    frameInside: box ? box.left >= 0 && box.right <= W + 0.5 : false,
    frameWidth: frame ? frame.style.width : null,
    transform: frame ? frame.style.transform : null,
    note: panel ? panel.querySelector('.scale-note').textContent : '',
    fonts: document.fonts.check('16px "Schibsted Grotesk"') && document.fonts.check('12px "Fragment Mono"'),
    height: Math.ceil(document.documentElement.scrollHeight)
  };
})()`;

const frameState = id => `(() => {
  const f = document.querySelector('#panel-${id} iframe');
  const d = f && f.contentDocument;
  if (!d || !d.querySelector('[role="article"]')) return null;
  const rgb = c => c.match(/[\\d.]+/g).map(Number);
  const lum = c => { const [r, g, b] = rgb(c).map(x => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const pad = d.querySelector('.pad');
  return {
    innerWidth: f.contentWindow.innerWidth,
    bodyLum: Number(lum(getComputedStyle(d.body).backgroundColor).toFixed(3)),
    padLeft: pad ? getComputedStyle(pad).paddingLeft : null,
    images: [...d.images].every(i => i.complete && i.naturalWidth > 0),
    blankTargets: [...d.querySelectorAll('a[href]')].every(a => a.target === '_blank'),
    cols: d.querySelectorAll('.col').length
  };
})()`;

async function waitFor(page, expr, tries = 60) {
  for (let i = 0; i < tries; i++) { const v = await page.eval(expr).catch(() => null); if (v) return v; await sleep(100); }
  return null;
}

const c = checker('Preview page');
const results = { widths: {}, flows: {} };
const page = await launch({ width: 1440, height: 900 });
try {
  await servePublished(page, root);

  for (const w of [320, 390, 768, 1440]) {
    await page.size(w, 900);
    page.problems.length = 0;
    await page.goto(PUBLISHED);
    await page.eval('document.fonts.ready.then(() => true)');
    await waitFor(page, `(${frameState(manifest.emails[0].id)}) && (${frameState(manifest.emails[0].id)}).images`);
    await sleep(200);
    const r = await page.eval(layout);
    r.problems = notFavicon(page.problems);
    results.widths[w] = r;
    c.ok(r.scrollWidth <= r.W && r.over.length === 0, `${w}: no horizontal overflow`, { scrollWidth: r.scrollWidth, over: r.over });
    c.ok(r.small.length === 0, `${w}: all ${r.controls} links, buttons and toggles are at least 44 by 44`, r.small);
    c.ok(r.frameLoaded && r.frameImages.length === 0 && r.frameInside, `${w}: the email frame loads with its images and fits the screen`, { frameImages: r.frameImages, frameInside: r.frameInside });
    c.ok(r.frameWidth === (w < 720 ? '375px' : '680px'), `${w}: starts at ${w < 720 ? 'phone' : 'desktop'} width`, r.frameWidth);
    c.ok(r.problems.length === 0, `${w}: no console errors`, r.problems);
    await page.size(w, Math.min(r.height, 7000));
    await sleep(300);
    writeFileSync(join(shots, `preview-${w}.png`), await page.screenshot());
  }

  // Interaction flow at 1440
  await page.size(1440, 900);
  page.problems.length = 0;
  await page.goto(PUBLISHED);
  await waitFor(page, `(${frameState('welcome')})`);
  await page.click('input[name="width"][value="375"] + span');
  await sleep(300);
  let s = await page.eval(frameState('welcome'));
  c.ok(s.innerWidth === 375 && s.padLeft === '20px', 'width toggle: phone gives the email a 375 pixel viewport and its media query applies', s);
  await page.click('input[name="width"][value="680"] + span');
  await sleep(300);
  s = await page.eval(frameState('welcome'));
  c.ok(s.innerWidth === 680 && s.padLeft === '40px', 'width toggle: desktop gives 680 pixels and the desktop padding', s);
  await page.click('input[name="theme"][value="dark"] + span');
  await sleep(200);
  s = await page.eval(frameState('welcome'));
  c.ok(s.bodyLum < 0.05, 'mode toggle: dark switches the email to its dark palette', s.bodyLum);
  await page.click('input[name="theme"][value="light"] + span');
  await sleep(200);
  s = await page.eval(frameState('welcome'));
  c.ok(s.bodyLum > 0.7, 'mode toggle: light switches it back', s.bodyLum);
  c.ok(s.blankTargets, 'links inside the preview open in a new tab instead of replacing the frame');

  await page.click('#tab-newsletter');
  const nl = await waitFor(page, `(() => { const s = (${frameState('newsletter')}); return s && s.images ? s : null; })()`);
  const tabInfo = await page.eval(`({ hash: location.hash, shown: !document.querySelector('#panel-newsletter').hidden, others: [...document.querySelectorAll('[role=tabpanel]')].filter(p => !p.hidden).length, selected: document.querySelector('#tab-newsletter').getAttribute('aria-selected') })`);
  c.ok(tabInfo.shown && tabInfo.others === 1 && tabInfo.selected === 'true' && tabInfo.hash === '#newsletter', 'tabs: a click shows only that panel and updates the address', tabInfo);
  c.ok(nl && nl.cols === 4, 'tabs: the newsletter frame loads with its four product columns', nl);

  await page.eval(`document.querySelector('#tab-welcome').focus()`);
  await page.key('ArrowRight');
  let k = await page.eval(`({ sel: document.querySelector('[role=tab][aria-selected=true]').id, focus: document.activeElement.id })`);
  c.ok(k.sel === 'tab-order-confirmation' && k.focus === 'tab-order-confirmation', 'tabs: ArrowRight selects and focuses the next tab', k);
  await page.key('End');
  k = await page.eval(`({ sel: document.querySelector('[role=tab][aria-selected=true]').id, focus: document.activeElement.id })`);
  c.ok(k.sel === 'tab-newsletter' && k.focus === 'tab-newsletter', 'tabs: End goes to the last tab', k);
  await page.key('ArrowRight');
  k = await page.eval(`({ sel: document.querySelector('[role=tab][aria-selected=true]').id })`);
  c.ok(k.sel === 'tab-welcome', 'tabs: ArrowRight on the last tab wraps to the first', k);
  await page.key('Home');
  const roving = await page.eval(`[...document.querySelectorAll('[role=tab]')].map(t => t.tabIndex).join(',')`);
  c.ok(roving === '0,-1,-1,-1', 'tabs: one tab stop, on the selected tab', roving);

  await page.click('#panel-welcome [data-source]');
  const src = await waitFor(page, `(() => { const code = document.querySelector('#source-welcome code'); return code.textContent ? { start: code.textContent.slice(0, 15), bytes: new TextEncoder().encode(code.textContent).length, vml: code.textContent.includes('v:roundrect'), expanded: document.querySelector('#panel-welcome [data-source]').getAttribute('aria-expanded'), hidden: document.querySelector('#source-welcome').hidden } : null; })()`);
  c.ok(src && src.start === '<!DOCTYPE html>' && src.bytes === manifest.emails[0].bytes && src.vml && src.expanded === 'true' && !src.hidden, 'view source shows the full built file', src);
  await sleep(200);
  writeFileSync(join(shots, 'preview-1440-source.png'), await page.screenshot());

  const downloads = await page.eval(`Promise.all([...document.querySelectorAll('a[download]')].map(a => fetch(a.href).then(r => ({ href: a.getAttribute('href'), name: a.getAttribute('download'), ok: r.ok }))))`);
  c.ok(downloads.length === manifest.emails.length * 2 && downloads.every(d => d.ok && d.name.startsWith('kettlewick-')), `all ${downloads.length} download links resolve, HTML and plain text for each email`, downloads.filter(d => !d.ok));

  await page.click('#tab-newsletter');
  await waitFor(page, `(() => { const s = (${frameState('newsletter')}); return s && s.images; })()`);
  await page.click('input[name="theme"][value="dark"] + span');
  await sleep(300);
  await page.eval('scrollTo(0, 0)');
  writeFileSync(join(shots, 'preview-1440-newsletter-dark.png'), await page.screenshot());
  await page.click('input[name="theme"][value="light"] + span');

  // A change of hash on the open page, as from an in-page link or the back button
  await page.eval(`location.hash = '#order-confirmation'`);
  const hashed = await waitFor(page, `document.querySelector('#tab-order-confirmation').getAttribute('aria-selected') === 'true' && !document.querySelector('#panel-order-confirmation').hidden`);
  c.ok(hashed, 'a hash change on the open page switches to that email');

  // Deep link on a fresh load, with the viewer's system in dark mode
  await page.send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await page.goto('about:blank', 'true');
  await page.goto(PUBLISHED + '#shipping-update');
  const deep = await waitFor(page, `(() => { const s = (${frameState('shipping-update')}); return s && s.images ? { s, sel: document.querySelector('[role=tab][aria-selected=true]').id, theme: document.querySelector('input[name=theme]:checked').value } : null; })()`);
  c.ok(deep && deep.sel === 'tab-shipping-update', 'a link to #shipping-update opens that email', deep && deep.sel);
  c.ok(deep && deep.theme === 'dark' && deep.s.bodyLum < 0.05, 'with the system in dark mode the preview starts in dark mode', deep);
  await page.click('input[name="theme"][value="light"] + span');
  await sleep(200);
  s = await page.eval(frameState('shipping-update'));
  c.ok(s && s.bodyLum > 0.7, 'Light on the page overrides a dark system setting inside the email', s);
  await page.send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  c.ok(notFavicon(page.problems).length === 0, 'no console errors during the interaction flow', notFavicon(page.problems));

  // Phone: desktop width is scaled down to fit, not cut off
  await page.size(390, 844);
  await page.goto(PUBLISHED + '#order-confirmation');
  await waitFor(page, `(() => { const s = (${frameState('order-confirmation')}); return s && s.images; })()`);
  await page.click('input[name="width"][value="680"] + span');
  await sleep(300);
  const scaled = await page.eval(layout);
  c.ok(/^scale\(0\.\d+\)$/.test(scaled.transform) && scaled.frameInside && /shown at \d+% to fit/.test(scaled.note) && scaled.scrollWidth <= scaled.W, '390: the 680 pixel desktop view scales down to fit and says so', { transform: scaled.transform, note: scaled.note });
  await page.eval('scrollTo(0, 0)');
  writeFileSync(join(shots, 'preview-390-desktop-scaled.png'), await page.screenshot());

  // Local copy: the page rewrites the published URLs to this folder
  await page.send('Fetch.disable');
  page.problems.length = 0;
  await page.size(390, 844);
  await page.goto(local);
  const loc = await waitFor(page, `(() => { const s = (${frameState('welcome')}); return s && s.images ? s : null; })()`, 80);
  c.ok(loc && loc.images, 'local server: the preview rewrites the published URLs and every image loads', loc);
  c.ok(notFavicon(page.problems).length === 0, 'local server: no console errors', notFavicon(page.problems));

  for (const w of [320, 1440]) {
    await page.size(w, 900);
    page.problems.length = 0;
    await page.goto(local + 'sample-link.html?link=track-parcel');
    const r = await page.eval(`({ W: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, text: document.getElementById('which').textContent })`);
    c.ok(r.sw <= r.W && /track parcel link/.test(r.text) && notFavicon(page.problems).length === 0, `sample link page at ${w}: names the link, no overflow, no console errors`, r);
  }
} finally {
  await page.close();
}
writeFileSync(join(here, 'preview-results.json'), JSON.stringify(results, null, 1) + '\n');
process.exit(c.done() ? 1 : 0);
