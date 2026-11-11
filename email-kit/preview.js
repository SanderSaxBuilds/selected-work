// Letterkiln preview. The four stops open one email at a time in a mail
// window: desktop width, phone width or the plain text version, in light or
// dark. The emails load into same-origin iframes so the page can size them
// and switch their dark mode rules on and off.

// The built emails point their images and links at the published kit. On a
// local copy, rewrite those URLs to this folder so the preview works before
// the kit is published.
const PUBLISHED = 'https://sandersaxbuilds.github.io/selected-work/email-kit/';
const HERE = new URL('./', document.baseURI).href;
const LOCAL = !location.href.startsWith(PUBLISHED);
const narrow = matchMedia('(max-width:640px)');

const tabs = [...document.querySelectorAll('[role="tab"]')];
const panels = [...document.querySelectorAll('[role="tabpanel"]')];
const dl = document.getElementById('dl');
const tools = document.querySelector('.tools');
const state = {
  view: innerWidth < 720 ? 'phone' : 'desktop',
  theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  id: null
};
const frames = new Map(panels.map(p => [p.dataset.id, {
  id: p.dataset.id,
  panel: p,
  stage: p.querySelector('.stage'),
  box: p.querySelector('.frame-box'),
  client: p.querySelector('.client'),
  frame: p.querySelector('iframe'),
  plain: p.querySelector('.plain'),
  note: p.querySelector('.scale-note'),
  darkRules: [],
  ready: null,
  text: null
}]));

function setRadio(name, value) {
  const input = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (input) input.checked = true;
}

function load(f) {
  if (f.ready) return f.ready;
  f.ready = new Promise(resolve => {
    f.frame.addEventListener('load', () => { prepare(f); resolve(); }, { once: true });
    const src = f.frame.dataset.src;
    if (LOCAL) {
      fetch(src)
        .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(html => { f.frame.srcdoc = html.split(PUBLISHED).join(HERE); })
        .catch(() => { f.note.textContent = 'This email could not be loaded. Open the page through a web server.'; resolve(); });
    } else {
      f.frame.src = src;
    }
  });
  return f.ready;
}

function loadText(f) {
  if (f.text) return f.text;
  f.text = fetch(f.plain.dataset.text)
    .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(t => { f.plain.textContent = t; })
    .catch(() => { f.plain.textContent = 'The plain text version could not be loaded.'; });
  return f.text;
}

function prepare(f) {
  const doc = f.frame.contentDocument;
  if (!doc) return;
  f.darkRules = [];
  for (const sheet of doc.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of rules) {
      if (rule.media && /prefers-color-scheme:\s*dark/.test(rule.media.mediaText)) f.darkRules.push(rule);
    }
  }
  doc.querySelectorAll('a[href]').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
  const article = doc.querySelector('[role="article"]') || doc.body;
  new f.frame.contentWindow.ResizeObserver(() => size(f)).observe(article);
  applyTheme(f);
  size(f);
}

// Dark mode in the email is a prefers-color-scheme media query. Rewriting
// its media text to "all" or "not all" forces it on or off, whatever the
// viewer's own system setting is.
function applyTheme(f) {
  for (const rule of f.darkRules) rule.media.mediaText = state.theme === 'dark' ? 'all' : 'not all';
  f.client.dataset.theme = state.theme;
}

// Desktop and plain text sit in a mail window. Phone sits in a phone frame,
// except on a phone screen, where the screen itself is the phone.
function applyClient(f) {
  f.client.dataset.client = state.view === 'phone' && !narrow.matches ? 'phone' : 'web';
  f.client.dataset.view = state.view === 'text' ? 'text' : 'html';
  f.client.dataset.theme = state.theme;
}

// Horizontal room the frame itself takes, so the email inside keeps its true
// width or scales down as a whole.
function chromeX(f) {
  let x = 0;
  for (const el of [f.client, f.client.querySelector('.cl-body')]) {
    const s = getComputedStyle(el);
    x += parseFloat(s.paddingLeft) + parseFloat(s.paddingRight) + parseFloat(s.borderLeftWidth) + parseFloat(s.borderRightWidth);
  }
  return x;
}

function size(f) {
  if (f.panel.hidden) return;
  const cs = getComputedStyle(f.stage);
  const avail = f.stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - chromeX(f);
  if (state.view === 'text') {
    const w = Math.floor(Math.min(680, avail));
    f.client.style.width = w + chromeX(f) + 'px';
    f.note.textContent = 'The plain text version that goes out with the HTML, for mail apps that only show text.';
    return;
  }
  const doc = f.frame.contentDocument;
  const width = state.view === 'phone' ? 375 : 680;
  const scale = Math.min(1, avail / width);
  f.frame.style.width = width + 'px';
  f.box.style.width = Math.floor(width * scale) + 'px';
  f.client.style.width = Math.floor(width * scale) + chromeX(f) + 'px';
  if (!doc || !doc.body) return;
  const article = doc.querySelector('[role="article"]');
  const height = Math.ceil(article ? article.getBoundingClientRect().height : doc.documentElement.scrollHeight);
  f.frame.style.height = height + 'px';
  f.frame.style.transform = scale < 1 ? `scale(${scale})` : '';
  f.box.style.height = Math.ceil(height * scale) + 'px';
  const name = state.view === 'phone' ? 'Phone width' : 'Desktop width';
  f.note.textContent = scale < 1
    ? `${name}, ${width} pixels, shown at ${Math.round(scale * 100)}% to fit this screen.`
    : `${name}, ${width} pixels, shown at full size.`;
}

function refresh(f) {
  applyClient(f);
  if (f.panel.hidden) return;
  if (state.view === 'text') loadText(f).then(() => size(f));
  size(f);
}

async function select(id, { focus = false, updateHash = true } = {}) {
  state.id = id;
  tabs.forEach(t => {
    const on = t.dataset.id === id;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    if (on && focus) t.focus();
  });
  panels.forEach(p => { p.hidden = p.dataset.id !== id; });
  dl.href = `dist/${id}.html`;
  dl.download = `kettlewick-${id}.html`;
  if (updateHash) history.replaceState(null, '', location.pathname + location.search + '#' + id);
  const f = frames.get(id);
  refresh(f);
  await load(f);
  size(f);
}

document.querySelector('[role="tablist"]').addEventListener('keydown', e => {
  const i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  select(tabs[(next + tabs.length) % tabs.length].dataset.id, { focus: true });
});
tabs.forEach(t => t.addEventListener('click', () => {
  select(t.dataset.id);
  // when the open email has scrolled away, bring its controls back into view
  const top = tools.getBoundingClientRect().top;
  if (top < 0 || top > innerHeight * .8) tools.scrollIntoView({ block: 'start' });
}));

document.querySelectorAll('input[name="view"]').forEach(r => r.addEventListener('change', () => {
  state.view = r.value;
  frames.forEach(refresh);
}));
document.querySelectorAll('input[name="theme"]').forEach(r => r.addEventListener('change', () => {
  state.theme = r.value;
  frames.forEach(applyTheme);
}));

document.querySelectorAll('[data-source]').forEach(btn => btn.addEventListener('click', async () => {
  const box = document.getElementById(btn.getAttribute('aria-controls'));
  const open = btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', String(open));
  btn.textContent = open ? 'Hide source' : 'View source';
  box.hidden = !open;
  const code = box.querySelector('code');
  if (open && !code.textContent) {
    try { code.textContent = await (await fetch(btn.dataset.source)).text(); }
    catch { code.textContent = 'The source could not be loaded.'; }
  }
  if (open) box.scrollIntoView({ block: 'nearest' });
}));

addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (frames.has(id)) select(id, { updateHash: false });
});

let resizeTimer;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => frames.forEach(refresh), 80);
});

setRadio('view', state.view);
setRadio('theme', state.theme);
frames.forEach(applyClient);
const fromHash = location.hash.slice(1);
const first = frames.has(fromHash) ? fromHash : tabs[0].dataset.id;
await select(first, { updateHash: frames.has(fromHash) });
document.documentElement.dataset.ready = 'true';
