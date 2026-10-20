// CSS helpers: a minifier for the styles that stay in the head, and an
// inliner that copies the simple rules into style attributes.
import { tokenize, serializeStart, getAttr, setAttr } from './html.mjs';

export const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

export function minify(css) {
  return stripComments(css)
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};,>])\s*/g, '$1')
    .replace(/\s*:\s*/g, ':')
    .replace(/;}/g, '}')
    .trim();
}

// "a: b; c: d" to [["a", "b"], ["c", "d"]]. Our values never hold semicolons.
export function parseDecls(text) {
  return text.split(';').map(d => d.trim()).filter(Boolean).map(d => {
    const i = d.indexOf(':');
    if (i < 1) throw new Error(`Bad declaration "${d}"`);
    return [d.slice(0, i).trim().toLowerCase(), d.slice(i + 1).trim()];
  });
}

const SIMPLE = /^([a-z][a-z0-9]*)?((?:\.[a-zA-Z_][\w-]*)*)$/;
export function compileSelector(sel) {
  const m = SIMPLE.exec(sel);
  if (!m || (!m[1] && !m[2])) throw new Error(`The inliner handles tag, .class and tag.class selectors only, not "${sel}". Put this rule in the head styles instead.`);
  const classes = m[2] ? m[2].slice(1).split('.') : [];
  return { tag: m[1] || null, classes, specificity: classes.length * 10 + (m[1] ? 1 : 0) };
}

export function parseRules(css) {
  const src = stripComments(css);
  if (src.includes('@')) throw new Error('Inline styles may not contain at-rules. Media queries and dark mode belong in the head styles.');
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  let order = 0;
  while ((m = re.exec(src))) {
    const decls = parseDecls(m[2]);
    for (const selector of m[1].split(',').map(s => s.trim()).filter(Boolean)) {
      rules.push({ selector, ...compileSelector(selector), decls, order: order++ });
    }
  }
  if (src.replace(re, '').trim()) throw new Error('Could not read part of the inline stylesheet: ' + src.replace(re, '').trim().slice(0, 60));
  return rules;
}

export function matches(rule, tagName, classList) {
  return (!rule.tag || rule.tag === tagName) && rule.classes.every(c => classList.includes(c));
}

const PX = /^(\d+)px$/;
const HEX = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i;
const TABLE_PARTS = new Set(['table', 'td', 'th']);

// Inline every matching rule into the element's style attribute.
// Order: rules by specificity then source order, then the element's own
// style attribute, which always wins. Class attributes are kept because
// the media queries and dark mode rules in the head still target them.
// Tags inside comments, including Outlook conditional blocks, are left as written.
// Outlook also gets presentational attributes: bgcolor from background-color
// on table cells, and width from a pixel width.
export function inline(html, rules) {
  const used = new Set();
  let out = '';
  for (const t of tokenize(html)) {
    if (t.type !== 'start') { out += html.slice(t.start, t.end); continue; }
    const classList = (getAttr(t, 'class') || '').split(/\s+/).filter(Boolean);
    const hit = rules.filter(r => matches(r, t.name, classList));
    if (!hit.length) { out += html.slice(t.start, t.end); continue; }
    hit.sort((a, b) => a.specificity - b.specificity || a.order - b.order);
    const decls = new Map();
    const put = (p, v) => { decls.delete(p); decls.set(p, v); };
    for (const r of hit) { used.add(r); for (const [p, v] of r.decls) put(p, v); }
    const own = getAttr(t, 'style');
    if (own) for (const [p, v] of parseDecls(own)) put(p, v);
    setAttr(t, 'style', [...decls].map(([p, v]) => `${p}:${v}`).join(';'));
    const bg = decls.get('background-color');
    if (TABLE_PARTS.has(t.name) && bg && HEX.test(bg) && getAttr(t, 'bgcolor') === undefined) setAttr(t, 'bgcolor', bg);
    const w = PX.exec(decls.get('width') || '');
    if (w && (TABLE_PARTS.has(t.name) || t.name === 'img') && getAttr(t, 'width') === undefined) setAttr(t, 'width', w[1]);
    out += serializeStart(t);
  }
  return { html: out, used };
}
