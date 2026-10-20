// Unit tests for the template engine, the CSS inliner and the build helpers.
// Run: node --test tests/lib.test.mjs tests/emails.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile, render } from '../lib/template.mjs';
import { parseRules, inline, minify } from '../lib/css.mjs';
import { parse, msoView, standardView, decode } from '../lib/html.mjs';
import { wrapText, money, textRow, cleanHtml } from '../build.mjs';

const run = (src, data, opts) => render(compile(src, 't'), data, opts);

test('template: values are HTML escaped, triple braces are not', () => {
  assert.equal(run('{{a}}|{{{a}}}', { a: '<b>"x" & \'y\'</b>' }), '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;|<b>"x" & \'y\'</b>');
  assert.equal(run('{{a}}', { a: 'a & b' }, { escape: v => String(v) }), 'a & b');
});

test('template: each exposes this, @index, @number, @first, @last and outer names', () => {
  const out = run('{{#each xs}}{{@index}}{{@number}}{{this}}{{#if @first}}F{{/if}}{{#if @last}}L{{/if}}{{outer}};{{/each}}', { xs: ['a', 'b', 'c'], outer: '!' });
  assert.equal(out, '01aF!;12b!;23cL!;');
  assert.equal(run('{{#each xs}}{{n}}{{/each}}', { xs: [{ n: 1 }, { n: 2 }] }), '12');
  assert.equal(run('{{#each xs}}x{{else}}empty{{/each}}', { xs: [] }), 'empty');
});

test('template: if, else and unless, with a missing value treated as false', () => {
  assert.equal(run('{{#if a}}yes{{else}}no{{/if}}', { a: 1 }), 'yes');
  assert.equal(run('{{#if a}}yes{{else}}no{{/if}}', {}), 'no');
  assert.equal(run('{{#if a}}yes{{else}}no{{/if}}', { a: [] }), 'no');
  assert.equal(run('{{#unless a}}none{{/unless}}', { a: '' }), 'none');
});

test('template: partials take quoted, path, number and boolean arguments and still see the outer data', () => {
  const partials = { btn: compile('[{{label}}|{{href}}|{{w}}|{{#if outline}}o{{/if}}|{{site}}]', 'btn') };
  const out = run('{{> btn label="Go now" href=links.go w=240 outline=true}}', { links: { go: 'https://x.test/' }, site: 'K' }, { partials });
  assert.equal(out, '[Go now|https://x.test/|240|o|K]');
});

test('template: a missing value or a bad block fails loudly with the file and line', () => {
  assert.throws(() => run('ok\n{{nope}}', {}), /Missing value "nope" in t line 2/);
  assert.throws(() => compile('{{#if a}}x', 't'), /never closed/);
  assert.throws(() => compile('{{#if a}}x{{/each}}', 't'), /does not close/);
  assert.throws(() => run('{{> missing}}', {}), /Unknown partial "missing"/);
  assert.throws(() => run('{{#each a}}{{/each}}', { a: 3 }), /not a list/);
});

test('template: a block tag alone on its line leaves no blank line behind', () => {
  assert.equal(run('a\n{{#each xs}}\n- {{this}}\n{{/each}}\nb\n', { xs: [1, 2] }), 'a\n- 1\n- 2\nb\n');
});

test('inliner: rules apply by specificity then order, and the element\'s own style wins', () => {
  const rules = parseRules('p { color: red; margin: 0 } .a { color: blue } p.a { color: green } .b { color: black }');
  const { html } = inline('<p class="a" style="margin:4px">x</p><div class="b a">y</div><p>z</p>', rules);
  assert.equal(html, '<p class="a" style="color:green;margin:4px">x</p><div class="b a" style="color:black">y</div><p style="color:red;margin:0">z</p>');
});

test('inliner: adds bgcolor and width attributes for Outlook without overwriting existing ones', () => {
  const rules = parseRules('.bg { background-color: #fffdf9 } .w { width: 36px }');
  const { html } = inline('<td class="bg w">x</td><table class="bg" bgcolor="#000000"></table><div class="bg w"></div>', rules);
  assert.match(html, /<td class="bg w" style="background-color:#fffdf9;width:36px" bgcolor="#fffdf9" width="36">/);
  assert.match(html, /<table class="bg" bgcolor="#000000" style="background-color:#fffdf9">/);
  assert.match(html, /<div class="bg w" style="background-color:#fffdf9;width:36px">/);
});

test('inliner: leaves tags inside Outlook conditional comments as written', () => {
  const rules = parseRules('td { color: red }');
  const src = '<!--[if mso]><table><tr><td width="280"><![endif]--><td>x</td>';
  assert.equal(inline(src, rules).html, '<!--[if mso]><table><tr><td width="280"><![endif]--><td style="color:red">x</td>');
});

test('inliner: refuses selectors and at-rules it cannot inline', () => {
  assert.throws(() => parseRules('.a .b { color: red }'), /tag, \.class and tag\.class/);
  assert.throws(() => parseRules('a:hover { color: red }'), /tag, \.class and tag\.class/);
  assert.throws(() => parseRules('@media screen { .a { color: red } }'), /at-rules/);
});

test('minify keeps media queries and the space in attribute plus class selectors', () => {
  const css = minify('@media screen and (max-width: 600px) {\n  .a { color : red !important; }\n}\n[data-ogsc] .x { color: #fff; }');
  assert.equal(css, '@media screen and (max-width:600px){.a{color:red !important}}[data-ogsc] .x{color:#fff}');
});

test('html: the parser rejects mismatched tags, and the two conditional views split correctly', () => {
  assert.throws(() => parse('<table><tr><td></tr></table>'), /Found <\/tr>/);
  const src = '<div><!--[if mso]><table><tr><td width="600"><![endif]--><p>x</p><!--[if mso]></td></tr></table><![endif]--><!--[if !mso]><!--><a href="#">y</a><!--<![endif]--></div>';
  assert.equal(msoView(src), '<div><table><tr><td width="600"><p>x</p></td></tr></table></div>');
  assert.equal(standardView(src), '<div><p>x</p><a href="#">y</a></div>');
  assert.doesNotThrow(() => parse(msoView(src)));
  assert.equal(decode('&pound;9&nbsp;&#8199;&#x41;'), '£9  A');
});

test('cleanHtml keeps Outlook conditional comments and drops developer comments', () => {
  const out = cleanHtml('<p>a</p>\n<!-- note -->\n<!--[if mso]><b>m</b><![endif]-->\n\n<!--[if !mso]><!--><i>n</i><!--<![endif]-->\n');
  assert.equal(out, '<p>a</p>\n<!--[if mso]><b>m</b><![endif]-->\n<!--[if !mso]><!--><i>n</i><!--<![endif]-->\n');
});

test('wrapText wraps prose at 72 characters, keeps indents and never splits a URL', () => {
  const url = 'https://sandersaxbuilds.github.io/selected-work/email-kit/sample-link.html?link=choose-first-coffee';
  const out = wrapText('word '.repeat(30).trim() + '\n    ' + 'indent '.repeat(15).trim() + '\n' + url);
  for (const line of out.split('\n')) assert.ok(line.length <= 72 || line === url, line);
  assert.ok(out.includes('\n' + url));
  assert.ok(out.split('\n').filter(l => l.includes('indent')).every(l => l.startsWith('    ')));
});

test('money and textRow format pence and right align the amount', () => {
  assert.equal(money(950), '£9.50');
  assert.equal(money(-465), '−£4.65');
  assert.equal(textRow('Subtotal', '£36.00', 20), 'Subtotal      £36.00');
});
