// Builds cover-gridline.png at 1600 x 1000 from real screenshots of the app.
// Usage: node checks/cover.mjs [baseUrl]   (serve the gridline folder, default http://127.0.0.1:8931/)
import { launch, sleep } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const base = process.argv[2] || 'http://127.0.0.1:8931/';
const p = await launch({ width: 1280, height: 800 });
try {
  // Desktop: a built-in view, two edits and a selected range with its summary
  await p.goto(base);
  await p.eval(`(() => { const s = document.getElementById('views'); s.value = 'b:large'; s.dispatchEvent(new Event('change')); })()`);
  const qty = await p.eval(`[...document.querySelectorAll('#hrow .hcell')].findIndex(h => h.textContent.startsWith('Qty'))`);
  await p.click(`#g1_${qty}`); await p.key('F2'); await p.eval(`document.getElementById('editor').select()`); await p.type('24'); await p.key('Enter');
  await p.click(`#g4_${qty}`); await p.key('F2'); await p.eval(`document.getElementById('editor').select()`); await p.type('60'); await p.key('Enter');
  await p.click(`#g3_${qty}`);
  for (let i = 0; i < 4; i++) await p.key('ArrowDown', { shift: true });
  await p.key('ArrowRight', { shift: true }); await p.key('ArrowRight', { shift: true });
  await p.eval(`document.getElementById('toast').hidden = true`);
  await sleep(300);
  writeFileSync(join(root, 'cover', 'desk.png'), await p.screenshot());

  // Phone
  await p.size(390, 844);
  await p.goto(base);
  await sleep(300);
  writeFileSync(join(root, 'cover', 'phone.png'), await p.screenshot());

  // Compose
  await p.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await p.goto(base + 'cover/cover.html', 'document.fonts.status === "loaded" && [...document.images].every(i => i.complete)');
  await sleep(500);
  writeFileSync(join(root, 'cover-gridline.png'), await p.screenshot({ x: 0, y: 0, width: 1600, height: 1000 }));
  console.log('wrote cover-gridline.png', p.problems.length ? p.problems : 'no console problems');
} finally {
  await p.close();
}
