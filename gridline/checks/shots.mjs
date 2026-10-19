// Screenshots and horizontal overflow check at several widths.
// Usage: node checks/shots.mjs [baseUrl] [outDir] [widths]
// Default: http://127.0.0.1:8931/ shots 320,390,768,1440
import { launch, sleep } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] || 'http://127.0.0.1:8931/';
const outDir = process.argv[3] || join(here, '..', 'shots');
const widths = (process.argv[4] || '320,390,768,1440').split(',').map(Number);
mkdirSync(outDir, { recursive: true });

const page = await launch({ width: widths[0], height: 900 });
const report = {};
let failed = 0;
try {
  for (const w of widths) {
    const h = w < 700 ? 844 : 900;
    await page.size(w, h);
    await page.goto(base);
    await sleep(600);
    const r = await page.eval(`(() => {
      const W = document.documentElement.clientWidth;
      const clipped = el => { for (let p = el.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return p !== document.body && p !== document.documentElement; } return false; };
      const over = [...document.querySelectorAll('body *')].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.right > W + 1 && !clipped(e) && getComputedStyle(e).position !== 'fixed'; }).slice(0, 8).map(e => e.tagName + '.' + e.className + ' ' + (e.textContent || '').trim().slice(0, 30));
      return { clientWidth: W, scrollWidth: document.documentElement.scrollWidth, mode: document.body.dataset.mode, over };
    })()`);
    report[w] = r;
    if (r.scrollWidth > r.clientWidth || r.over.length) failed++;
    writeFileSync(join(outDir, `gridline-${w}.png`), await page.screenshot());
  }
  report.problems = page.problems.slice();
  if (page.problems.length) failed++;
} finally {
  await page.close();
}
console.log(JSON.stringify(report, null, 1));
console.log(failed ? `\nOverflow or console problems found (${failed})` : '\nNo horizontal overflow and no console errors at ' + widths.join(', '));
process.exit(failed ? 1 : 0);
