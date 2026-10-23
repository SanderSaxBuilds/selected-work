/**
 * Lanta Telegram relay. OPTIONAL. NOT DEPLOYED.
 *
 * The Lanta kit works without this file. Booking requests already open in WhatsApp, LINE or Telegram
 * on the visitor's own phone. Deploy this only when a business also wants a copy of every request
 * in one Telegram chat, for example a staff group.
 *
 * Runtime: Cloudflare Worker, module syntax. Settings:
 *   TELEGRAM_BOT_TOKEN  secret. The token @BotFather gives you for a new bot.
 *   TELEGRAM_CHAT_ID    secret. The chat that receives requests. Add the bot to that chat first.
 *   ALLOWED_ORIGINS     plain variable. Comma separated site origins, for example https://example.com
 *
 * Deploy:
 *   npx wrangler deploy worker/telegram-relay.js --name lanta-relay --compatibility-date 2026-10-01
 *   npx wrangler secret put TELEGRAM_BOT_TOKEN --name lanta-relay
 *   npx wrangler secret put TELEGRAM_CHAT_ID --name lanta-relay
 * Then set "relayUrl" in config.js to the worker URL. The kit sends one small JSON POST per request.
 */

const LIMITS = { business: 80, service: 120, minutes: 6, price: 9, date: 10, time: 5, name: 80, note: 300, lang: 2, channel: 10, page: 300 };

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const known = allowed.includes(origin);
    const cors = known
      ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
      : { Vary: 'Origin' };

    if (request.method === 'OPTIONS') return new Response(null, { status: known ? 204 : 403, headers: cors });
    if (request.method !== 'POST') return reply({ ok: false, error: 'method_not_allowed' }, 405, cors);
    if (!known) return reply({ ok: false, error: 'origin_not_allowed' }, 403, cors);
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return reply({ ok: false, error: 'relay_not_configured' }, 500, cors);
    if (!(request.headers.get('Content-Type') || '').includes('application/json')) return reply({ ok: false, error: 'json_only' }, 415, cors);

    const raw = await request.text();
    if (raw.length > 4096) return reply({ ok: false, error: 'too_large' }, 413, cors);
    let body;
    try { body = JSON.parse(raw); } catch { return reply({ ok: false, error: 'bad_json' }, 400, cors); }
    if (!body || typeof body !== 'object') return reply({ ok: false, error: 'bad_json' }, 400, cors);

    // Hidden field that people never fill in. Bots that fill it get a quiet success and nothing is sent.
    if (body.website) return reply({ ok: true }, 200, cors);

    const f = {};
    for (const [key, max] of Object.entries(LIMITS)) {
      f[key] = String(body[key] == null ? '' : body[key]).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max);
    }
    if (!f.service || !/^\d{4}-\d{2}-\d{2}$/.test(f.date) || !/^\d{2}:\d{2}$/.test(f.time)) {
      return reply({ ok: false, error: 'missing_fields' }, 422, cors);
    }

    const text = [
      'New booking request' + (f.business ? ' for ' + f.business : ''),
      'Service: ' + f.service + (f.minutes ? ', ' + f.minutes + ' min' : '') + (f.price ? ', ' + f.price + ' THB' : ''),
      'Date: ' + f.date + ' at ' + f.time,
      f.name ? 'Name: ' + f.name : '',
      f.note ? 'Comment: ' + f.note : '',
      'Site language: ' + (f.lang || 'unknown') + '. Request opened in ' + (f.channel || 'unknown') + '.',
      f.page ? 'Page: ' + f.page : ''
    ].filter(Boolean).join('\n');

    const tg = await fetch('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true })
    });
    if (!tg.ok) return reply({ ok: false, error: 'telegram_failed' }, 502, cors);
    return reply({ ok: true }, 200, cors);
  }
};

function reply(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
}
