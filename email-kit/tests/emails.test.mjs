// Validates every built email in dist/ against the rules the kit promises.
// The Outlook checks are structural: they read the markup Outlook would see,
// they do not run Outlook.
// Run: node --test tests/lib.test.mjs tests/emails.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, tokenize, getAttr, find, byName, ancestors, textOf, decode, msoView, standardView } from '../lib/html.mjs';
import { parseRules, parseDecls, matches, stripComments, minify } from '../lib/css.mjs';
import { buildAll, GMAIL_CLIP_BYTES } from '../build.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');
const manifest = JSON.parse(read('dist/manifest.json'));
const rules = parseRules(read('src/styles/inline.css'));
const inlineClasses = new Set(rules.flatMap(r => r.classes));
const headCss = ['head', 'dark', 'font', 'mso'].map(n => read(`src/styles/${n}.css`)).join('\n');
const headClasses = new Set([...stripComments(headCss).replace(/url\([^)]*\)/g, '').replace(/'[^']*'/g, '').matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => m[1]));
const CLIENT_CLASSES = new Set(['aBn', 'a6S']);
const INVISIBLE = /[\s ‌͏ ﻿]/g;
const styleOf = el => new Map(parseDecls(getAttr(el, 'style') || ''));
const classesOf = el => (getAttr(el, 'class') || '').split(/\s+/).filter(Boolean);
const hidden = el => [el, ...ancestors(el)].some(n => n.type === 'element' && /display:\s*none/.test(getAttr(n, 'style') || ''));
const msoBlocks = html => [...html.matchAll(/<!--\[if [^\]]*mso[^\]]*\]>([\s\S]*?)<!\[endif\]-->/g)].map(m => m[1]).filter(b => !b.includes('<!-->'));
const bodyOf = html => html.slice(html.indexOf('<body'));
// Text that takes its size from this element: children that set their own font-size are skipped.
const sizedText = el => el.children.map(c => (c.type === 'text' && !c.raw ? decode(c.value) : c.type === 'element' && !styleOf(c).has('font-size') ? sizedText(c) : '')).join('');
const pence = s => Math.round(Number(s.replace(/[£\s,]/g, '').replace('−', '-')) * 100);

test('the manifest lists the four required emails', () => {
  assert.deepEqual(manifest.emails.map(e => e.id), ['welcome', 'order-confirmation', 'shipping-update', 'newsletter']);
});

for (const email of manifest.emails) {
  const html = read(email.html);
  const mso = msoView(html);
  const std = standardView(html);
  // Parsed on first use, so a broken file fails the tests that need it, one by one.
  let cache;
  const docs = () => (cache ??= { std: parse(std), mso: parse(mso) });
  const name = email.id;

  test(`${name}: built file is under the 102 KB where Gmail clips`, () => {
    const bytes = statSync(join(root, email.html)).size;
    assert.equal(bytes, email.bytes);
    assert.ok(bytes < GMAIL_CLIP_BYTES, `${bytes} bytes`);
  });

  test(`${name}: every element is closed in both the Outlook view and the standard view`, () => {
    assert.doesNotThrow(() => parse(html));
    assert.doesNotThrow(() => parse(mso));
    assert.doesNotThrow(() => parse(std));
  });

  test(`${name}: MSO conditional comments are balanced, never nested and closed in the right form`, () => {
    const re = /<!--\[if ([^\]]+)\]>(<!-->)?|(<!--)?<!\[endif\]-->/g;
    let open = null;
    let count = 0;
    for (const m of html.matchAll(re)) {
      if (m[1] !== undefined) {
        assert.equal(open, null, `nested conditional at offset ${m.index}`);
        open = { revealed: Boolean(m[2]), cond: m[1] };
        assert.equal(open.revealed, m[1].startsWith('!'), `"${m[0]}" mixes the hidden and revealed forms`);
        count++;
      } else {
        assert.ok(open, `stray endif at offset ${m.index}`);
        assert.equal(Boolean(m[3]), open.revealed, `endif at offset ${m.index} does not match its opener`);
        open = null;
      }
    }
    assert.equal(open, null, 'a conditional is never closed');
    assert.ok(count >= 4, `only ${count} conditionals`);
  });

  test(`${name}: layout tables have role="presentation" and data tables have scoped headers`, () => {
    for (const doc of [docs().std, docs().mso]) {
      for (const t of byName(doc, 'table')) {
        const own = byName(t, 'th').filter(th => th.parent.parent === t);
        if (getAttr(t, 'role') === 'presentation') assert.equal(own.length, 0, 'a presentation table has header cells');
        else {
          assert.ok(own.length > 0, 'a table without role="presentation" has no header cells');
          for (const th of own) assert.match(getAttr(th, 'scope') || '', /^(col|row)$/);
        }
      }
    }
    const data = byName(docs().std, 'table').filter(t => getAttr(t, 'role') !== 'presentation');
    assert.equal(data.length, name === 'order-confirmation' ? 1 : 0);
  });

  test(`${name}: widths live in attributes, on every table and every ghost table cell`, () => {
    for (const t of byName(docs().mso, 'table')) assert.match(getAttr(t, 'width') || '', /^\d+%?$/, 'table without a width attribute');
    const ghosts = msoBlocks(bodyOf(html)).join('');
    const cells = tokenize(ghosts).filter(t => t.type === 'start' && t.name === 'td');
    for (const td of cells) assert.match(getAttr(td, 'width') || '', /^\d+$/, 'ghost cell without a pixel width');
    const tables = tokenize(ghosts).filter(t => t.type === 'start' && t.name === 'table');
    for (const t of tables) assert.equal(getAttr(t, 'role'), 'presentation');
    assert.ok(tables.length >= 1, 'no ghost table');
  });

  test(`${name}: anything sized by max-width sits in a fixed width Outlook cell or has a width attribute`, () => {
    const sized = find(docs().mso, el => styleOf(el).has('max-width') && !hidden(el));
    assert.ok(sized.length > 0);
    for (const el of sized) {
      if (el.name === 'img') { assert.match(getAttr(el, 'width') || '', /^\d+$/); continue; }
      const cell = ancestors(el).find(a => a.name === 'td');
      assert.match(getAttr(cell, 'width') || '', /^\d+$/, `<${el.name}> with max-width is not inside a fixed width cell`);
    }
  });

  test(`${name}: no flex, grid, float or position anywhere`, () => {
    const css = [...html.matchAll(/style="([^"]*)"/g)].map(m => m[1]).join(';') + [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('');
    assert.doesNotMatch(css, /display:\s*(inline-)?(flex|grid)|(^|[;{\s])float:|(^|[;{\s])position:/);
  });

  test(`${name}: every image has alt text, width and height attributes and an absolute https source`, () => {
    const imgs = byName(docs().std, 'img');
    assert.ok(imgs.length > 0);
    for (const img of imgs) {
      assert.notEqual(getAttr(img, 'alt'), undefined, 'img without alt');
      assert.match(getAttr(img, 'width') || '', /^\d+$/);
      assert.match(getAttr(img, 'height') || '', /^\d+$/);
      assert.match(getAttr(img, 'src'), /^https:\/\//);
    }
    const linkedImages = imgs.filter(i => ancestors(i).some(a => a.name === 'a'));
    for (const img of linkedImages) assert.ok(getAttr(img, 'alt').length > 0, 'a linked image needs alt text');
  });

  const hrefs = () => [
    ...byName(docs().std, 'a').map(a => getAttr(a, 'href')),
    ...byName(docs().mso, 'v:roundrect').map(v => getAttr(v, 'href'))
  ].map(decode);

  test(`${name}: every link is an absolute https URL`, () => {
    assert.ok(hrefs().length >= 5);
    for (const h of hrefs()) assert.match(h, /^https:\/\/[^\s"<>]+$/);
  });

  test(`${name}: each VML button has an HTML fallback with the same link and label`, () => {
    const vml = byName(docs().mso, 'v:roundrect');
    const btns = find(docs().std, el => el.name === 'a' && classesOf(el).includes('btn'));
    assert.ok(vml.length >= 1);
    assert.equal(vml.length, btns.length);
    vml.forEach((v, i) => {
      assert.equal(getAttr(v, 'href'), getAttr(btns[i], 'href'));
      assert.equal(textOf(byName(v, 'center')[0]).trim(), textOf(btns[i]).trim());
      assert.ok(byName(v, 'w:anchorlock').length === 1, 'missing w:anchorlock');
      const w = /width:(\d+)px/.exec(getAttr(v, 'style'))[1];
      assert.equal(styleOf(btns[i]).get('width'), w + 'px');
    });
  });

  test(`${name}: no JavaScript and no external CSS`, () => {
    assert.equal(byName(parse(html), 'script').length, 0);
    assert.doesNotMatch(html, /<script|javascript:|@import|<link\b/i);
    for (const el of find(parse(html), () => true)) for (const [k] of el.attrs) assert.doesNotMatch(k, /^on/i, `event handler ${k}`);
  });

  test(`${name}: the head keeps media queries, dark mode and Outlook.com rules, and none of the inlined rules`, () => {
    const head = html.slice(0, html.indexOf('</head>'));
    assert.match(head, /<meta name="color-scheme" content="light dark">/);
    assert.match(head, /<meta name="supported-color-schemes" content="light dark">/);
    assert.match(head, /@media screen and \(max-width:600px\)\{/);
    assert.match(head, /@media \(prefers-color-scheme:dark\)\{/);
    assert.match(head, /\[data-ogsc\] /);
    assert.match(head, /\[data-ogsb\] /);
    assert.match(head, /<!--\[if mso\]>[\s\S]*PixelsPerInch>96[\s\S]*<!\[endif\]-->/);
    assert.match(head, /<!--\[if !mso\]><!-->\s*<style>@font-face/);
    const styles = [...head.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('');
    for (const r of rules) {
      const block = minify(`${r.selector} { ${r.decls.map(([p, v]) => `${p}: ${v}`).join('; ')} }`);
      assert.ok(!styles.includes(block), `${r.selector} was left in the head instead of inlined`);
    }
  });

  test(`${name}: no inlined rule is missing from the elements it matches`, () => {
    let checked = 0;
    for (const el of find(docs().std, () => true)) {
      const own = styleOf(el);
      for (const r of rules) {
        if (!matches(r, el.name, classesOf(el))) continue;
        for (const [p] of r.decls) assert.ok(own.has(p), `<${el.name} class="${getAttr(el, 'class') || ''}"> is missing ${p} from ${r.selector}`);
        checked++;
      }
    }
    assert.ok(checked > 50, `only ${checked} rule matches`);
  });

  test(`${name}: every class is defined in the inline or head styles`, () => {
    const body = byName(docs().std, 'body')[0];
    for (const el of [body, ...find(body, () => true)]) {
      for (const c of classesOf(el)) assert.ok(inlineClasses.has(c) || headClasses.has(c), `class "${c}" has no rule`);
    }
  });

  test(`${name}: lang, a real title, the article landmark and a hidden preheader`, () => {
    const htmlEl = byName(docs().std, 'html')[0];
    assert.equal(getAttr(htmlEl, 'lang'), 'en');
    assert.equal(decode(/<title>([^<]*)<\/title>/.exec(html)[1]), email.subject);
    const article = find(docs().std, el => getAttr(el, 'role') === 'article')[0];
    assert.equal(getAttr(article, 'aria-roledescription'), 'email');
    assert.equal(getAttr(article, 'lang'), 'en');
    assert.equal(decode(getAttr(article, 'aria-label')), email.subject);
    const pre = article.children.find(c => c.type === 'element');
    assert.ok(classesOf(pre).includes('preheader'));
    const s = styleOf(pre);
    assert.equal(s.get('display'), 'none');
    assert.equal(s.get('mso-hide'), 'all');
    assert.equal(textOf(pre), email.preheader);
    assert.ok(email.preheader.length >= 40 && email.preheader.length <= 140, `${email.preheader.length} characters`);
    const headings = byName(docs().std, 'h1');
    assert.equal(headings.length, 1);
  });

  test(`${name}: visible text is at least 14px and body copy 16px`, () => {
    for (const el of find(docs().std, e => styleOf(e).has('font-size'))) {
      const px = parseFloat(styleOf(el).get('font-size'));
      if (px >= 14 || hidden(el)) continue;
      assert.equal(sizedText(el).replace(INVISIBLE, ''), '', `<${el.name}> at ${px}px holds text`);
    }
    const labels = ['small', 'step-label', 'step-date'];
    for (const p of byName(docs().std, 'p').filter(p => !classesOf(p).some(c => labels.includes(c)) && !hidden(p))) {
      assert.ok(parseFloat(styleOf(p).get('font-size')) >= 16, textOf(p).slice(0, 40));
    }
  });

  test(`${name}: the plain text version exists and contains every link`, () => {
    assert.ok(existsSync(join(root, email.text)));
    const text = read(email.text);
    for (const h of hrefs()) assert.ok(text.includes(h), `missing ${h}`);
    assert.doesNotMatch(text, /<\/?[a-z][^>]*>/i, 'HTML in the plain text');
    assert.ok(text.includes(email.subject.split(':')[0]) || text.includes(textOf(byName(docs().std, 'h1')[0])));
    for (const line of text.split('\n')) assert.ok(line.length <= 72 || /https:\/\/\S+$/.test(line), `long line: ${line}`);
  });

  test(`${name}: copy has no em or en dashes, no ampersands and no parentheses`, () => {
    const visible = [email.subject, email.preheader, textOf(byName(docs().std, 'body')[0]), read(email.text), ...email.handles].join('\n');
    assert.doesNotMatch(visible, /[–—]/);
    assert.doesNotMatch(visible, /&/);
    assert.doesNotMatch(visible, /[()]/);
  });

  test(`${name}: says plainly that it is a sample from a fictional business`, () => {
    const body = textOf(byName(docs().std, 'body')[0]);
    assert.match(body, /sample email from the Inkpost kit/);
    assert.match(body, /fictional business/);
    assert.match(read(email.text).replace(/\s+/g, ' '), /fictional business/);
  });

  if (name === 'order-confirmation') {
    test(`${name}: line totals, discount and total add up as printed`, () => {
      const table = byName(docs().std, 'table').find(t => getAttr(t, 'role') !== 'presentation');
      const rows = byName(table, 'tr').filter(tr => tr.parent === table);
      const cells = tr => tr.children.filter(c => c.type === 'element');
      const items = rows.filter(tr => cells(tr).length === 3 && cells(tr)[0].name === 'td');
      const totals = rows.filter(tr => cells(tr)[0].name === 'th' && getAttr(cells(tr)[0], 'scope') === 'row');
      assert.equal(items.length, 3);
      let sum = 0;
      for (const tr of items) {
        const [item, qty, price] = cells(tr).map(textOf);
        const unit = pence(/(£[\d.]+) each/.exec(item)[1]);
        assert.equal(Number(qty) * unit, pence(price), item);
        sum += pence(price);
      }
      const value = label => pence(textOf(cells(totals.find(tr => textOf(cells(tr)[0]).startsWith(label)))[1]));
      assert.equal(value('Subtotal'), sum);
      assert.equal(value('FIRSTROAST'), -email.amounts.discount);
      assert.equal(email.amounts.discount, Math.round(email.amounts.coffee * 0.15));
      assert.equal(value('Total paid'), sum + value('FIRSTROAST') + value('Shipping'));
      assert.equal(value('Total paid'), email.amounts.total);
    });
  }

  if (['order-confirmation', 'newsletter'].includes(name)) {
    test(`${name}: hybrid columns are inline-block, 100% wide, capped by max-width and wrapped in ghost cells`, () => {
      const cols = find(docs().std, el => classesOf(el).includes('col'));
      assert.ok(cols.length >= 2);
      for (const col of cols) {
        const s = styleOf(col);
        assert.equal(s.get('display'), 'inline-block');
        assert.equal(s.get('width'), '100%');
        assert.match(s.get('max-width'), /^\d+px$/);
        assert.equal(styleOf(col.parent).get('font-size'), '0', 'the parent cell needs font-size:0 to close the inline-block gap');
      }
      const ghostCells = tokenize(msoBlocks(bodyOf(html)).join('')).filter(t => t.type === 'start' && t.name === 'td' && getAttr(t, 'width') === '280');
      assert.equal(ghostCells.length, cols.length);
    });
  }
}

test('dist matches a fresh build of src', () => {
  const { files } = buildAll();
  for (const [rel, content] of Object.entries(files)) assert.equal(read(rel), content, `${rel} is out of date, run node build.mjs`);
});

test('every inline rule is used by at least one email', () => {
  assert.deepEqual(buildAll().unused, []);
});

test('every class the head styles target is used, apart from client classes', () => {
  const used = new Set();
  for (const email of manifest.emails) for (const el of find(parse(read(email.html)), () => true)) classesOf(el).forEach(c => used.add(c));
  for (const c of headClasses) if (!CLIENT_CLASSES.has(c)) assert.ok(used.has(c), `.${c} is never used`);
});
