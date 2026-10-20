// A small HTML tokenizer and tree builder for the markup in this kit.
// It expects well formed markup: every element closed, attributes quoted.
// The build uses it to inline CSS, and the tests use it to inspect the output.

export const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['style', 'script', 'title', 'textarea']);

export function tokenize(html) {
  const out = [];
  const n = html.length;
  let i = 0;
  const text = (s, e, raw = false) => { if (e > s) out.push({ type: 'text', value: html.slice(s, e), start: s, end: e, raw }); };
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt < 0) { text(i, n); break; }
    text(i, lt);
    if (html.startsWith('<!--', lt)) {
      const close = html.indexOf('-->', lt + 4);
      if (close < 0) throw new Error('Unclosed comment at offset ' + lt);
      out.push({ type: 'comment', value: html.slice(lt + 4, close), start: lt, end: close + 3 });
      i = close + 3;
      continue;
    }
    if (html.startsWith('<!', lt)) {
      const close = html.indexOf('>', lt);
      out.push({ type: 'doctype', value: html.slice(lt + 2, close), start: lt, end: close + 1 });
      i = close + 1;
      continue;
    }
    if (html[lt + 1] === '/') {
      const close = html.indexOf('>', lt);
      if (close < 0) throw new Error('Unclosed end tag at offset ' + lt);
      out.push({ type: 'end', name: html.slice(lt + 2, close).trim().toLowerCase(), start: lt, end: close + 1 });
      i = close + 1;
      continue;
    }
    if (!/[a-zA-Z]/.test(html[lt + 1] || '')) { text(lt, lt + 1); i = lt + 1; continue; }
    const tag = readStartTag(html, lt);
    out.push(tag);
    i = tag.end;
    if (RAW.has(tag.name) && !tag.selfClosing) {
      const re = new RegExp('</' + tag.name + '\\s*>', 'ig');
      re.lastIndex = i;
      const m = re.exec(html);
      if (!m) throw new Error(`Unclosed <${tag.name}> at offset ${tag.start}`);
      text(i, m.index, true);
      out.push({ type: 'end', name: tag.name, start: m.index, end: m.index + m[0].length });
      i = m.index + m[0].length;
    }
  }
  return out;
}

const NAME = /[a-zA-Z][\w:-]*/y;
const ATTR = /[^\s"'>\/=]+/y;
const BARE = /[^\s>]+/y;

function readStartTag(html, lt) {
  NAME.lastIndex = lt + 1;
  const nm = NAME.exec(html);
  const name = nm[0].toLowerCase();
  let j = NAME.lastIndex;
  const attrs = [];
  const skip = () => { while (j < html.length && /\s/.test(html[j])) j++; };
  while (j < html.length) {
    skip();
    if (html[j] === '>') return { type: 'start', name, attrs, selfClosing: false, start: lt, end: j + 1 };
    if (html[j] === '/' && html[j + 1] === '>') return { type: 'start', name, attrs, selfClosing: true, start: lt, end: j + 2 };
    ATTR.lastIndex = j;
    const am = ATTR.exec(html);
    if (!am) throw new Error(`Bad attribute in <${name}> at offset ${j}`);
    const key = am[0];
    j = ATTR.lastIndex;
    skip();
    let value = null;
    if (html[j] === '=') {
      j++;
      skip();
      const q = html[j];
      if (q === '"' || q === "'") {
        const e = html.indexOf(q, j + 1);
        if (e < 0) throw new Error(`Unclosed attribute value in <${name}> at offset ${j}`);
        value = html.slice(j + 1, e);
        j = e + 1;
      } else {
        BARE.lastIndex = j;
        value = BARE.exec(html)[0];
        j = BARE.lastIndex;
      }
    }
    attrs.push([key, value]);
  }
  throw new Error(`Unclosed tag <${name}> at offset ${lt}`);
}

export function serializeStart(tag) {
  const attrs = tag.attrs.map(([k, v]) => (v === null ? ' ' + k : ` ${k}="${String(v).replace(/"/g, '&quot;')}"`)).join('');
  return `<${tag.name}${attrs}${tag.selfClosing ? ' /' : ''}>`;
}

export function getAttr(node, key) {
  const a = node.attrs?.find(([k]) => k.toLowerCase() === key);
  return a ? (a[1] ?? '') : undefined;
}

export function setAttr(node, key, value) {
  const a = node.attrs.find(([k]) => k.toLowerCase() === key);
  if (a) a[1] = value;
  else node.attrs.push([key, value]);
}

// Builds a tree and throws on any mismatched or unclosed element.
export function parse(html) {
  const root = { type: 'root', name: '#root', children: [], parent: null };
  const stack = [root];
  for (const t of tokenize(html)) {
    const top = stack[stack.length - 1];
    if (t.type === 'start') {
      const el = { type: 'element', name: t.name, attrs: t.attrs, children: [], parent: top, start: t.start };
      top.children.push(el);
      if (!VOID.has(t.name) && !t.selfClosing) stack.push(el);
    } else if (t.type === 'end') {
      if (VOID.has(t.name)) continue;
      if (top.name !== t.name) throw new Error(`Found </${t.name}> while <${top.name}> is open, offset ${t.start}`);
      stack.pop();
    } else {
      top.children.push({ ...t, parent: top });
    }
  }
  if (stack.length !== 1) throw new Error(`<${stack[stack.length - 1].name}> is never closed`);
  return root;
}

export function walk(node, fn) {
  for (const c of node.children || []) {
    fn(c);
    walk(c, fn);
  }
}

export function find(root, test) {
  const out = [];
  walk(root, n => { if (n.type === 'element' && test(n)) out.push(n); });
  return out;
}

export const byName = (root, name) => find(root, n => n.name === name);

export function ancestors(node) {
  const out = [];
  for (let p = node.parent; p; p = p.parent) out.push(p);
  return out;
}

export function textOf(node) {
  let s = '';
  walk(node, n => { if (n.type === 'text' && !n.raw) s += n.value; });
  return decode(s);
}

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', zwnj: '‌', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', middot: '·', times: '×', minus: '−', hellip: '…', copy: '©', pound: '£' };
export function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return NAMED[e.toLowerCase()] ?? m;
  });
}

// The two documents a conditional comment produces. Outlook on Windows reads
// the content of <!--[if mso]> blocks and skips <!--[if !mso]><!--> blocks.
// Every other client does the opposite.
export function msoView(html) {
  return html
    .replace(/<!--\[if !mso\]><!-->[\s\S]*?<!--<!\[endif\]-->/g, '')
    .replace(/<!--\[if [^\]]*mso[^\]]*\]>([\s\S]*?)<!\[endif\]-->/g, '$1');
}

export function standardView(html) {
  return html
    .replace(/<!--\[if !mso\]><!-->([\s\S]*?)<!--<!\[endif\]-->/g, '$1')
    .replace(/<!--\[if [^\]]*mso[^\]]*\]>[\s\S]*?<!\[endif\]-->/g, '');
}
