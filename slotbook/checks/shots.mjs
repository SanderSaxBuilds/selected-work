// Full page screenshots and a horizontal overflow check at several widths, in
// three states: day and time picked with the details form open, the
// confirmation, and the staff view.
// Usage: node checks/shots.mjs [baseUrl] [outDir] [widths]
// Default: http://127.0.0.1:8932/ shots 320,390,768,1440
import { launch, sleep } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] || 'http://127.0.0.1:8932/';
const outDir = process.argv[3] || join(here, '..', 'shots');
const widths = (process.argv[4] || '320,390,768,1440').split(',').map(Number);
const NOW = '2026-10-20T03:00:00Z';
mkdirSync(outDir, { recursive: true });

const overflow = `(() => {
  const W = document.documentElement.clientWidth;
  const clipped = el => { for (let p = el.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return p !== document.body && p !== document.documentElement; } return false; };
  const over = [...document.querySelectorAll('body *')].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.right > W + 1 && !clipped(e) && getComputedStyle(e).position !== 'fixed' && !e.classList.contains('sr'); }).slice(0, 8).map(e => e.tagName + '.' + e.className + ' ' + (e.textContent || '').trim().slice(0, 30));
  return { clientWidth: W, scrollWidth: document.documentElement.scrollWidth, over };
})()`;

const page = await launch({ width: widths[0], height: 900 });
const report = {};
let failed = 0;
async function fullShot(w, name) {
  const h = await page.eval('Math.ceil(document.documentElement.scrollHeight)');
  await page.size(w, Math.min(h, 6000));
  await sleep(250);
  writeFileSync(join(outDir, `slotbook-${w}-${name}.png`), await page.screenshot());
}
try {
  for (const w of widths) {
    const h = w < 700 ? 844 : 900;
    await page.size(w, h);
    await page.goto(base + '?now=' + NOW);
    await page.eval(`localStorage.clear()`);
    await page.goto(base + '?now=' + NOW);
    await page.eval(`(() => { const s = document.getElementById('zone'); s.value = 'Europe/London'; s.dispatchEvent(new Event('change')); })()`);
    await page.click('#cal-body td.open[data-date="2026-10-27"]');
    await page.click('#slots .slot');
    await sleep(300);
    const pick = await page.eval(overflow);
    await fullShot(w, 'book');

    await page.size(w, h);
    await page.eval(`(() => { const f = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }; f('f-name', 'Sample Visitor'); f('f-email', 'visitor@example.com'); f('f-phone', '+44 7700 900123'); f('f-bike', 'Road bike'); })()`);
    await page.click('#submit');
    await sleep(300);
    const done = await page.eval(overflow);
    await fullShot(w, 'done');

    await page.size(w, h);
    await page.click('#tab-staff');
    await sleep(200);
    await page.click('#staff-list [data-cancel]');
    await sleep(200);
    const staff = await page.eval(overflow);
    await fullShot(w, 'staff');

    report[w] = { pick, done, staff };
    for (const r of [pick, done, staff]) if (r.scrollWidth > r.clientWidth || r.over.length) failed++;
  }
  report.problems = page.problems.slice();
  if (page.problems.length) failed++;
} finally {
  await page.close();
}
console.log(JSON.stringify(report, null, 1));
console.log(failed ? `\nOverflow or console problems found (${failed})` : '\nNo horizontal overflow and no console errors at ' + widths.join(', '));
process.exit(failed ? 1 : 0);
