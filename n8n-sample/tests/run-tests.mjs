// Runs every case against the real local n8n and mock services and writes TESTS.md.
// Nothing here is simulated inside n8n. Faults are real HTTP responses from the mock.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, N8N, signIn, rest, personalProjectId, tableIds, allRows, wipeTable, mockState, mockReset, mockFault, sleep } from '../scripts/lib.mjs';

const run = Date.now().toString(36);
await signIn();
const projectId = await personalProjectId();
const tables = await tableIds(projectId);
const only = process.argv[2] ? process.argv[2].split(',') : null;
for (const id of Object.values(tables)) {
  const r = await wipeTable(projectId, id);
  if (r.status !== 200) throw new Error('wipe failed ' + JSON.stringify(r.json).slice(0, 200));
}

const results = [];
const mail = (tag) => `${tag}.${run}@example.com`;
const lead = (tag, over = {}) => ({
  name: `Test ${tag}`,
  email: mail(tag),
  phone: '',
  service: 'roof repair',
  message: 'Roof leak over the kitchen, need a fix this week',
  budget: '$1,500',
  ...over,
});

async function post(body, raw = false) {
  const res = await fetch(`${N8N}/webhook/lead-intake`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: raw ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

const rows = (name) => allRows(projectId, tables[name]);
const leadRow = async (email) => (await rows('leads')).find((r) => r.email === email);
const dlRows = async (leadId) => (await rows('dead_letters')).filter((r) => r.lead_id === leadId);

async function waitLead(email, statuses, ms = 40000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const r = await leadRow(email);
    if (r && statuses.includes(r.status)) return r;
    await sleep(300);
  }
  return (await leadRow(email)) ?? null;
}

const settle = (ms = 900) => sleep(ms);

const requests = (s, leadId) => s.requests.filter((r) => r.path.endsWith(leadId));
const gaps = (list) => list.slice(1).map((r, i) => ((new Date(r.at) - new Date(list[i].at)) / 1000).toFixed(1) + 's');
const messagesTo = (s, email) => s.messages.filter((m) => m.to === email);
const crmBy = (s, leadId) => s.crm.filter((r) => r.leadId === leadId);

async function replay(body = {}) {
  const res = await fetch(`${N8N}/webhook/lead-replay`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const allowReplay = (id) =>
  rest('PATCH', `/rest/projects/${projectId}/data-tables/${tables.dead_letters}/rows`, {
    filter: { type: 'and', filters: [{ columnName: 'dead_letter_id', condition: 'eq', value: id }] },
    data: { retryable: true },
  });

async function test(id, title, required, fn) {
  if (only && !only.includes(id)) return;
  await mockReset();
  const checks = [];
  const notes = [];
  const check = (label, ok, seen) => checks.push({ label, ok: Boolean(ok), seen: seen === undefined ? '' : String(seen) });
  const started = Date.now();
  try {
    await fn(check, (n) => notes.push(n));
  } catch (e) {
    checks.push({ label: 'test ran to the end', ok: false, seen: e.message });
  }
  const pass = checks.length > 0 && checks.every((c) => c.ok);
  results.push({ id, title, required, pass, checks, notes, seconds: ((Date.now() - started) / 1000).toFixed(1) });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${title}`);
  for (const c of checks.filter((x) => !x.ok)) console.log('   failed:', c.label, '=>', c.seen);
}

await test('T1', 'Happy path', true, async (check, note) => {
  const b = lead('happy', { phone: '+1 (415) 555-0101', email: `Mixed.Case.${run}@Example.com` });
  const r = await post(b);
  check('webhook answers 202 accepted', r.status === 202 && r.json.status === 'accepted', `${r.status} ${JSON.stringify(r.json)}`);
  const row = await waitLead(b.email.toLowerCase(), ['completed']);
  await settle();
  const s = await mockState();
  check('lead row ends completed', row?.status === 'completed', row?.status);
  check('email normalised to lower case', row?.email === b.email.toLowerCase(), row?.email);
  check('phone normalised', row?.phone === '+14155550101', row?.phone);
  check('qualified by the model', row?.qualified_by === 'model', `${row?.qualified_by}, tier ${row?.tier}, score ${row?.score}`);
  check('one CRM record', crmBy(s, row.lead_id).length === 1, crmBy(s, row.lead_id).map((c) => c.crmId).join());
  check('one follow-up message', s.messages.length === 1, s.messages.map((m) => m.id).join());
  check('team notified', s.notifications.length === 1, s.notifications.length);
  check('no alerts', s.alerts.length === 0, s.alerts.length);
  const ledger = (await rows('followup_ledger')).find((l) => l.lead_id === row.lead_id);
  check('ledger key marked sent', ledger?.status === 'sent', `${ledger?.idempotency_key} ${ledger?.status}`);
  note(`Budget string "$1,500" became ${s.crm[0].budgetUsd}.`);
});

await test('T2', 'Malformed input', true, async (check) => {
  const cases = [
    ['no contact route', { name: 'No Contact', message: 'hello there, please call me back' }],
    ['bad email', { name: 'Bad Mail', email: 'not-an-email', message: 'hello there, please call me back' }],
    ['array body', [1, 2, 3]],
  ];
  for (const [label, body] of cases) {
    const r = await post(body);
    check(`${label}: 422 with reason`, r.status === 422 && r.json.status === 'rejected', `${r.status} ${JSON.stringify(r.json.problems)}`);
  }
  const broken = await post('{"name": "broken json"', true);
  check('broken JSON body gets a client error', broken.status >= 400 && broken.status < 500, `${broken.status} ${JSON.stringify(broken.json).slice(0, 120)}`);
  await settle();
  const s = await mockState();
  check('nothing reached model, CRM or messaging', s.requests.length === 0, `${s.requests.length} requests`);
  const logged = (await rows('dead_letters')).filter((r) => r.status === 'rejected');
  check('rejections are logged for review', logged.length >= 3, `${logged.length} rejected rows in total`);
});

await test('T3', 'Duplicate lead', true, async (check, note) => {
  const b = lead('dup', { phone: '+1 415 555 0103' });
  await post(b);
  const row = await waitLead(b.email, ['completed']);
  const again = await post(b);
  check('same lead resubmitted answers 200 duplicate', again.status === 200 && again.json.status === 'duplicate', `${again.status} ${JSON.stringify(again.json)}`);
  const upper = await post({ ...b, email: b.email.toUpperCase() });
  check('same email in another case is a duplicate', upper.json.status === 'duplicate', upper.json.status);
  const phoneOnly = await post({ ...b, email: mail('dup-other'), phone: '(415) 555 0103', name: 'Same Phone' });
  check('new email, same phone is a duplicate', phoneOnly.json.status === 'duplicate', phoneOnly.json.status);
  await settle();
  const s = await mockState();
  const aiCalls = s.requests.filter((r) => r.path.includes('/ai/')).length;
  check('model called once', aiCalls === 1, aiCalls);
  check('CRM written once', crmBy(s, row.lead_id).length === 1 && crmBy(s, row.lead_id)[0].version === 1, `version ${crmBy(s, row.lead_id)[0]?.version}`);
  check('one message', s.messages.length === 1, s.messages.length);
  note('Dedupe runs before the model, so a duplicate costs no model call.');
});

await test('T4', 'CRM 500 then recovery', true, async (check, note) => {
  await mockFault('crm', [{ status: 500, times: 2 }]);
  const b = lead('crm500');
  const r = await post(b);
  check('form gets 202 straight away', r.status === 202, r.status);
  const row = await waitLead(b.email, ['completed', 'dead_letter']);
  await settle();
  const s = await mockState();
  const calls = requests(s, row.lead_id);
  const g = gaps(calls);
  check('three CRM attempts: 500, 500, 201', calls.map((c) => c.status).join() === '500,500,201', calls.map((c) => c.status).join());
  check('backoff grew between attempts', g.length === 2 && parseFloat(g[1]) > parseFloat(g[0]), g.join(', '));
  check('lead completed', row.status === 'completed', row.status);
  check('one CRM record, one message', crmBy(s, row.lead_id).length === 1 && s.messages.length === 1, `${crmBy(s, row.lead_id).length}, ${s.messages.length}`);
  const dl = await dlRows(row.lead_id);
  check('no dead letter, no alert', dl.length === 0 && s.alerts.length === 0, `${dl.length}, ${s.alerts.length}`);
  note(`Observed wait between attempts: ${g.join(', ')}.`);
});

await test('T5', 'CRM permanent 400', true, async (check, note) => {
  await mockFault('crm', [{ status: 400, body: { error: 'validation_failed', field: 'service' }, times: 1 }]);
  const b = lead('crm400');
  await post(b);
  const row = await waitLead(b.email, ['dead_letter', 'completed']);
  await settle(1500);
  let s = await mockState();
  const calls = requests(s, row.lead_id);
  check('exactly one CRM attempt, no retry', calls.length === 1 && calls[0].status === 400, calls.map((c) => c.status).join());
  check('lead marked dead_letter', row.status === 'dead_letter', row.status);
  const [dl] = await dlRows(row.lead_id);
  check('dead letter row written', dl?.error_class === 'permanent' && dl?.retryable === false && dl?.status === 'open', `${dl?.dead_letter_id}, ${dl?.error_class}, retryable ${dl?.retryable}`);
  check('dead letter keeps the original payload', JSON.parse(dl?.payload || '{}').email === b.email, dl?.payload?.slice(0, 60));
  check('operator alerted', s.alerts.length === 1 && s.alerts[0].severity === 'action_needed' && dl.alert_status === 'sent', `${s.alerts[0]?.severity}, ${dl?.alert_status}`);
  check('no follow-up sent', s.messages.length === 0, s.messages.length);
  note(`Alert text: ${s.alerts[0]?.action}`);

  const blocked = await replay({});
  await settle(1200);
  s = await mockState();
  check('replay skips a permanent failure until a person clears it', s.crm.length === 0, `${JSON.stringify(blocked.json)}, CRM records ${s.crm.length}`);

  const patched = await allowReplay(dl.dead_letter_id);
  check('operator clears it in the table', patched.status === 200, patched.status);
  await replay({});
  const done = await waitLead(b.email, ['completed']);
  await settle();
  s = await mockState();
  const [after] = await dlRows(row.lead_id);
  check('replay then completes the lead', done?.status === 'completed' && after.status === 'resolved', `${done?.status}, dead letter ${after.status}`);
  check('one CRM record, one message after recovery', crmBy(s, row.lead_id).length === 1 && s.messages.length === 1, `${crmBy(s, row.lead_id).length}, ${s.messages.length}`);
});

await test('T6', 'AI failure uses fixed rules', true, async (check, note) => {
  const variants = [
    ['model 503 twice', 'a', [{ status: 503, times: 2 }]],
    ['model hangs past the timeout', 'b', [{ hang: true, times: 2 }]],
    ['model answers text, not JSON', 'c', [{ garbage: true, times: 2 }]],
    ['model JSON fails the schema', 'd', [{ status: 200, body: { choices: [{ message: { content: '{"tier":"platinum","score":900}' } }] }, times: 1 }]],
  ];
  for (const [label, tag, faults] of variants) {
    await mockReset();
    await mockFault('ai', faults);
    const b = lead(`ai${tag}`);
    const r = await post(b);
    const row = await waitLead(b.email, ['completed', 'dead_letter'], 30000);
    await settle(500);
    const s = await mockState();
    const crm = crmBy(s, row?.lead_id)[0];
    check(`${label}: lead completed on fixed rules`, r.status === 202 && row?.status === 'completed' && row?.qualified_by === 'fixed_rules', `${row?.status}, ${row?.qualified_by}, tier ${row?.tier}, score ${row?.score}`);
    check(`${label}: CRM record says why`, /fixed rules used/.test(crm?.qualificationReason || ''), crm?.qualificationReason);
    check(`${label}: message still sent once`, s.messages.length === 1, s.messages.length);
  }
  note('The model node retries once, so one bad reply followed by a good one simply uses the good one. These faults hit both tries.');
  note('A failed model call is not a dead letter. The lead keeps moving, and the CRM record shows the rules were used.');
});

await test('T7', 'CRM down for the whole retry window, then replay', false, async (check, note) => {
  await mockFault('crm', [{ status: 503, times: 4 }]);
  const b = lead('crmdown');
  await post(b);
  const row = await waitLead(b.email, ['dead_letter'], 40000);
  await settle(1500);
  let s = await mockState();
  const calls = requests(s, row.lead_id);
  check('four attempts then stop', calls.map((c) => c.status).join() === '503,503,503,503', calls.map((c) => c.status).join());
  const [dl] = await dlRows(row.lead_id);
  check('dead letter is retryable', dl?.error_class === 'temporary' && dl?.retryable === true && dl?.attempts === 4, `${dl?.error_class}, retryable ${dl?.retryable}, attempts ${dl?.attempts}`);
  check('operator alerted once', s.alerts.length === 1 && s.alerts[0].severity === 'warning', s.alerts.length);
  const again = await post(b);
  check('a plain resubmission does not restart a dead letter', again.json.status === 'duplicate', again.json.status);
  await replay({});
  const done = await waitLead(b.email, ['completed']);
  await settle();
  s = await mockState();
  const [after] = await dlRows(row.lead_id);
  check('replay completes the lead', done?.status === 'completed' && after.status === 'resolved', `${done?.status}, ${after.status}`);
  check('one record, one message', crmBy(s, row.lead_id).length === 1 && s.messages.length === 1, `${crmBy(s, row.lead_id).length}, ${s.messages.length}`);
  note(`Observed wait between attempts: ${gaps(calls).join(', ')}.`);
});

await test('T8', 'Rate limit 429 honours Retry-After', false, async (check, note) => {
  await mockFault('crm', [{ status: 429, retryAfter: 5, times: 1 }]);
  const b = lead('ratelimit');
  await post(b);
  const row = await waitLead(b.email, ['completed', 'dead_letter']);
  await settle();
  const s = await mockState();
  const calls = requests(s, row.lead_id);
  check('429 then 201', calls.map((c) => c.status).join() === '429,201', calls.map((c) => c.status).join());
  check('waited at least the 5 seconds the provider asked for', parseFloat(gaps(calls)[0]) >= 5, gaps(calls)[0]);
  note(`Default first backoff is 2 seconds, observed ${gaps(calls)[0]}.`);
});

await test('T9', 'Thin submission goes to review', false, async (check) => {
  const b = { email: mail('thin'), message: 'hi' };
  const r = await post(b);
  check('202 needs_review with reasons', r.status === 202 && r.json.status === 'needs_review', `${r.status} ${JSON.stringify(r.json.problems)}`);
  await settle();
  const row = await leadRow(b.email);
  const s = await mockState();
  check('stored as needs_review', row?.status === 'needs_review', row?.status);
  check('no model, CRM or message', s.requests.length === 0, s.requests.length);
  const full = await post(lead('thin'));
  check('the same person sending full details is processed', full.json.status === 'accepted', full.json.status);
  const done = await waitLead(b.email, ['completed']);
  check('then completes', done?.status === 'completed', done?.status);
});

await test('T10', 'Send accepted, reply lost, no double send', false, async (check, note) => {
  await mockFault('message', [{ acceptThenFail: true, times: 1 }]);
  const b = lead('lostreply');
  await post(b);
  const row = await waitLead(b.email, ['completed', 'dead_letter']);
  await settle();
  const s = await mockState();
  const sends = s.requests.filter((r) => r.path === '/messages/send');
  check('two calls: 502, then replay answer', sends.map((c) => c.status).join() === '502,200', sends.map((c) => `${c.status}${c.note ? ' (' + c.note + ')' : ''}`).join(', '));
  check('only one message exists', messagesTo(s, b.email).length === 1, messagesTo(s, b.email).length);
  check('provider saw the same key twice', s.messageReplays.length === 1, s.messageReplays[0]?.key);
  check('lead completed', row.status === 'completed', row.status);
  note('This is the worst case for double sends. The retry reuses the key, so the provider answers without sending.');
});

await test('T11', 'Two identical submissions at the same moment', false, async (check, note) => {
  const b = lead('race');
  const [x, y] = await Promise.all([post(b), post(b)]);
  await sleep(4000);
  const row = await leadRow(b.email);
  const s = await mockState();
  check('still one message', messagesTo(s, b.email).length === 1, messagesTo(s, b.email).length);
  check('still one CRM record', crmBy(s, row.lead_id).length === 1, `${crmBy(s, row.lead_id).length} record, version ${crmBy(s, row.lead_id)[0]?.version}`);
  note(`Answers: ${x.json.status}, ${y.json.status}. Provider replays absorbed: ${s.messageReplays.length}.`);
});

await test('T12', 'Interrupted execution, n8n killed mid retry', false, async (check, note) => {
  await mockFault('crm', [{ status: 500, times: 1 }]);
  const b = lead('killed');
  await post(b);
  await sleep(900);
  const res = spawnSync('bash', [path.join(ROOT, 'scripts/ctl.sh'), 'restart-n8n'], { stdio: 'ignore' });
  check('n8n was killed and restarted', res.status === 0, res.status);
  await signIn();
  const row = await waitLead(b.email, ['dead_letter'], 30000);
  await settle(1500);
  const [dl] = await dlRows(row.lead_id);
  let s = await mockState();
  check('n8n recovery fires the Error Handler', row?.status === 'dead_letter' && dl?.stage === 'unhandled', `${row?.status}, ${dl?.dead_letter_id}`);
  check('classed as interrupted and safe to replay', dl?.error_class === 'interrupted' && dl?.retryable === true, `${dl?.error_class}, retryable ${dl?.retryable}`);
  check('operator alerted', s.alerts.length === 1 && s.alerts[0].severity === 'warning', s.alerts[0]?.action);
  const r = await replay({});
  const done = await waitLead(b.email, ['completed']);
  await settle();
  s = await mockState();
  const [after] = await dlRows(row.lead_id);
  check('replay finishes the lead', done?.status === 'completed' && after.status === 'resolved', `${JSON.stringify(r.json)}, ${done?.status}, ${after.status}`);
  check('one CRM record, one message', crmBy(s, row.lead_id).length === 1 && messagesTo(s, b.email).length === 1, `${crmBy(s, row.lead_id).length}, ${messagesTo(s, b.email).length}`);
  note(`CRM calls seen: ${requests(s, row.lead_id).map((c) => c.status).join(', ')}. The first 500 was before the kill, n8n then recovered the run as crashed.`);
});

await test('T13', 'Unexpected failure reaches the Error Handler', false, async (check) => {
  await mockFault('crm', [{ status: 200, body: { note: 'no id here' }, times: 1 }]);
  const b = lead('contract');
  await post(b);
  const row = await waitLead(b.email, ['dead_letter', 'completed']);
  await settle(1500);
  const s = await mockState();
  check('lead marked dead_letter', row?.status === 'dead_letter', row?.status);
  const [dl] = await dlRows(row.lead_id);
  check('error workflow found the lead by execution id', dl?.stage === 'unhandled' && dl?.dead_letter_id === `${row.lead_id}:unhandled`, dl?.dead_letter_id);
  check('reason names the failing node', /Stop - CRM Contract Broken/.test(dl?.reason || ''), dl?.reason);
  check('operator alerted', s.alerts.length === 1 && s.alerts[0].severity === 'action_needed', s.alerts.length);
  check('no message sent', s.messages.length === 0, s.messages.length);
});

await test('T14', 'Alert channel down', false, async (check, note) => {
  await mockFault('crm', [{ status: 400, times: 1 }]);
  await mockFault('alert', [{ status: 500, times: 3 }]);
  const b = lead('alertdown');
  await post(b);
  await waitLead(b.email, ['dead_letter']);
  await sleep(4500);
  const row = await leadRow(b.email);
  const [dl] = await dlRows(row.lead_id);
  const s = await mockState();
  const tries = s.requests.filter((r) => r.path === '/alerts').length;
  check('three alert tries', tries === 3, tries);
  check('dead letter survives and is flagged', dl?.status === 'open' && dl?.alert_status === 'failed', `${dl?.status}, ${dl?.alert_status}`);
  note('The record is written before the alert, so a dead alert channel cannot lose a failed lead.');
});

await test('T15', 'Follow-up permanent failure resumes after the CRM step', false, async (check) => {
  await mockFault('message', [{ status: 422, body: { error: 'bad_recipient' }, times: 1 }]);
  const b = lead('msg422');
  await post(b);
  const row = await waitLead(b.email, ['dead_letter', 'completed']);
  await settle(1500);
  let s = await mockState();
  const [dl] = await dlRows(row.lead_id);
  check('dead letter at the follow-up stage', dl?.stage === 'followup' && dl?.error_class === 'permanent', `${dl?.stage}, ${dl?.error_class}`);
  check('CRM record already stored', row.crm_id !== '' && s.crm.length === 1, row.crm_id);
  await allowReplay(dl.dead_letter_id);
  await replay({});
  const done = await waitLead(b.email, ['completed']);
  await settle();
  s = await mockState();
  const aiCalls = s.requests.filter((r) => r.path.includes('/ai/')).length;
  check('replay finishes it', done?.status === 'completed', done?.status);
  check('CRM not written again, model not called again', s.crm[0].version === 1 && aiCalls === 1, `version ${s.crm[0].version}, model calls ${aiCalls}`);
  check('one message', messagesTo(s, b.email).length === 1, messagesTo(s, b.email).length);
});

await test('T16', 'Cold or opted out leads get no message', false, async (check) => {
  const cold = lead('cold', { message: 'Just looking at options for later on', budget: '', service: 'general' });
  await post(cold);
  const a = await waitLead(cold.email, ['completed']);
  const out = lead('optout', { contact_ok: false });
  await post(out);
  const c = await waitLead(out.email, ['completed']);
  await settle();
  const s = await mockState();
  check('cold lead stored in CRM', a?.tier === 'cold' && crmBy(s, a.lead_id).length === 1, a?.tier);
  check('opted out lead stored in CRM', crmBy(s, c.lead_id).length === 1, c?.tier);
  check('neither was contacted', s.messages.length === 0, s.messages.length);
});

await test('T17', 'Team notification failure does not fail the lead', false, async (check) => {
  await mockFault('notify', [{ status: 500, times: 1 }]);
  const b = lead('notify');
  await post(b);
  const row = await waitLead(b.email, ['completed', 'dead_letter']);
  await settle();
  const s = await mockState();
  const dl = await dlRows(row.lead_id);
  check('lead completed anyway', row?.status === 'completed', row?.status);
  check('no dead letter', dl.length === 0, dl.length);
  check('message still sent once', s.messages.length === 1, s.messages.length);
});

await test('T18', 'Lead stuck in processing with no recovery event', false, async (check, note) => {
  const b = lead('stuck');
  const leadId = 'lead_stuck_' + run;
  const inserted = await rest('POST', `/rest/projects/${projectId}/data-tables/${tables.leads}/insert`, {
    returnType: 'id',
    data: [{ lead_id: leadId, email: b.email, phone: '', name: b.name, status: 'processing', stage: 'qualify', crm_id: '', payload: JSON.stringify(b) }],
  });
  check('row planted as a half finished lead', inserted.status === 200, inserted.status);
  const dup = await post(b);
  check('a plain resubmission does not start a second run', dup.json.status === 'duplicate', dup.json.status);
  const r = await replay({ staleMinutes: 0 });
  const done = await waitLead(b.email, ['completed']);
  await settle();
  const s = await mockState();
  check('sweep finds it and finishes it', done?.status === 'completed' && r.json.replayed === 1, `${JSON.stringify(r.json)}, ${done?.status}`);
  check('one CRM record, one message', crmBy(s, leadId).length === 1 && messagesTo(s, b.email).length === 1, `${crmBy(s, leadId).length}, ${messagesTo(s, b.email).length}`);
  note('The row was inserted by the test to stand in for a run that vanished without n8n recording it. T12 covers the real kill.');
});

/* report */
const execs = await rest('GET', '/rest/executions?limit=1');
const passed = results.filter((r) => r.pass).length;
const lines = [];
lines.push('# Test results');
lines.push('');
lines.push(`Sample build, not a client job. All cases ran against a real local n8n 2.46.6 on ${new Date().toISOString()}, driven by tests/run-tests.mjs. CRM, model, messaging and alert endpoints are the local mock in mock/server.mjs, and every fault is a real HTTP response from that mock.`);
lines.push('');
lines.push(`Result: ${passed} of ${results.length} cases passed, ${results.reduce((n, r) => n + r.checks.length, 0)} checks in total. Executions recorded by n8n in this instance: ${execs.json.data?.count ?? 'unknown'}.`);
lines.push('');
lines.push('| Case | Result | Time |');
lines.push('|---|---|---|');
for (const r of results) lines.push(`| ${r.id} ${r.title}${r.required ? '' : ' (extra)'} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.seconds}s |`);
lines.push('');
for (const r of results) {
  lines.push(`## ${r.id} ${r.title}${r.required ? '' : ' (extra)'}: ${r.pass ? 'PASS' : 'FAIL'}`);
  lines.push('');
  for (const c of r.checks) lines.push(`- ${c.ok ? 'ok' : 'FAILED'}, ${c.label}${c.seen !== '' ? `. Observed: \`${c.seen.replace(/`/g, "'").replace(/\|/g, '/')}\`` : ''}`);
  for (const n of r.notes) lines.push(`- Note: ${n}`);
  lines.push('');
}
if (!only) fs.writeFileSync(path.join(ROOT, 'TESTS.md'), lines.join('\n'), 'utf8');
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
