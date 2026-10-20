// Builds cover-slotbook.png at 1600 x 1000 from a real phone screenshot of the app.
// Usage: node checks/cover.mjs [baseUrl]   (serve this folder, default http://127.0.0.1:8932/)
import { launch, sleep } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const base = process.argv[2] || 'http://127.0.0.1:8932/';
const url = base + '?now=2026-10-20T03:00:00Z';
const p = await launch({ width: 390, height: 844 });
try {
  // Phone at 2x: London visitor, Tuesday 27 October picked, first time selected
  await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await p.goto(url);
  await p.eval('localStorage.clear()');
  await p.goto(url);
  await p.eval(`(() => { const s = document.getElementById('zone'); s.value = 'Europe/London'; s.dispatchEvent(new Event('change')); })()`);
  await p.click('#cal-body td[data-date="2026-10-27"]');
  await p.click('#slots .slot');
  await sleep(1000);
  await p.eval(`(() => { document.activeElement.blur(); const r = document.querySelector('.cal-wrap').getBoundingClientRect(); window.scrollTo({ top: window.scrollY + r.top - 12, behavior: 'instant' }); })()`);
  await p.eval('document.fonts.ready');
  await sleep(400);
  writeFileSync(join(here, 'cover', 'phone.png'), await p.screenshot());

  // Compose
  await p.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await p.goto(base + 'checks/cover/cover.html', 'document.fonts.status === "loaded" && [...document.images].every(i => i.complete && i.naturalWidth > 0)');
  await sleep(500);
  writeFileSync(join(root, 'cover-slotbook.png'), await p.screenshot({ x: 0, y: 0, width: 1600, height: 1000 }));
  console.log('wrote cover-slotbook.png', p.problems.length ? p.problems : 'no console problems');
} finally {
  await p.close();
}
