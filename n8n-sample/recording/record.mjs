// Records the walkthrough from a local Playwright Chromium, real editor, real runs.
// Beats are timed to the narration. Frames come from the DevTools screencast,
// then render.sh turns them into the final mp4.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { ROOT, N8N, MOCK, signIn, personalProjectId, tableIds, wipeTable, mockReset, mockFault } from '../scripts/lib.mjs';

const FRAMES = path.join(ROOT, 'recording', 'frames');
fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });

await signIn();
const projectId = await personalProjectId();
const tables = await tableIds(projectId);
for (const id of Object.values(tables)) await wipeTable(projectId, id);
await mockReset();

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  storageState: path.join(ROOT, '.n8n-local', 'pw-state.json'),
});

// Headless Chromium draws no pointer, so the page draws one that follows the mouse.
await ctx.addInitScript(() => {
  const mount = () => {
    if (document.getElementById('__cursor')) return;
    const c = document.createElement('div');
    c.id = '__cursor';
    c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;width:30px;height:30px;transform:translate(960px,540px);transition:none';
    c.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M4 2 L4 19 L8.6 15 L11.6 21.6 L14.4 20.4 L11.4 13.8 L17.6 13.4 Z" fill="#111" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(c);
    window.addEventListener('mousemove', (e) => { c.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; }, true);
  };
  if (document.documentElement) mount();
  window.addEventListener('DOMContentLoaded', mount);
});

const open = async (url) => {
  const p = await ctx.newPage();
  await p.goto(url);
  await p.waitForTimeout(3500);
  return p;
};

const LEAD = 0.6; // seconds of picture before the voice starts
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* screencast ------------------------------------------------------------ */
let t0 = 0;
let client = null;
let current = null;
let seq = 0;
const frames = [];

async function attach(page) {
  const c = await ctx.newCDPSession(page);
  c.on('Page.screencastFrame', async (f) => {
    const t = (Date.now() - t0) / 1000;
    const name = `f${String(++seq).padStart(6, '0')}.jpg`;
    fs.writeFileSync(path.join(FRAMES, name), Buffer.from(f.data, 'base64'));
    frames.push({ t, name });
    await c.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await c.send('Page.startScreencast', { format: 'jpeg', quality: 96, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  client = c;
  current = page;
}

async function switchTo(page) {
  if (client) {
    await client.send('Page.stopScreencast').catch(() => {});
    await client.detach().catch(() => {});
  }
  await page.bringToFront();
  await attach(page);
  await page.mouse.move(pos.x, pos.y);
  await sleep(120);
  await page.mouse.move(pos.x + 1, pos.y + 1);
}

/* timing, pointer, canvas ------------------------------------------------ */
const now = () => (Date.now() - t0) / 1000 - LEAD;
const beats = [];
async function at(t, label) {
  const wait = t - now();
  if (wait > 0) await sleep(wait * 1000);
  beats.push({ label, planned: t, actual: Number(now().toFixed(2)) });
}

const pos = { x: 960, y: 620 };
const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);

async function glide(page, x, y, ms = 700) {
  const from = { ...pos };
  const start = Date.now();
  for (;;) {
    const u = Math.min(1, (Date.now() - start) / ms);
    pos.x = from.x + (x - from.x) * ease(u);
    pos.y = from.y + (y - from.y) * ease(u);
    await page.mouse.move(pos.x, pos.y);
    if (u >= 1) break;
    await sleep(14);
  }
}

const nodeBox = (page, name) => page.locator(`[data-test-id="canvas-node"][data-node-name="${name}"]`).boundingBox();

async function hoverNode(page, name, ms = 700) {
  const b = await nodeBox(page, name);
  if (b) await glide(page, b.x + b.width / 2, b.y + b.height / 2, ms);
}

const readView = (page) =>
  page.evaluate(() => {
    const m = document.querySelector('.vue-flow__transformationpane').style.transform.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*scale\(([\d.]+)\)/);
    return { x: Number(m[1]), y: Number(m[2]), z: Number(m[3]) };
  });

// Moves the real canvas with real wheel input, so the editor does the drawing.
async function fly(page, cx, cy, zoom, ms = 1400) {
  await glide(page, 960, 500, 180);
  const start = Date.now();
  const stepMs = 40;
  for (;;) {
    const spent = Date.now() - start;
    const left = Math.max(1, Math.round((ms - spent) / stepMs));
    const v = await readView(page);
    const stepZoom = (zoom / v.z) ** (1 / left);
    if (Math.abs(stepZoom - 1) > 0.001) {
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, -Math.log(stepZoom) / 0.001386);
      await page.keyboard.up('Control');
    }
    const w = await readView(page);
    const dx = (960 - cx * w.z - w.x) / left;
    const dy = (500 - cy * w.z - w.y) / left;
    if (Math.abs(dx) + Math.abs(dy) > 0.3) await page.mouse.wheel(-dx * 2, -dy * 2);
    if (spent >= ms) break;
    await sleep(stepMs / 2);
  }
}

const X = (c) => c * 220;
const R1 = 0;
const R2 = 560;
const R3 = 1040;

/* pre-roll, nothing here is recorded ------------------------------------- */
const pMain = await open(`${N8N}/workflow/leadIntakeMain01`);
const pReplay = await open(`${N8N}/workflow/leadIntakeRpl001`);
const pError = await open(`${N8N}/workflow/leadIntakeErr001`);
const pTable = await open(`${N8N}/projects/${projectId}/datatables/${tables.dead_letters}`);
const pMock = await open(`${MOCK}/`);

for (const p of [pMain, pReplay, pError]) {
  await p.bringToFront();
  await p.keyboard.press('Escape');
  await p.locator('[data-test-id="zoom-to-fit"]').click().catch(() => {});
  await p.waitForTimeout(700);
}

await pMain.bringToFront();
await pMain.mouse.move(pos.x, pos.y);
await pMain.waitForTimeout(800);

t0 = Date.now();
await attach(pMain);
await sleep(200);
await pMain.mouse.move(pos.x + 1, pos.y);

/* P1 overview, 0 to 18.5 ------------------------------------------------- */
await at(1.0, 'overview');
await glide(pMain, 520, 300, 2600);
await glide(pMain, 1200, 620, 3000);
await glide(pMain, 1500, 860, 2600);
await at(10.5, 'overview-2');
await glide(pMain, 900, 560, 2500);

/* P2 naming, 19 to 38.3 -------------------------------------------------- */
await at(17.6, 'zoom naming');
await fly(pMain, X(6), (R2 + R3) / 2 + 70, 0.88, 1500);
await at(25.5, 'name crm');
await hoverNode(pMain, 'CRM - Upsert Lead', 600);
await at(28.1, 'name followup');
await hoverNode(pMain, 'Follow-up - Check Ledger', 600);
await at(30.3, 'name deadletter');
await hoverNode(pMain, 'Dead Letter - Build Record', 600);
await at(33.2, 'name sweep');
await hoverNode(pMain, 'CRM - Classify Response', 900);
await sleep(600);
await hoverNode(pMain, 'Follow-up - Mark Sent', 1200);

/* P3 the flow, 38.7 to 52.9 ---------------------------------------------- */
await at(38.2, 'flow');
await fly(pMain, X(4.8), R1 + 100, 0.86, 1300);
await hoverNode(pMain, 'Intake - Normalise and Validate', 600);
await sleep(700);
await hoverNode(pMain, 'Dedupe - Find Existing Lead', 800);
await sleep(500);
await hoverNode(pMain, 'Dedupe - Decide Next Step', 500);
await at(45.3, 'ai');
await fly(pMain, X(2.6), R2 + 110, 1.05, 1200);
await hoverNode(pMain, 'AI - Qualify Lead', 600);
await sleep(1200);
await hoverNode(pMain, 'Fallback - Score With Fixed Rules', 900);

/* P4 the failure, 53.4 to 79.3 ------------------------------------------- */
await at(52.9, 'failure view');
await fly(pMain, X(7.6), R2 + 130, 1.0, 1200);
await at(55.2, 'fault on');
await mockFault('crm', [{ status: 503, times: 4 }]);
const exec = pMain.locator('[data-test-id="execute-workflow-button"]');
const eb = await exec.boundingBox();
await glide(pMain, eb.x + eb.width / 2, eb.y + eb.height / 2, 800);
await at(57.0, 'execute');
await exec.click();
await sleep(900);
await at(58.2, 'send lead');
const send = await fetch(`${N8N}/webhook-test/lead-intake`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    name: 'Maya Torres',
    email: 'maya.torres@example.com',
    phone: '+1 415 555 0142',
    service: 'plumbing',
    message: 'Burst pipe under the kitchen sink, urgent, can you come this week',
    budget: '$1,500',
  }),
});
console.log('webhook-test', send.status, await send.text());
await sleep(500);
await hoverNode(pMain, 'CRM - Wait Backoff', 900);
await at(68, 'watch loop');
await hoverNode(pMain, 'CRM - Classify Response', 900);
await sleep(1800);
await hoverNode(pMain, 'CRM - Route Outcome', 900);
await at(75.0, 'landed');
await hoverNode(pMain, 'Dead Letter - Store And Alert', 1100);

/* P5 where it lands, 79.9 to 95 ------------------------------------------ */
await at(78.2, 'reload table');
await pTable.reload();
await pTable.waitForTimeout(1200);
await at(79.7, 'table');
await switchTo(pTable);
await glide(pTable, 480, 118, 700);
await at(82.9, 'table columns');
await glide(pTable, 800, 118, 1100);
await glide(pTable, 1280, 118, 1300);
await at(85.6, 'payload');
for (let i = 0; i < 17; i++) {
  await pTable.mouse.wheel(60, 0);
  await sleep(30);
}
await at(89.2, 'alert');
await switchTo(pMock);
await glide(pMock, 500, 560, 900);
await sleep(1500);
await glide(pMock, 1400, 560, 2000);

/* P6 replay, 95.5 to 110.6 ----------------------------------------------- */
await at(95.2, 'replay');
await switchTo(pReplay);
await glide(pReplay, 960, 500, 500);
await hoverNode(pReplay, 'Replay - Run By Operator', 600);
const trigger = pReplay.locator('[data-test-id="execute-workflow-button-Replay - Run By Operator"]');
const tb = await trigger.boundingBox();
await glide(pReplay, tb.x + tb.width / 2, tb.y + tb.height / 2, 900);
await at(98.0, 'run replay');
await trigger.click();
await sleep(600);
await at(100.2, 'replay nodes');
await hoverNode(pReplay, 'Replay - Re-Post Lead To Intake', 900);
await at(102.2, 'reload table 2');
await pTable.reload();
await pTable.waitForTimeout(1000);
await at(103.6, 'resolved');
await switchTo(pTable);
await glide(pTable, 1720, 118, 800);
await at(106.6, 'mock');
await switchTo(pMock);
await glide(pMock, 500, 200, 700);
await sleep(900);
await glide(pMock, 1400, 200, 1000);

/* P7 idempotency, 111 to 130 --------------------------------------------- */
await at(110.8, 'followup');
await switchTo(pMain);
await fly(pMain, X(6.1), R3 + 60, 1.0, 1200);
await hoverNode(pMain, 'Follow-up - Reserve Send Key', 700);
await at(116.0, 'send key');
await hoverNode(pMain, 'Follow-up - Send Message', 800);
await at(118.8, 'retry');
await hoverNode(pMain, 'Follow-up - Classify Response', 700);
await sleep(600);
await hoverNode(pMain, 'Follow-up - Wait Backoff', 700);
await at(123.2, 'error workflow');
await switchTo(pError);
await glide(pError, 760, 520, 900);
await sleep(1200);
await glide(pError, 1200, 520, 1600);
await at(130.4, 'end');
await sleep(600);

const end = (Date.now() - t0) / 1000;
await client.send('Page.stopScreencast').catch(() => {});
await browser.close();

fs.writeFileSync(path.join(ROOT, 'recording', 'frames.json'), JSON.stringify({ frames, end }, null, 0));
console.log(`frames ${frames.length}, length ${end.toFixed(1)}s`);
console.log(beats.filter((b) => b.actual > b.planned + 0.3).map((b) => `${b.label} late ${(b.actual - b.planned).toFixed(1)}s`).join('\n') || 'no late beats');
