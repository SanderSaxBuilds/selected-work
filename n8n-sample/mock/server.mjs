// MOCK SERVICES, local only. Not a real CRM, model, messaging or alert provider.
// One process stands in for the four outside systems the workflow talks to,
// so failures can be produced on demand as real HTTP responses.
//
//   PUT  /crm/leads/:leadId           mock CRM, upsert by external id
//   POST /ai/v1/chat/completions      mock model, OpenAI style reply shape
//   POST /messages/send               mock messaging provider, honours Idempotency-Key
//   POST /alerts                      mock operator alert sink
//   POST /notify                      mock team notification sink
//
//   GET  /                            mock console page
//   GET  /__state                     everything recorded so far
//   POST /__fault                     queue faults, { service, faults: [...] }
//   POST /__reset                     clear state and faults
//
// A fault is one of:
//   { status: 500, times: 2 }                 answer 500 twice, then behave
//   { status: 429, retryAfter: 1, times: 1 }  rate limit with Retry-After
//   { status: 400, body: {...}, times: 99 }   permanent rejection
//   { hang: true, times: 1 }                  never answer, the caller times out
//   { garbage: true, times: 1 }               200 with a body that is not JSON
//   { status: 200, body: {...}, times: 1 }    200 with a body that breaks the contract
//   { acceptThenFail: true, times: 1 }        messaging only, the send happens, the reply is lost

import http from 'node:http';

const PORT = Number(process.env.MOCK_PORT || 4010);

const blank = () => ({
  crm: new Map(),
  messages: [],
  messageReplays: [],
  idempotency: new Map(),
  alerts: [],
  notifications: [],
  requests: [],
});
let state = blank();
let faults = { crm: [], ai: [], message: [], alert: [], notify: [] };
let crmSeq = 0;
let msgSeq = 0;

const send = (res, status, body, headers = {}) => {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': typeof body === 'string' && text.startsWith('<') ? 'text/html; charset=utf-8' : 'application/json',
    ...headers,
  });
  res.end(text);
};

const readBody = (req) =>
  new Promise((resolve) => {
    const parts = [];
    req.on('data', (c) => parts.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(parts).toString('utf8');
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({ __unparseable: raw });
      }
    });
  });

// Returns true when a fault consumed the request.
function applyFault(service, res, log) {
  const f = faults[service][0];
  if (!f) return false;
  f.times = (f.times ?? 1) - 1;
  if (f.times <= 0) faults[service].shift();
  if (f.hang) {
    log.status = 'hang';
    return true;
  }
  if (f.garbage) {
    log.status = 200;
    log.note = 'garbage body';
    send(res, 200, 'this is not json, the model went sideways');
    return true;
  }
  log.status = f.status;
  log.note = 'injected fault';
  const headers = f.retryAfter ? { 'retry-after': String(f.retryAfter) } : {};
  send(res, f.status, f.body ?? { error: 'mock_fault', status: f.status }, headers);
  return true;
}

// Deterministic stand-in for a model, so test runs compare cleanly.
function mockModelReply(prompt) {
  const text = String(prompt).toLowerCase();
  const budget = Number((text.match(/budget(?:_usd)?["\s:=]+(\d+)/) || [])[1] || 0);
  const urgent = /urgent|this week|asap|leak|broken/.test(text);
  let score = 30;
  if (budget >= 1000) score += 40;
  else if (budget >= 300) score += 20;
  if (urgent) score += 20;
  const tier = score >= 70 ? 'hot' : score >= 45 ? 'warm' : 'cold';
  return JSON.stringify({
    tier,
    score,
    service_need: urgent ? 'urgent repair' : 'general enquiry',
    reason: `mock model, budget ${budget}, urgent ${urgent}`,
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname;

  if (path === '/' && req.method === 'GET') return send(res, 200, consolePage());
  if (path === '/__state') {
    return send(res, 200, {
      crm: [...state.crm.values()],
      messages: state.messages,
      messageReplays: state.messageReplays,
      alerts: state.alerts,
      notifications: state.notifications,
      requests: state.requests,
      pendingFaults: faults,
    });
  }
  if (path === '/__reset') {
    state = blank();
    crmSeq = 0;
    msgSeq = 0;
    faults = { crm: [], ai: [], message: [], alert: [], notify: [] };
    return send(res, 200, { ok: true });
  }
  if (path === '/__fault') {
    const b = await readBody(req);
    faults[b.service] = (b.faults || []).map((f) => ({ ...f }));
    return send(res, 200, { ok: true, pending: faults[b.service] });
  }

  const body = await readBody(req);
  const log = { at: new Date().toISOString(), method: req.method, path, status: null };
  state.requests.push(log);

  const crmMatch = path.match(/^\/crm\/leads\/([^/]+)$/);
  if (crmMatch && req.method === 'PUT') {
    if (applyFault('crm', res, log)) return;
    const leadId = decodeURIComponent(crmMatch[1]);
    const existing = state.crm.get(leadId);
    const record = {
      crmId: existing?.crmId ?? `crm_${String(++crmSeq).padStart(4, '0')}`,
      leadId,
      version: (existing?.version ?? 0) + 1,
      ...body,
      updatedAt: log.at,
    };
    state.crm.set(leadId, record);
    log.status = existing ? 200 : 201;
    return send(res, log.status, { id: record.crmId, leadId, version: record.version, created: !existing });
  }

  if (path === '/ai/v1/chat/completions' && req.method === 'POST') {
    if (applyFault('ai', res, log)) return;
    log.status = 200;
    const prompt = body?.messages?.map((m) => m.content).join('\n') ?? '';
    return send(res, 200, {
      id: 'mock-completion',
      model: 'mock-model',
      choices: [{ index: 0, message: { role: 'assistant', content: mockModelReply(prompt) } }],
    });
  }

  if (path === '/messages/send' && req.method === 'POST') {
    const key = req.headers['idempotency-key'];
    if (!key) {
      log.status = 400;
      return send(res, 400, { error: 'idempotency_key_required' });
    }
    const lost = faults.message[0]?.acceptThenFail;
    if (!lost && applyFault('message', res, log)) return;
    if (state.idempotency.has(key)) {
      log.status = 200;
      log.note = 'idempotent replay, nothing sent';
      state.messageReplays.push({ key, at: log.at });
      return send(res, 200, { ...state.idempotency.get(key), idempotentReplay: true });
    }
    const message = { id: `msg_${String(++msgSeq).padStart(4, '0')}`, key, to: body.to, channel: body.channel, text: body.text, at: log.at };
    state.messages.push(message);
    const reply = { id: message.id, status: 'queued' };
    state.idempotency.set(key, reply);
    if (lost) {
      const f = faults.message[0];
      f.times = (f.times ?? 1) - 1;
      if (f.times <= 0) faults.message.shift();
      log.status = 502;
      log.note = 'message accepted, reply lost';
      return send(res, 502, { error: 'bad_gateway' });
    }
    log.status = 202;
    return send(res, 202, reply);
  }

  if (path === '/alerts' && req.method === 'POST') {
    if (applyFault('alert', res, log)) return;
    state.alerts.push({ at: log.at, ...body });
    log.status = 200;
    return send(res, 200, { ok: true });
  }

  if (path === '/notify' && req.method === 'POST') {
    if (applyFault('notify', res, log)) return;
    state.notifications.push({ at: log.at, ...body });
    log.status = 200;
    return send(res, 200, { ok: true });
  }

  log.status = 404;
  send(res, 404, { error: 'not_found' });
});

function consolePage() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Mock services console</title>
<style>
  body{margin:0;background:#f6f5f2;color:#1f2328;font:18px/1.45 "Segoe UI",system-ui,sans-serif}
  header{padding:26px 44px 20px;border-bottom:1px solid #dcdad3;display:flex;align-items:baseline;gap:18px}
  h1{font-size:26px;margin:0;font-weight:600}
  .tag{font-size:15px;color:#7a4b12;background:#f6e6cf;padding:3px 10px;border-radius:4px}
  main{display:grid;grid-template-columns:1fr 1fr;gap:26px;padding:26px 44px}
  section{background:#fff;border:1px solid #e2e0da;border-radius:8px;padding:18px 22px;min-height:190px}
  h2{font-size:17px;margin:0 0 12px;font-weight:600;color:#44494f}
  .n{float:right;font-variant-numeric:tabular-nums;color:#44494f}
  table{width:100%;border-collapse:collapse;font-size:16px}
  td{padding:5px 8px 5px 0;border-top:1px solid #efede8;vertical-align:top;word-break:break-word}
  .empty{color:#8b8f94}
</style></head><body>
<header><h1>Mock services console</h1><span class="tag">MOCK, local stand-ins, no real provider behind this page</span></header>
<main>
<section><h2>Mock CRM records <span class="n" id="nc"></span></h2><table id="crm"></table></section>
<section><h2>Mock messages actually sent <span class="n" id="nm"></span></h2><table id="msg"></table></section>
<section><h2>Mock operator alerts <span class="n" id="na"></span></h2><table id="alert"></table></section>
<section><h2>Last requests to the mock</h2><table id="req"></table></section>
</main>
<script>
const row=(c)=>'<tr>'+c.map(v=>'<td>'+String(v??'').replace(/</g,'&lt;')+'</td>').join('')+'</tr>';
const fill=(id,rows,empty)=>{document.getElementById(id).innerHTML=rows.length?rows.join(''):'<tr><td class="empty">'+empty+'</td></tr>'};
async function tick(){
  const s=await (await fetch('/__state')).json();
  nc.textContent=s.crm.length;nm.textContent=s.messages.length;na.textContent=s.alerts.length;
  fill('crm',s.crm.slice(-5).map(r=>row([r.crmId,r.name,r.email,r.tier,'v'+r.version])),'No records yet');
  fill('msg',s.messages.slice(-5).map(m=>row([m.id,m.to,m.key])),'Nothing sent yet');
  fill('alert',s.alerts.slice(-4).map(a=>row([a.severity,a.stage,a.action])),'No alerts');
  fill('req',s.requests.slice(-6).reverse().map(r=>row([r.method,r.path.slice(0,30),r.status,r.note])),'No requests yet');
}
tick();setInterval(tick,700);
</script></body></html>`;
}

server.listen(PORT, '127.0.0.1', () => console.log(`MOCK services on http://127.0.0.1:${PORT}`));
