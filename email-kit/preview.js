// Inkpost preview: tabs, phone and desktop widths, light and dark mode, and
// the source view. The emails load into same-origin iframes so the page can
// size them and switch their dark mode rules on and off.

// The built emails point their images and links at the published kit. On a
// local copy, rewrite those URLs to this folder so the preview works before
// the kit is published.
const PUBLISHED = 'https://sandersaxbuilds.github.io/selected-work/email-kit/';
const HERE = new URL('./', location.href).href;
const LOCAL = !location.href.startsWith(PUBLISHED);

const tabs = [...document.querySelectorAll('[role="tab"]')];
const panels = [...document.querySelectorAll('[role="tabpanel"]')];
const state = {
  width: innerWidth < 720 ? 375 : 680,
  theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
};
const frames = new Map(panels.map(p => [p.dataset.id, {
  id: p.dataset.id,
  panel: p,
  stage: p.querySelector('.stage'),
  box: p.querySelector('.frame-box'),
  frame: p.querySelector('iframe'),
  note: p.querySelector('.scale-note'),
  darkRules: [],
  ready: null
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
}

function size(f) {
  const doc = f.frame.contentDocument;
  if (!doc || f.panel.hidden) return;
  const cs = getComputedStyle(f.stage);
  const avail = f.stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const scale = Math.min(1, avail / state.width);
  f.frame.style.width = state.width + 'px';
  const article = doc.querySelector('[role="article"]');
  const height = Math.ceil(article ? article.getBoundingClientRect().height : doc.documentElement.scrollHeight);
  f.frame.style.height = height + 'px';
  f.frame.style.transform = scale < 1 ? `scale(${scale})` : '';
  f.box.style.width = Math.floor(state.width * scale) + 'px';
  f.box.style.height = Math.ceil(height * scale) + 'px';
  f.note.textContent = scale < 1
    ? `${state.width} pixels wide, shown at ${Math.round(scale * 100)}% to fit this screen`
    : `${state.width} pixels wide`;
}

async function select(id, { focus = false, updateHash = true } = {}) {
  tabs.forEach(t => {
    const on = t.dataset.id === id;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    if (on && focus) t.focus();
  });
  panels.forEach(p => { p.hidden = p.dataset.id !== id; });
  if (updateHash) history.replaceState(null, '', '#' + id);
  const f = frames.get(id);
  size(f);
  await load(f);
  size(f);
}

document.querySelector('[role="tablist"]').addEventListener('keydown', e => {
  const i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  select(tabs[(next + tabs.length) % tabs.length].dataset.id, { focus: true });
});
tabs.forEach(t => t.addEventListener('click', () => select(t.dataset.id)));

document.querySelectorAll('input[name="width"]').forEach(r => r.addEventListener('change', () => {
  state.width = Number(r.value);
  frames.forEach(f => size(f));
}));
document.querySelectorAll('input[name="theme"]').forEach(r => r.addEventListener('change', () => {
  state.theme = r.value;
  frames.forEach(f => applyTheme(f));
}));

document.querySelectorAll('[data-source]').forEach(btn => btn.addEventListener('click', async () => {
  const box = document.getElementById(btn.getAttribute('aria-controls'));
  const open = btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', String(open));
  box.hidden = !open;
  const code = box.querySelector('code');
  if (open && !code.textContent) {
    try { code.textContent = await (await fetch(btn.dataset.source)).text(); }
    catch { code.textContent = 'The source could not be loaded.'; }
  }
}));

addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (frames.has(id)) select(id, { updateHash: false });
});

let resizeTimer;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => frames.forEach(f => size(f)), 80);
});

setRadio('width', state.width);
setRadio('theme', state.theme);
const fromHash = location.hash.slice(1);
const first = frames.has(fromHash) ? fromHash : tabs[0].dataset.id;
await select(first, { updateHash: frames.has(fromHash) });
document.documentElement.dataset.ready = 'true';
