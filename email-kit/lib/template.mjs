// A tiny template language, enough for email layouts and partials.
//
//   {{ path }}            value, HTML escaped (text templates pass escape: false)
//   {{{ path }}}          value, unescaped
//   {{#if path}} {{else}} {{/if}}
//   {{#unless path}} {{/unless}}
//   {{#each path}} {{/each}}    inside: this, @index, @first, @last, and outer names
//   {{> name key="text" other=path flag=true}}   partial with arguments
//   {{! comment }}
//
// A missing value is an error, so a typo in a template fails the build
// instead of shipping an empty gap. #if and #unless treat missing as false.

const TAG = /\{\{\{\s*([\s\S]+?)\s*\}\}\}|\{\{\s*([\s\S]+?)\s*\}\}/g;
const BLOCKS = new Set(['if', 'unless', 'each']);

export function escapeHtml(v) {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function compile(source, name = 'template') {
  // A block tag alone on its line takes the whole line with it, so the
  // output has no blank lines where the tags were.
  const src = source.replace(/^[ \t]*(\{\{(?:[#\/][^}]*|else)\}\})[ \t]*\r?\n/gm, '$1');
  const root = { type: 'root', children: [] };
  const stack = [root];
  const into = node => (node.inElse ? node.alt : node.children);
  const lineAt = idx => src.slice(0, idx).split('\n').length;
  let last = 0;
  let m;
  TAG.lastIndex = 0;
  while ((m = TAG.exec(src))) {
    const top = stack[stack.length - 1];
    if (m.index > last) into(top).push({ type: 'text', value: src.slice(last, m.index) });
    last = TAG.lastIndex;
    const where = `${name} line ${lineAt(m.index)}`;
    if (m[1] !== undefined) { into(top).push({ type: 'raw', path: m[1].trim(), where }); continue; }
    const body = m[2].trim();
    if (body.startsWith('!')) continue;
    if (body.startsWith('#')) {
      const [kw, ...rest] = body.slice(1).split(/\s+/);
      if (!BLOCKS.has(kw) || !rest.length) throw new Error(`Unknown block "{{${body}}}" in ${where}`);
      const node = { type: kw, path: rest.join(' '), children: [], alt: [], inElse: false, where };
      into(top).push(node);
      stack.push(node);
    } else if (body === 'else') {
      if (top === root || top.inElse) throw new Error(`Unexpected {{else}} in ${where}`);
      top.inElse = true;
    } else if (body.startsWith('/')) {
      const kw = body.slice(1).trim();
      if (top.type !== kw) throw new Error(`{{/${kw}}} does not close {{#${top.type}}} in ${where}`);
      stack.pop();
    } else if (body.startsWith('>')) {
      into(top).push({ type: 'partial', ...parseCall(body.slice(1).trim(), where), where });
    } else {
      into(top).push({ type: 'var', path: body, where });
    }
  }
  if (last < src.length) into(stack[stack.length - 1]).push({ type: 'text', value: src.slice(last) });
  if (stack.length > 1) throw new Error(`{{#${stack[stack.length - 1].type}}} is never closed, opened in ${stack[stack.length - 1].where}`);
  return { name, root };
}

const ARG = /([\w-]+)=("([^"]*)"|'([^']*)'|\S+)/g;
function parseCall(text, where) {
  const sp = text.search(/\s/);
  const name = sp < 0 ? text : text.slice(0, sp);
  const rest = sp < 0 ? '' : text.slice(sp + 1);
  const args = [];
  let m;
  ARG.lastIndex = 0;
  let consumed = '';
  while ((m = ARG.exec(rest))) {
    consumed += m[0];
    if (m[3] !== undefined) args.push([m[1], { literal: m[3] }]);
    else if (m[4] !== undefined) args.push([m[1], { literal: m[4] }]);
    else args.push([m[1], { path: m[2] }]);
  }
  if (rest.replace(/\s+/g, '').length !== consumed.replace(/\s+/g, '').length) throw new Error(`Could not read the arguments of partial "${name}" in ${where}`);
  return { name, args };
}

function literal(path) {
  if (path === 'true') return { ok: true, value: true };
  if (path === 'false') return { ok: true, value: false };
  if (/^-?\d+(\.\d+)?$/.test(path)) return { ok: true, value: Number(path) };
  return { ok: false };
}

function lookup(scopes, path) {
  const lit = literal(path);
  if (lit.ok) return { found: true, value: lit.value };
  if (path === 'this' || path === '.') return { found: true, value: scopes[scopes.length - 1].value };
  const parts = path.split('.');
  const head = parts[0];
  for (let i = scopes.length - 1; i >= 0; i--) {
    const s = scopes[i];
    let base;
    if (s.locals && head in s.locals) base = s.locals[head];
    else if (head === 'this') base = s.value;
    else if (s.value !== null && typeof s.value === 'object' && head in s.value) base = s.value[head];
    else continue;
    let v = base;
    for (const p of parts.slice(1)) {
      if (v === null || v === undefined || !(p in Object(v))) return { found: false };
      v = v[p];
    }
    return { found: v !== undefined, value: v };
  }
  return { found: false };
}

const truthy = v => (Array.isArray(v) ? v.length > 0 : Boolean(v));

export function render(tpl, data, options = {}) {
  const { partials = {}, escape = escapeHtml } = options;
  const out = [];
  const run = (nodes, scopes) => {
    for (const n of nodes) {
      if (n.type === 'text') out.push(n.value);
      else if (n.type === 'var' || n.type === 'raw') {
        const r = lookup(scopes, n.path);
        if (!r.found || r.value === null) throw new Error(`Missing value "${n.path}" in ${n.where}`);
        out.push(n.type === 'raw' ? String(r.value) : escape(r.value));
      } else if (n.type === 'if' || n.type === 'unless') {
        const v = truthy(lookup(scopes, n.path).value);
        run((n.type === 'if' ? v : !v) ? n.children : n.alt, scopes);
      } else if (n.type === 'each') {
        const r = lookup(scopes, n.path);
        if (!r.found || !Array.isArray(r.value)) throw new Error(`"${n.path}" is not a list in ${n.where}`);
        const list = r.value;
        if (!list.length) run(n.alt, scopes);
        list.forEach((item, index) => run(n.children, [...scopes, { value: item, locals: { '@index': index, '@number': index + 1, '@first': index === 0, '@last': index === list.length - 1 } }]));
      } else if (n.type === 'partial') {
        const p = partials[n.name];
        if (!p) throw new Error(`Unknown partial "${n.name}" in ${n.where}`);
        const args = {};
        for (const [k, spec] of n.args) {
          if ('literal' in spec) { args[k] = spec.literal; continue; }
          const r = lookup(scopes, spec.path);
          if (!r.found) throw new Error(`Missing value "${spec.path}" for partial "${n.name}" in ${n.where}`);
          args[k] = r.value;
        }
        run(p.root.children, [...scopes, { value: args, locals: null }]);
      }
    }
  };
  run(tpl.root.children, [{ value: data, locals: null }]);
  return out.join('');
}
