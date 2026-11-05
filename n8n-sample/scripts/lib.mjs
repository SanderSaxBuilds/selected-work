// Shared helpers for the local setup and test scripts.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const N8N = 'http://127.0.0.1:5678';
export const MOCK = 'http://127.0.0.1:4010';
const OWNER_FILE = path.join(ROOT, '.n8n-local', 'local-owner.json');

export const TABLES = {
  leads: ['lead_id', 'email', 'phone', 'name', 'status', 'stage', 'tier', 'score:number', 'qualified_by', 'crm_id', 'execution_id', 'last_error', 'payload'],
  followup_ledger: ['idempotency_key', 'lead_id', 'status', 'provider_message_id', 'execution_id'],
  dead_letters: ['dead_letter_id', 'stage', 'error_class', 'http_status', 'attempts:number', 'retryable:boolean', 'status', 'alert_status', 'reason', 'payload', 'lead_id', 'execution_id'],
};

// Throwaway login for this local instance only. Generated here, never printed,
// and removed with the rest of .n8n-local at the end of the run.
export function ownerLogin() {
  if (fs.existsSync(OWNER_FILE)) return JSON.parse(fs.readFileSync(OWNER_FILE, 'utf8'));
  const login = {
    email: 'sample-owner@example.com',
    firstName: 'Sample',
    lastName: 'Build',
    password: 'Aa1-' + crypto.randomBytes(18).toString('base64url'),
  };
  fs.mkdirSync(path.dirname(OWNER_FILE), { recursive: true });
  fs.writeFileSync(OWNER_FILE, JSON.stringify(login), 'utf8');
  return login;
}

let cookie = '';

export async function rest(method, url, body) {
  const go = () =>
    fetch(N8N + url, {
      method,
      headers: { 'content-type': 'application/json', 'browser-id': 'sample-scripts', cookie, connection: 'close' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  // A pooled socket can be dead right after an n8n restart, so one retry.
  const res = await go().catch(async () => {
    await sleep(800);
    return go();
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length) cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

export async function signIn() {
  const login = ownerLogin();
  const r = await rest('POST', '/rest/login', { emailOrLdapLoginId: login.email, password: login.password });
  if (r.status !== 200) throw new Error(`login failed ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  return r;
}

export async function personalProjectId() {
  const r = await rest('GET', '/rest/projects/personal');
  return r.json.data.id;
}

export async function tableIds(projectId) {
  const r = await rest('GET', `/rest/projects/${projectId}/data-tables?take=50`);
  const out = {};
  for (const t of r.json.data.data) out[t.name] = t.id;
  return out;
}

export async function allRows(projectId, tableId) {
  const r = await rest('GET', `/rest/projects/${projectId}/data-tables/${tableId}/rows?take=500`);
  return r.json.data.data;
}

export async function wipeTable(projectId, tableId) {
  const filter = encodeURIComponent(JSON.stringify({ type: 'and', filters: [{ columnName: 'id', condition: 'gte', value: 0 }] }));
  return rest('DELETE', `/rest/projects/${projectId}/data-tables/${tableId}/rows?filter=${filter}`);
}

export async function mockState() {
  return (await fetch(`${MOCK}/__state`)).json();
}
export const mockReset = () => fetch(`${MOCK}/__reset`, { method: 'POST' });
export const mockFault = (service, faults) =>
  fetch(`${MOCK}/__fault`, { method: 'POST', body: JSON.stringify({ service, faults }) });

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
