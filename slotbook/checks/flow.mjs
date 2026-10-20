// End to end browser check through the DevTools Protocol in headless Brave.
// Usage: node checks/flow.mjs [baseUrl]   (serve this folder first, default http://127.0.0.1:8932/)
// The page clock is fixed with ?now= so dates and clock changes are known.
import { launch, checker, sleep } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] || 'http://127.0.0.1:8932/';
const NOW = '2026-10-20T03:00:00Z'; // Tuesday 20 October 2026, 10:00 in Chiang Mai
const URL0 = base + '?now=' + NOW;
const t = checker('Slotbook flow');
const p = await launch({ width: 1440, height: 900 });
const ev = e => p.eval(e);
const active = () => ev(`(() => { const a = document.activeElement; return a ? (a.dataset.date || a.id || a.tagName) : null; })()`);
const setZone = z => ev(`(() => { const s = document.getElementById('zone'); s.value = ${JSON.stringify(z)}; s.dispatchEvent(new Event('change')); })()`);
const slotTexts = () => ev(`[...document.querySelectorAll('#slots .slot')].map(b => b.querySelector('.t').textContent + '|' + (b.querySelector('.shop')?.textContent || ''))`);
const fill = (id, v) => ev(`(() => { const el = document.getElementById(${JSON.stringify(id)}); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
const stored = () => ev(`JSON.parse(localStorage.getItem('slotbook.v1'))`);

const tapCheck = `(() => {
  const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !el.closest('[hidden]'); };
  const els = [...document.querySelectorAll('button, select, input:not([type=radio]), textarea, a.btn, .svc, #cal-body td.day, [role=tab]')].filter(vis);
  return els.filter(el => { const r = el.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map(el => el.tagName + '#' + el.id + '.' + el.className + ' ' + Math.round(el.getBoundingClientRect().width) + 'x' + Math.round(el.getBoundingClientRect().height));
})()`;

try {
  // ---------- first load ----------
  await p.goto(URL0);
  await ev(`localStorage.clear()`);
  await p.goto(URL0);
  t.ok(await ev(`document.documentElement.dataset.ready === 'true'`), 'page loads and marks itself ready');
  t.ok((await ev(`document.querySelector('.sample-note').textContent`)).includes('fictional business'), 'sample notice says the business is fictional');
  const seeded = await stored();
  t.ok(seeded && seeded.bookings.length === 4, 'four sample bookings are seeded into localStorage', seeded?.bookings?.length);
  t.ok(await ev(`document.querySelector('#services input:checked').value`) === 'tuneup', 'tune-up is the default service');
  t.ok(await ev(`document.querySelectorAll('#changes li').length`) === 3, 'three changes to normal hours are listed');
  t.ok(await ev(`document.getElementById('cal-title').textContent`) === 'October 2026', 'calendar opens on October 2026');
  t.ok(await ev(`document.querySelector('#cal-body td[data-date="2026-10-19"]').getAttribute('aria-disabled')`) === 'true', 'past days are disabled');
  t.ok(await ev(`document.querySelector('#cal-body td[data-date="2026-10-26"]').getAttribute('aria-disabled')`) === 'true', 'Monday, the weekly closed day, is disabled');
  t.ok(await ev(`document.querySelector('#cal-body td[data-date="2026-10-28"]').getAttribute('aria-label')`) === 'Wednesday 28 October, closed for staff training', 'the closed override day says why in its label');
  t.ok(await ev(`document.querySelector('#cal-body td[data-date="2026-10-20"]').getAttribute('aria-current')`) === 'date', 'today has aria-current');

  // ---------- keyboard calendar ----------
  t.ok(await ev(`document.querySelectorAll('#cal-body td[tabindex="0"]').length`) === 1, 'one roving tabindex stop in the grid');
  await ev(`document.querySelector('#cal-body td[tabindex="0"]').focus()`);
  const start = await active();
  t.ok(start === '2026-10-20', 'roving focus starts on the first open day', start);
  await p.key('ArrowRight'); t.ok(await active() === '2026-10-21', 'ArrowRight moves one day');
  await p.key('ArrowDown'); t.ok(await active() === '2026-10-28', 'ArrowDown moves one week');
  await p.key('Home'); t.ok(await active() === '2026-10-26', 'Home moves to Monday');
  await p.key('End'); t.ok(await active() === '2026-11-01', 'End moves to Sunday and into November');
  t.ok(await ev(`document.getElementById('cal-title').textContent`) === 'November 2026', 'crossing into the next month redraws the grid');
  await p.key('PageUp'); t.ok(await active() === '2026-10-20', 'PageUp goes back a month, clamped to today');
  t.ok(await ev(`document.getElementById('cal-title').textContent`) === 'October 2026', 'PageUp redraws October');
  await p.key('ArrowLeft'); t.ok(await active() === '2026-10-20', 'ArrowLeft cannot go before today');
  await p.key('PageDown'); t.ok(await active() === '2026-11-17', 'PageDown is clamped to the last bookable day');
  await p.key('PageDown'); t.ok(await active() === '2026-11-17', 'PageDown past the window stays put');
  t.ok(await ev(`document.getElementById('cal-next').disabled`), 'next month button is disabled at the end of the window');
  t.ok(await ev(`document.querySelectorAll('#cal-body td[tabindex="0"]').length`) === 1, 'still one tab stop after month changes');
  await p.key('PageUp'); await p.key('Home');
  t.ok(await active() === '2026-10-20', 'Home cannot go before today either');
  await p.key('ArrowRight');
  const kd = await active();
  t.ok(kd === '2026-10-21', 'keyboard reaches Wednesday 21 October', kd);
  await p.key('Enter');
  t.ok(await ev(`document.querySelector('#cal-body td[data-date="2026-10-21"]').getAttribute('aria-selected')`) === 'true', 'Enter selects the focused day');
  t.ok(await active() === '2026-10-21', 'focus stays on the day after selecting');
  const wedSlots = await ev(`document.querySelectorAll('#slots .slot').length`);
  t.ok(wedSlots > 0, 'slots appear for the selected day', wedSlots);
  await p.key('ArrowRight'); await p.key(' ');
  t.ok(await ev(`document.querySelector('#cal-body td[data-date="2026-10-22"]').getAttribute('aria-selected')`) === 'true', 'Space also selects');
  t.ok(await ev(`document.querySelectorAll('#cal-body td[aria-selected="true"]').length`) === 1, 'only one day is selected');
  const live = await (async () => { await sleep(100); return ev(`document.getElementById('live').textContent`); })();
  t.ok(/open times? on Thursday 22 October/.test(live), 'selection is announced in the live region', live);

  // Seeded bookings and buffers are removed from availability
  const seededThu = seeded.bookings.filter(b => b.start >= Date.parse('2026-10-22T00:00:00+07:00') && b.start < Date.parse('2026-10-23T00:00:00+07:00'));
  const thuStarts = await ev(`[...document.querySelectorAll('#slots .slot')].map(b => +b.dataset.start)`);
  t.ok(seededThu.length > 0 && seededThu.every(b => !thuStarts.some(s => s < b.end + 15 * 60000 && s + 3600000 > b.start - 15 * 60000)), 'no tune-up slot overlaps a seeded booking or its 15 minute buffer');

  // Mouse, closed day and the next open day button
  await p.click('#cal-body td[data-date="2026-10-28"]');
  t.ok((await ev(`document.getElementById('slots').textContent`)).includes('No open times'), 'a closed day explains there are no times');
  await p.click('#next-open');
  t.ok(await ev(`document.querySelector('#cal-body td[aria-selected="true"]').dataset.date`) === '2026-10-29', 'the next open day button jumps to Thursday 29 October');
  const lateTimes = await slotTexts();
  t.ok(lateTimes.some(s => s.startsWith('19:00')), 'the late opening override adds evening times on 29 October', lateTimes.slice(-3));

  // ---------- time zones and clock changes ----------
  await setZone('Europe/London');
  t.ok((await ev(`document.getElementById('zone-note').textContent`)).includes('go back on Sunday 25 October'), 'London note mentions the 25 October clock change');
  await p.click('#cal-body td[data-date="2026-10-24"]');
  let s = await slotTexts();
  t.ok(s.includes('03:00|09:00 at the workshop'), 'Saturday 24 October: workshop 09:00 shows as 03:00 in London', s.slice(0, 3));
  await p.click('#cal-body td[data-date="2026-10-27"]');
  s = await slotTexts();
  t.ok(s.includes('02:00|09:00 at the workshop'), 'Tuesday 27 October: workshop 09:00 shows as 02:00 in London', s.slice(0, 3));
  await setZone('America/New_York');
  t.ok((await ev(`document.getElementById('zone-note').textContent`)).includes('go back on Sunday 1 November'), 'New York note mentions the 1 November clock change');
  await p.click('#cal-body td[data-date="2026-10-26"]');
  s = await slotTexts();
  t.ok(s.includes('22:00|Tue 09:00 at the workshop'), 'Monday 26 October in New York shows Tuesday workshop 09:00 as 22:00', s.slice(-3));
  await p.click('#cal-next');
  await p.click('#cal-body td[data-date="2026-11-02"]');
  s = await slotTexts();
  t.ok(s.includes('21:00|Tue 09:00 at the workshop'), 'Monday 2 November in New York shows Tuesday workshop 09:00 as 21:00 after the change', s.slice(-3));
  await setZone('Asia/Bangkok');
  t.ok(await ev(`document.getElementById('zone-note').hidden`), 'workshop zone hides the zone note');

  // ---------- booking flow ----------
  await p.click('#services input[value="puncture"]');
  t.ok(await ev(`document.querySelector('#services input:checked').value`) === 'puncture', 'service can be changed');
  await p.click('#cal-prev');
  await p.click('#cal-body td[data-date="2026-10-24"]');
  const firstSlot = await ev(`+document.querySelector('#slots .slot').dataset.start`);
  t.ok(firstSlot === Date.parse('2026-10-24T02:00:00Z'), 'first Saturday puncture slot is 09:00 workshop time');
  await p.click('#slots .slot');
  await sleep(900); // let the smooth scroll to the form finish
  t.ok(!(await ev(`document.getElementById('details').hidden`)), 'details form opens after picking a time');
  t.ok(await active() === 'h-details', 'focus moves to the details heading');
  t.ok((await ev(`document.getElementById('summary').textContent`)).includes('Saturday 24 October, 09:00 to 09:30'), 'summary shows the chosen time');

  await p.click('#submit');
  t.ok(!(await ev(`document.getElementById('errors').hidden`)), 'empty submit shows the error summary');
  t.ok(await active() === 'errors', 'focus moves to the error summary');
  t.ok(await ev(`document.querySelectorAll('#errors li').length`) === 4, 'four required fields are reported');
  t.ok(await ev(`document.getElementById('f-email').getAttribute('aria-invalid')`) === 'true', 'invalid fields get aria-invalid');
  await p.click('#errors a[href="#f-email"]');
  t.ok(await active() === 'f-email', 'an error link moves focus to its field');

  await fill('f-name', 'Sample Visitor');
  await fill('f-email', 'visitor@example');
  await fill('f-phone', '081 234 5678');
  await fill('f-bike', 'Road bike');
  await fill('f-notes', 'Slow leak, rear wheel; tubeless, valve may be loose.');
  await p.click('#submit');
  t.ok(await ev(`document.querySelectorAll('#errors li').length`) === 1 && (await ev(`document.getElementById('e-email').textContent`)).length > 0, 'a bad email is still refused');
  t.ok(!(await ev(`document.getElementById('f-name').hasAttribute('aria-invalid')`)), 'fixed fields lose aria-invalid');
  await fill('f-email', 'visitor@example.com');
  await p.click('#submit');
  t.ok(!(await ev(`document.getElementById('done').hidden`)), 'valid details confirm the booking');
  t.ok(await active() === 'h-done', 'focus moves to the confirmation heading');
  const ref = await ev(`document.querySelector('#done .ref .mono').textContent`);
  t.ok(/^SB-[A-Z0-9]{6}$/.test(ref), 'confirmation shows a booking reference', ref);

  const ics = await ev(`fetch(document.getElementById('ics').href).then(r => r.text())`);
  const icsMeta = await ev(`({ download: document.getElementById('ics').getAttribute('download'), href: document.getElementById('ics').href.slice(0, 5) })`);
  t.ok(icsMeta.download === `slotbook-${ref}.ics` && icsMeta.href === 'blob:', 'calendar link is a blob download named after the reference', icsMeta);
  t.ok(!/[^\r]\n/.test(ics) && ics.endsWith('\r\n'), 'downloaded ics uses CRLF line endings');
  t.ok(ics.split('\r\n').every(l => new TextEncoder().encode(l).length <= 75), 'every ics line is 75 octets or fewer');
  const unf = ics.replace(/\r\n[ \t]/g, '');
  t.ok(unf.includes('DTSTART:20261024T020000Z') && unf.includes('DTEND:20261024T023000Z'), 'ics DTSTART and DTEND are the booked times in UTC');
  t.ok(/\r\nUID:[^\r]+@sandersaxbuilds\.github\.io\r\n/.test(unf), 'ics has a UID');
  t.ok(unf.includes('Slow leak\\, rear wheel\\; tubeless\\, valve may be loose.'), 'ics escapes commas and semicolons in notes');
  writeFileSync(join(here, 'sample-booking.ics'), ics);

  const after = await stored();
  t.ok(after.bookings.length === 5 && after.bookings.some(b => b.ref === ref && b.start === firstSlot), 'new booking is saved to localStorage');

  await p.click('#again');
  t.ok(!(await ev(`document.getElementById('book').hidden`)) && await ev(`document.getElementById('details').hidden`), 'book another returns to the picker');
  t.ok(!(await ev(`[...document.querySelectorAll('#slots .slot')].some(b => +b.dataset.start === ${firstSlot})`)), 'the booked time is gone straight away');

  await p.goto(URL0);
  await p.click('#services input[value="puncture"]');
  await p.click('#cal-body td[data-date="2026-10-24"]');
  const afterReload = await ev(`[...document.querySelectorAll('#slots .slot')].map(b => +b.dataset.start)`);
  t.ok(!afterReload.includes(firstSlot), 'after a reload the booked time is still unavailable');
  t.ok(!afterReload.includes(firstSlot + 30 * 60000) && afterReload.includes(firstSlot + 60 * 60000), 'buffer removes 09:30 but 10:00 is free again');

  // ---------- staff view ----------
  await ev(`document.getElementById('tab-book').focus()`);
  await p.key('ArrowRight');
  t.ok(!(await ev(`document.getElementById('panel-staff').hidden`)) && await active() === 'tab-staff', 'ArrowRight on the tabs opens the staff view');
  t.ok(await ev(`document.getElementById('tab-staff').getAttribute('aria-selected')`) === 'true', 'staff tab is marked selected');
  const firstStaffDay = await ev(`document.getElementById('staff-date').textContent`);
  t.ok(firstStaffDay === 'Wednesday 21 October', 'staff view opens on the next day with bookings', firstStaffDay);
  for (let i = 0; i < 3; i++) await p.click('#staff-next');
  t.ok(await ev(`document.getElementById('staff-date').textContent`) === 'Saturday 24 October', 'staff can step to Saturday');
  t.ok((await ev(`document.getElementById('staff-list').textContent`)).includes('Sample Visitor'), 'the new booking is listed for the day');
  t.ok((await ev(`document.getElementById('staff-hours').textContent`)) === 'Open 09:00 to 16:00.', 'staff view shows the opening hours');
  await p.click(`#staff-list [data-cancel]`);
  t.ok(await active() === 'BUTTON' && await ev(`!!document.activeElement.dataset.keep`), 'cancel asks for confirmation with focus on Keep');
  await p.click(`#staff-list [data-keep]`);
  t.ok(await ev(`!!document.querySelector('#staff-list [data-cancel]')`), 'Keep leaves the booking alone');
  await p.click(`#staff-list [data-cancel]`);
  await p.click(`#staff-list [data-confirm]`);
  t.ok((await ev(`document.getElementById('staff-list').textContent`)).includes('Cancelled'), 'confirmed cancel marks the booking cancelled');
  const cancelled = (await stored()).bookings.find(b => b.ref === ref);
  t.ok(cancelled.status === 'cancelled', 'cancellation is saved to localStorage');
  await p.click('#staff-today');
  t.ok(await ev(`document.getElementById('staff-date').textContent`) === 'Tuesday 20 October', 'Today button returns to today');
  await p.click('#tab-book');
  await p.click('#services input[value="puncture"]');
  await p.click('#cal-body td[data-date="2026-10-24"]');
  t.ok(await ev(`[...document.querySelectorAll('#slots .slot')].some(b => +b.dataset.start === ${firstSlot})`), 'the cancelled time is bookable again');

  await p.click('#tab-staff');
  await p.click('#reset');
  await p.click('#reset');
  t.ok((await stored()).bookings.length === 4, 'reset restores the four sample bookings');

  // ---------- focus ring, tap targets, reduced motion ----------
  await p.click('#tab-book');
  await ev(`document.getElementById('zone').focus()`);
  await p.key('Tab');
  const ring = await ev(`(() => { const a = document.activeElement; const s = getComputedStyle(a); return { id: a.id, fv: a.matches(':focus-visible'), w: s.outlineWidth, st: s.outlineStyle }; })()`);
  t.ok(ring.fv && ring.st === 'solid' && ring.w === '3px', 'keyboard focus shows a 3px focus ring', ring);
  for (const w of [320, 390, 768, 1440]) {
    await p.size(w, 900);
    await p.goto(URL0 + '&w=' + w);
    await p.click('#cal-body td.open');
    await p.click('#slots .slot');
    const small = await ev(tapCheck);
    t.ok(small.length === 0, `tap targets are at least 44 by 44 at ${w}`, small.slice(0, 5));
    const o = await ev(`({ cw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth })`);
    t.ok(o.sw <= o.cw, `no horizontal overflow at ${w}`, o);
  }
  await p.size(1440, 900);
  await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await p.goto(URL0);
  const motion = await ev(`({ rm: matchMedia('(prefers-reduced-motion: reduce)').matches, t: getComputedStyle(document.querySelector('.svc')).transitionDuration })`);
  t.ok(motion.rm && motion.t === '0s', 'reduced motion removes transitions', motion);
  await p.send('Emulation.setEmulatedMedia', { features: [] });

  t.ok(p.problems.length === 0, 'no console errors, exceptions or failed requests', p.problems);
} finally {
  await p.close();
}

// ---------- storage that throws ----------
const q = await launch({ width: 390, height: 844 });
try {
  await q.send('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });` });
  await q.goto(URL0);
  t.ok(await q.eval(`(() => { try { localStorage; return false; } catch { return true; } })()`), 'localStorage access really throws in this tab');
  t.ok(await q.eval(`document.documentElement.dataset.ready === 'true'`), 'page still loads when localStorage throws');
  await q.click('#cal-body td.open');
  await q.click('#slots .slot');
  await sleep(900);
  await q.eval(`(() => { const f = (id, v) => { const el = document.getElementById(id); el.value = v; }; f('f-name', 'No Storage'); f('f-email', 'n@example.com'); f('f-phone', '0812345678'); f('f-bike', 'Other'); })()`);
  await q.click('#submit');
  t.ok(!(await q.eval(`document.getElementById('done').hidden`)), 'booking still completes without storage');
  t.ok(q.problems.length === 0, 'no console errors without storage', q.problems);
} finally {
  await q.close();
}

const failed = t.done();
writeFileSync(join(here, 'flow-results.json'), JSON.stringify({ ranAt: new Date().toISOString(), base, now: NOW, results: t.results }, null, 1));
process.exit(failed ? 1 : 0);
