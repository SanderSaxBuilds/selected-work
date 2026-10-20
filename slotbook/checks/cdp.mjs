// Minimal Chrome DevTools Protocol helper, adapted from the workspace checks/cdp.mjs.
// Runs the local Brave install headless. Each launch removes only the temporary
// profile it created, on close() or at process exit.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BROWSER = process.env.BRAVE_PATH || 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

const owned = new Set();
const killTree = proc => {
  if (!proc.pid || proc.exitCode !== null || proc.signalCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  else proc.kill();
};
const removeProfile = profile => {
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 }); } catch {}
  if (existsSync(profile)) console.warn('Temporary browser profile not removed:', profile);
};
process.on('exit', () => { for (const o of owned) { killTree(o.proc); removeProfile(o.profile); } });
process.once('SIGINT', () => process.exit(130));

const KEYS = {
  Tab: [9, 'Tab'], Enter: [13, 'Enter'], Escape: [27, 'Escape'], ' ': [32, 'Space'], PageUp: [33, 'PageUp'], PageDown: [34, 'PageDown'],
  End: [35, 'End'], Home: [36, 'Home'], ArrowLeft: [37, 'ArrowLeft'], ArrowUp: [38, 'ArrowUp'], ArrowRight: [39, 'ArrowRight'], ArrowDown: [40, 'ArrowDown'],
  Delete: [46, 'Delete'], Backspace: [8, 'Backspace'], F2: [113, 'F2']
};

export async function launch({ width = 1440, height = 900 } = {}) {
  const port = 9800 + Math.floor(Math.random() * 150);
  const profile = mkdtempSync(join(tmpdir(), 'slotbook-cdp-'));
  const proc = spawn(BROWSER, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', '--hide-scrollbars=false', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  const own = { proc, profile }; owned.add(own);
  const exited = new Promise(r => { proc.once('exit', r); proc.once('error', r); });
  let target;
  for (let i = 0; i < 75 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page'); } catch { await sleep(200); }
  }
  if (!target) throw new Error('browser did not start');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let id = 0; const pending = new Map(); const listeners = [];
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) listeners.forEach(fn => fn(m));
  });
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

  // Console errors, uncaught exceptions and failed requests
  const problems = [];
  listeners.push(m => {
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'assert')) problems.push('console.' + m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown') problems.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') problems.push('log: ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
  });
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');

  const page = {
    send, problems,
    on: fn => listeners.push(fn),
    async size(w, h = 900) { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 700 }); },
    async goto(url, waitFor = 'document.documentElement.dataset.ready === "true"') {
      await send('Page.navigate', { url });
      for (let i = 0; i < 100; i++) { await sleep(100); try { if (await page.eval(waitFor)) break; } catch {} }
      await sleep(200);
    },
    async eval(expression) {
      const m = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (m.result?.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(m.result.exceptionDetails).slice(0, 500));
      return m.result?.result?.value;
    },
    // key('ArrowDown', { shift: true }) or key('z', { ctrl: true })
    async key(key, { shift = false, ctrl = false, alt = false } = {}) {
      const known = KEYS[key];
      const vk = known ? known[0] : key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0;
      const code = known ? known[1] : key.length === 1 ? (/[a-z]/i.test(key) ? 'Key' + key.toUpperCase() : /\d/.test(key) ? 'Digit' + key : '') : key;
      const modifiers = (alt ? 1 : 0) | (ctrl ? 2 : 0) | (shift ? 8 : 0);
      const base = { key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers };
      const printable = key.length === 1 && !ctrl && !alt;
      await send('Input.dispatchKeyEvent', { type: printable ? 'keyDown' : 'rawKeyDown', ...base, ...(printable ? { text: key } : {}) });
      if (key === 'Enter' && !ctrl) await send('Input.dispatchKeyEvent', { type: 'char', ...base, text: '\r' });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
      await sleep(50);
    },
    async mouse(type, x, y, { shift = false, clickCount = 1, buttons } = {}) {
      await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: buttons ?? (type === 'mouseReleased' ? 0 : 1), clickCount, modifiers: shift ? 8 : 0, pointerType: 'mouse' });
    },
    async center(selector, { scroll = true } = {}) {
      return page.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; if (${scroll}) el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, left: r.left, right: r.right }; })()`);
    },
    async click(selector, { shift = false, clickCount = 1 } = {}) {
      const box = await page.center(selector);
      if (!box) throw new Error('missing ' + selector);
      await sleep(60);
      const hit = await page.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); const h = document.elementFromPoint(${box.x}, ${box.y}); return !!h && (el === h || el.contains(h) || (el.labels && [...el.labels].some(l => l.contains(h)))); })()`);
      if (!hit) throw new Error('click target is covered or off screen: ' + selector);
      for (let n = 1; n <= clickCount; n++) {
        await page.mouse('mousePressed', box.x, box.y, { shift, clickCount: n });
        await page.mouse('mouseReleased', box.x, box.y, { shift, clickCount: n });
      }
      await sleep(120);
    },
    async type(text) { await send('Input.insertText', { text }); await sleep(60); },
    async screenshot(clip) {
      const r = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
      return Buffer.from(r.result.data, 'base64');
    },
    async close() {
      try { ws.close(); } catch {}
      killTree(proc);
      await Promise.race([exited, sleep(5000)]);
      removeProfile(profile); owned.delete(own);
    }
  };
  await page.size(width, height);
  return page;
}

export function checker(name) {
  const results = [];
  return {
    ok(cond, label, detail) { results.push({ pass: !!cond, label }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${!cond && detail !== undefined ? '  -> ' + JSON.stringify(detail) : ''}`); },
    results,
    done() {
      const failed = results.filter(r => !r.pass).length;
      console.log(`\n${name}: ${results.length - failed}/${results.length} passed`);
      return failed;
    }
  };
}
