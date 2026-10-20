// The built emails use absolute URLs on the published kit, as real emails
// must. Before the kit is published, this answers those requests from the
// files in this folder through the DevTools Fetch domain. A missing file
// gets a 404, so a broken image reference still shows up as an error.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';

export const PUBLISHED = 'https://sandersaxbuilds.github.io/selected-work/email-kit/';
const PREFIX = '/selected-work/email-kit/';
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };

export async function servePublished(page, root) {
  const base = resolve(root);
  const log = [];
  page.on(async m => {
    if (m.method !== 'Fetch.requestPaused') return;
    const { requestId, request } = m.params;
    let rel = decodeURIComponent(new URL(request.url).pathname.slice(PREFIX.length));
    if (!rel || rel.endsWith('/')) rel += 'index.html';
    const file = resolve(join(base, rel));
    const ok = (file === base || file.startsWith(base + sep)) && existsSync(file) && statSync(file).isFile();
    log.push({ url: request.url, status: ok ? 200 : 404 });
    const body = ok ? readFileSync(file) : Buffer.from('Not found');
    await page.send('Fetch.fulfillRequest', {
      requestId,
      responseCode: ok ? 200 : 404,
      responseHeaders: [{ name: 'Content-Type', value: ok ? TYPES[extname(file)] || 'application/octet-stream' : 'text/plain' }, { name: 'Cache-Control', value: 'no-store' }],
      body: body.toString('base64')
    });
  });
  await page.send('Fetch.enable', { patterns: [{ urlPattern: PUBLISHED + '*', requestStage: 'Request' }] });
  return log;
}
