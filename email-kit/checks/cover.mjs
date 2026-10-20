// Builds cover-email-kit.png at 1600 by 1000 from real screenshots of the
// built emails: three phone renders at 2x, laid flat side by side at the
// same height on the brand cherry. Welcome and newsletter in light mode,
// the shipping update in dark mode.
// Usage: node checks/cover.mjs [baseUrl]   (serve this folder, default http://127.0.0.1:8934/)
import { launch, sleep } from './cdp.mjs';
import { servePublished } from './intercept.mjs';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const base = process.argv[2] || 'http://127.0.0.1:8934/';
const CROP = { width: 375, height: 717 };
const shots = [
  ['welcome.png', 'dist/welcome.html', 'light', 0],
  ['newsletter.png', 'dist/newsletter.html', 'light', 0],
  ['shipping-dark.png', 'dist/shipping-update.html', 'dark', 0]
];

const page = await launch({ width: 375, height: 900 });
try {
  await servePublished(page, root);
  for (const [file, path, scheme, top] of shots) {
    await page.send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-color-scheme', value: scheme }] });
    await page.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 1400, deviceScaleFactor: 2, mobile: true });
    await page.goto(base + path, 'document.readyState === "complete" && [...document.images].every(i => i.complete)');
    await page.eval('document.fonts.ready.then(() => true)');
    await sleep(300);
    writeFileSync(join(here, 'cover', file), await page.screenshot({ x: 0, y: top, ...CROP }));
  }
  await page.send('Emulation.setEmulatedMedia', { media: '', features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await page.goto(base + 'checks/cover/cover.html', '[...document.images].every(i => i.complete && i.naturalWidth > 0)');
  await sleep(300);
  writeFileSync(join(root, 'cover-email-kit.png'), await page.screenshot({ x: 0, y: 0, width: 1600, height: 1000 }));
  const problems = page.problems.filter(p => !/\/favicon\.ico\b/.test(p));
  console.log('wrote cover-email-kit.png,', problems.length ? problems : 'no console problems');
  process.exitCode = problems.length ? 1 : 0;
} finally {
  await page.close();
}
