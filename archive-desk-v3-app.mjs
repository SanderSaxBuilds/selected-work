// Archive Desk preview app. Same ZIP core as the live page. The first screen opens on a sample project
// that is packed into a ZIP and checked file by file, once, so a visitor sees what the tool does.
import { LIMITS, buildArchive, verifyArchive, compareArchiveToFiles, createRecoveryZip, formatBytes } from './archive-desk-core.mjs'

const $ = id => document.getElementById(id)
const encoder = new TextEncoder()
const state = { files: [], sample: false, created: null, verified: null, baseline: null, comparison: null, busy: false, mode: 'create' }
const MODES = Array.from(document.querySelectorAll('[role="tab"]'), tab => tab.dataset.mode)
const stamp = () => new Date().toISOString().slice(0, 19).replaceAll(':', '-')
const total = files => files.reduce((sum, file) => sum + file.data.byteLength, 0)
const countText = count => `${count} ${count === 1 ? 'file' : 'files'}`
const dateText = value => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
const hash = async bytes => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const SVG_NS = 'http://www.w3.org/2000/svg'
let generation = 0
let packCount = 0

function svgNode(name, attrs) {
  const node = document.createElementNS(SVG_NS, name)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value))
  return node
}

// Checksum pattern: sixteen ticks from the first sixteen hex digits, a core from the next eight bytes.
// The same ZIP always draws the same pattern, a changed byte draws a different one.
function sealSvg(code) {
  const svg = svgNode('svg', { viewBox: '0 0 64 64', 'aria-hidden': 'true', focusable: 'false' })
  svg.append(svgNode('circle', { class: 'ring', cx: 32, cy: 32, r: 30 }))
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2 - Math.PI / 2
    const outer = 19 + parseInt(code[i] || '0', 16) * 0.62
    svg.append(svgNode('line', { class: 'tick draw', pathLength: 1, x1: (32 + Math.cos(angle) * 18).toFixed(2), y1: (32 + Math.sin(angle) * 18).toFixed(2), x2: (32 + Math.cos(angle) * outer).toFixed(2), y2: (32 + Math.sin(angle) * outer).toFixed(2) }))
  }
  const points = []
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 - Math.PI / 2
    const radius = 6 + (parseInt(code.slice(16 + i * 2, 18 + i * 2) || '00', 16) / 255) * 9
    points.push(`${(32 + Math.cos(angle) * radius).toFixed(2)},${(32 + Math.sin(angle) * radius).toFixed(2)}`)
  }
  svg.append(svgNode('polygon', { class: 'core', points: points.join(' ') }))
  return svg
}
const shortCode = code => `${code.slice(0, 4)} ${code.slice(4, 8)} ... ${code.slice(-8, -4)} ${code.slice(-4)}`
function renderSeal(box, code, title, note, variant = '') {
  box.replaceChildren()
  box.classList.remove('other')
  if (!code) { box.hidden = true; return }
  const text = document.createElement('div')
  const strong = document.createElement('strong')
  strong.textContent = title
  const value = document.createElement('span')
  value.textContent = shortCode(code)
  const small = document.createElement('small')
  small.textContent = note
  text.append(strong, value, small)
  box.append(sealSvg(code), text)
  if (variant) box.classList.add(variant)
  box.hidden = false
}
function verifiedSeal(archive) {
  const made = state.created?.hash
  if (!made) renderSeal($('verified-seal'), archive.hash, 'ZIP checksum', 'No backup was made on this page, so there is nothing to match it with.')
  else if (made === archive.hash) renderSeal($('verified-seal'), archive.hash, 'Same ZIP', 'Byte for byte the same as the backup made on this page.')
  else renderSeal($('verified-seal'), archive.hash, 'A different ZIP', 'Not the backup made on this page. Its own files still pass their checks.', 'other')
}

function status(message, error = false) {
  $('status').textContent = message
  $('status-bar').classList.toggle('error', error)
  $('status-bar').classList.toggle('done', !error)
  // A failure brings the status line into view.
  if (error) { const box = $('status-bar').getBoundingClientRect(); if (box.top < 0 || box.bottom > innerHeight) $('status-bar').scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }) }
}

function controls() {
  for (const element of document.querySelectorAll('main button, main input')) element.disabled = state.busy
  $('clear-selection').disabled = state.busy || !state.files.length
  $('build-archive').disabled = state.busy || !state.files.length
  $('download-backup').disabled = state.busy || !state.created
  $('download-recovered').disabled = state.busy || !state.verified
  $('use-created').disabled = state.busy || !state.created
  $('verify-created').disabled = state.busy || !state.created
  $('compare-button').disabled = state.busy || !state.baseline || !state.files.length
  $('download-report').disabled = state.busy || !state.comparison
  $('workspace').setAttribute('aria-busy', String(state.busy))
}

async function run(message, action) {
  if (state.busy) return
  fastForward()
  state.busy = true
  controls()
  status(message)
  $('status-bar').classList.add('busy')
  try { await action() } catch (error) { status(error instanceof Error ? error.message : 'This step could not finish.', true) }
  finally { state.busy = false; $('status-bar').classList.remove('busy'); controls() }
}

function mode(next, focus = false) {
  state.mode = next
  for (const tab of document.querySelectorAll('[role="tab"]')) {
    const active = tab.dataset.mode === next
    tab.setAttribute('aria-selected', String(active))
    tab.tabIndex = active ? 0 : -1
    $(`panel-${tab.dataset.mode}`).hidden = !active
  }
  if (next !== 'create') fastForward()
  if (focus) $(`tab-${next}`).focus()
}

for (const tab of document.querySelectorAll('[role="tab"]')) {
  tab.addEventListener('click', () => mode(tab.dataset.mode))
  tab.addEventListener('keydown', event => {
    const at = MODES.indexOf(state.mode)
    let next
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (at + 1) % MODES.length
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (at + MODES.length - 1) % MODES.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = MODES.length - 1
    if (next !== undefined) { event.preventDefault(); mode(MODES[next], true) }
  })
}

function row(cells, path = false) {
  const tr = document.createElement('tr')
  cells.forEach((value, index) => {
    const td = document.createElement('td')
    if (path && index === 0) {
      // Long paths may only wrap after a slash, never inside a file name.
      value.split('/').forEach((part, at, parts) => {
        td.append(at < parts.length - 1 ? part + '/' : part)
        if (at < parts.length - 1) td.append(document.createElement('wbr'))
      })
      td.className = 'path-cell'
    } else td.textContent = value
    tr.append(td)
  })
  return tr
}

// The two lists on the Create step. Paths are shown without the shared top folder, which sits in the card head.
function rootOf(files) {
  const first = files[0]?.path.split('/')
  if (!first || first.length < 2) return ''
  return files.every(file => file.path.startsWith(`${first[0]}/`)) ? first[0] : ''
}
function pathCell(path, root) {
  const shown = root ? path.slice(root.length + 1) : path
  const cut = shown.lastIndexOf('/')
  const cell = document.createElement('span')
  cell.className = 'f-path'
  cell.title = path
  if (cut >= 0) {
    const dir = document.createElement('span')
    dir.className = 'f-dir'
    dir.textContent = shown.slice(0, cut + 1)
    cell.append(dir)
  }
  const name = document.createElement('span')
  name.className = 'f-name'
  name.textContent = shown.slice(cut + 1)
  cell.append(name)
  return cell
}
function span(className, text = '') {
  const node = document.createElement('span')
  node.className = className
  node.textContent = text
  return node
}
function checkIcon() {
  const svg = svgNode('svg', { class: 'tick', viewBox: '0 0 16 16', 'aria-hidden': 'true', focusable: 'false' })
  svg.append(svgNode('path', { d: 'M3 8.5l3.2 3.2L13 4.8', pathLength: 1 }))
  return svg
}
function renderFolder() {
  const files = state.files
  const root = rootOf(files)
  $('folder-name').textContent = files.length ? (root ? `${root}/` : 'Chosen files') : 'No folder yet'
  $('folder-name').classList.toggle('is-empty', !files.length)
  $('file-count').textContent = files.length ? `${countText(files.length)}, ${formatBytes(total(files))}` : '0 files'
  $('drop-text').textContent = files.length ? 'Or drop another folder on this card.' : 'Drop a project folder here, or choose one above.'
  $('dropzone').classList.toggle('is-empty', !files.length)
  const list = $('folder-list')
  list.replaceChildren(...files.map(file => {
    const li = document.createElement('li')
    li.dataset.path = file.path
    li.append(pathCell(file.path, root), span('f-size', formatBytes(file.data.byteLength)))
    return li
  }))
}
function renderZipIdle() {
  $('zip-list').replaceChildren()
  $('zip-count').textContent = ''
  $('created-result').hidden = true
  $('zip-empty').hidden = false
  $('zip-empty').textContent = state.files.length ? `Press Create backup to pack ${countText(state.files.length)} and check each one.` : 'Nothing to pack yet.'
}
function renderZipRows(entries) {
  const root = rootOf(entries)
  const rows = entries.map(entry => {
    const li = document.createElement('li')
    li.className = 'wait'
    li.dataset.path = entry.path
    const check = span('f-check')
    check.append(checkIcon())
    li.append(check, pathCell(entry.path, root), span('f-hash', entry.sha256.slice(0, 8)), span('f-size', formatBytes(entry.bytes)))
    return li
  })
  $('zip-list').replaceChildren(...rows)
  return rows
}

// Packing, shown once per backup. Each file flies from the folder card into the ZIP, then each gets its check.
// Any other action fast-forwards it, and reduced motion shows the end state straight away.
let show = null
function fastForward() {
  if (!show) return
  show.skip = true
  for (const resolve of show.waiting.splice(0)) resolve()
  for (const flight of show.flights) { try { flight.finish() } catch { /* already done */ } }
}
function pause(ctl, ms) {
  if (ctl.skip) return Promise.resolve()
  return new Promise(resolve => { const timer = setTimeout(resolve, ms); ctl.waiting.push(() => { clearTimeout(timer); resolve() }) })
}
function fly(ctl, from, to) {
  const a = from.getBoundingClientRect()
  const b = to.getBoundingClientRect()
  const name = from.querySelector('.f-name')
  if (!a.width || !b.width || !name) return Promise.resolve()
  const chip = document.createElement('span')
  chip.className = 'flyer'
  chip.setAttribute('aria-hidden', 'true')
  chip.textContent = name.textContent
  chip.style.left = `${a.left + 12}px`
  chip.style.top = `${a.top + a.height / 2 - 16}px`
  document.documentElement.append(chip)
  const dx = b.left + 40 - a.left - 12
  const dy = b.top + b.height / 2 - (a.top + a.height / 2)
  const lift = Math.abs(dy) < 60 ? -34 : 0
  const flight = chip.animate([
    { transform: 'translate(0, 0) rotate(0deg)', offset: 0 },
    { transform: `translate(${dx / 2}px, ${dy / 2 + lift}px) rotate(-3deg)`, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) rotate(0deg)`, offset: 1 }
  ], { duration: 640, easing: 'cubic-bezier(.45, 0, .25, 1)' })
  ctl.flights.push(flight)
  return flight.finished.catch(() => {}).then(() => chip.remove())
}
async function packShow(entries) {
  fastForward()
  const ctl = { skip: reduced(), waiting: [], flights: [] }
  show = ctl
  const zipRows = renderZipRows(entries)
  const sources = new Map(Array.from($('folder-list').children, li => [li.dataset.path, li]))
  const flying = entries.length <= 10
  const gap = flying ? 150 : Math.max(6, Math.min(40, 700 / entries.length))
  const landings = []
  for (const [index, entry] of entries.entries()) {
    const target = zipRows[index]
    const source = sources.get(entry.path)
    const land = () => { target.classList.remove('wait'); source?.classList.add('packed') }
    if (flying && !ctl.skip && source) landings.push(fly(ctl, source, target).then(land))
    else land()
    await pause(ctl, gap)
  }
  await Promise.all(landings)
  await pause(ctl, 240)
  const tick = Math.max(6, Math.min(150, 900 / entries.length))
  for (const target of zipRows) { target.classList.add('ok'); await pause(ctl, tick) }
  if (show === ctl) show = null
}

// Builds the ZIP, reopens it to check every file, then shows the result. Returns false if the files changed meanwhile.
async function makeBackup() {
  const pack = ++packCount
  const ticket = generation
  const current = () => ticket === generation && pack === packCount
  state.created = null
  $('created-result').hidden = true
  const bytes = await buildArchive(state.files)
  const result = await verifyArchive(bytes)
  const name = $('archive-name').value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'project-backup'
  const code = await hash(bytes)
  if (!current()) return false
  state.created = { bytes, hash: code, name: `${name}-${stamp()}.archive.zip` }
  $('zip-empty').hidden = true
  $('zip-count').textContent = 'Packing'
  controls()
  await packShow(result.files)
  if (!current()) return false
  const count = result.files.length
  $('zip-count').textContent = `${count} of ${count} checked`
  $('created-size').textContent = `${countText(count)} packed and checked. ZIP size ${formatBytes(bytes.length)}.`
  $('created-name').textContent = state.created.name
  $('created-hash').textContent = code
  renderSeal($('created-seal'), code, 'ZIP checksum', 'If a saved copy shows the same code, nothing in it changed.')
  $('created-result').hidden = false
  controls()
  return true
}

function clearComparison() {
  state.comparison = null
  $('comparison-result').hidden = true
  $('comparison-rows').replaceChildren()
}

function selection(files, message, sample = false) {
  fastForward()
  generation += 1
  state.files = files
  state.sample = sample
  state.created = null
  clearComparison()
  renderFolder()
  renderZipIdle()
  $('compare-current').textContent = files.length ? `${countText(files.length)}, ${formatBytes(total(files))}` : '0 files'
  $('sensitive-notice').hidden = !files.some(file => /(^|\/)(\.env(?:\..*)?|id_(?:rsa|dsa|ed25519)|.*\.(?:pem|key|p12|pfx))$/i.test(file.path))
  status(message)
  controls()
}

let replacementPending = false
async function replaceAllowed() {
  if (!state.files.length || state.sample) return true
  if (replacementPending) return false
  replacementPending = true
  const dialog = $('replace-dialog')
  return new Promise(resolve => {
    const finish = allowed => {
      dialog.close()
      replacementPending = false
      $('replace-yes').removeEventListener('click', yes)
      $('replace-no').removeEventListener('click', no)
      dialog.removeEventListener('cancel', cancel)
      resolve(allowed)
    }
    const yes = () => finish(true)
    const no = () => finish(false)
    const cancel = event => { event.preventDefault(); finish(false) }
    $('replace-yes').addEventListener('click', yes)
    $('replace-no').addEventListener('click', no)
    dialog.addEventListener('cancel', cancel)
    dialog.showModal()
  })
}

// Accepts File objects from an input, or { file, path } pairs from a dropped folder.
async function chooseFiles(list) {
  const items = Array.from(list, item => item instanceof File ? { file: item, path: item.webkitRelativePath || item.name } : item)
  if (!items.length || state.busy || !await replaceAllowed()) return
  await run('Reading your files. The originals are not changed.', async () => {
    if (items.length > LIMITS.maxFiles) throw new Error('Choose no more than 500 files.')
    if (items.some(item => item.file.size > LIMITS.maxFileBytes)) throw new Error('Each file must be 20 MiB or smaller.')
    if (items.reduce((sum, item) => sum + item.file.size, 0) > LIMITS.maxTotalBytes) throw new Error('These files add up to more than 50 MiB.')
    const loaded = []
    for (const item of items) loaded.push({ path: item.path, data: new Uint8Array(await item.file.arrayBuffer()), modifiedAt: item.file.lastModified })
    // The core checks paths and name clashes before the list replaces anything.
    await buildArchive(loaded)
    mode('create')
    selection(loaded, `${countText(loaded.length)} ready. Check the list, then press Create backup.`)
  })
}

$('choose-files').addEventListener('click', () => $('files-input').click())
$('choose-folder').addEventListener('click', () => $('folder-input').click())
for (const id of ['files-input', 'folder-input']) $(id).addEventListener('change', async event => {
  const files = Array.from(event.target.files)
  event.target.value = ''
  await chooseFiles(files)
})
$('clear-selection').addEventListener('click', async () => { if (await replaceAllowed()) selection([], 'List cleared. Your files on disk were not changed.') })

// Drag and drop. Folders are walked so their paths survive, and a stray drop never opens the file in the tab.
const hasFiles = event => !!event.dataTransfer && Array.from(event.dataTransfer.types || []).includes('Files')
async function droppedFiles(transfer) {
  const entries = Array.from(transfer.items || []).filter(item => item.kind === 'file').map(item => item.webkitGetAsEntry ? item.webkitGetAsEntry() : null)
  const plain = Array.from(transfer.files || [])
  if (!entries.length || entries.some(entry => !entry)) return plain.map(file => ({ file, path: file.name }))
  const found = []
  const walk = async (entry, prefix) => {
    if (found.length > LIMITS.maxFiles) return
    if (entry.isFile) found.push({ file: await new Promise((resolve, reject) => entry.file(resolve, reject)), path: prefix + entry.name })
    else if (entry.isDirectory) {
      const reader = entry.createReader()
      let batch
      do {
        batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject))
        for (const child of batch) await walk(child, `${prefix}${entry.name}/`)
      } while (batch.length && found.length <= LIMITS.maxFiles)
    }
  }
  for (const entry of entries) await walk(entry, '')
  return found
}
const dropzone = $('dropzone')
for (const type of ['dragenter', 'dragover']) dropzone.addEventListener(type, event => {
  if (!hasFiles(event) || state.busy) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'copy'
  dropzone.classList.add('drag-over')
})
dropzone.addEventListener('dragleave', event => { if (!dropzone.contains(event.relatedTarget)) dropzone.classList.remove('drag-over') })
dropzone.addEventListener('drop', async event => {
  if (!hasFiles(event)) return
  event.preventDefault()
  dropzone.classList.remove('drag-over')
  if (state.busy) return
  let files
  try { files = await droppedFiles(event.dataTransfer) } catch { status('The dropped items could not be read. Try Choose folder instead.', true); return }
  if (!files.length) { status('No files were found in what you dropped.', true); return }
  await chooseFiles(files)
})
window.addEventListener('dragover', event => { if (hasFiles(event)) event.preventDefault() })
window.addEventListener('drop', event => {
  if (!hasFiles(event) || dropzone.contains(event.target)) return
  event.preventDefault()
  if (state.mode === 'create') status('Drop files on the Project folder card to add them.')
})

// A small fictional website. The cover image is filler bytes, it is never shown.
const SAMPLE_TIME = 1792281600000
function filler(size, seed) {
  const bytes = new Uint8Array(size)
  let x = seed
  for (let i = 0; i < size; i++) { x = (x * 1103515245 + 12345) >>> 0; bytes[i] = x >>> 24 }
  bytes.set([0xff, 0xd8, 0xff, 0xe0], 0)
  bytes.set([0xff, 0xd9], size - 2)
  return bytes
}
const page = (title, body) => encoder.encode(`<!doctype html>\n<html lang="en">\n<meta charset="utf-8">\n<title>${title} | North Studio</title>\n<link rel="stylesheet" href="assets/theme.css">\n<img src="assets/logo.svg" alt="North Studio">\n${body}\n</html>\n`)
const demoFiles = () => [
  { path: 'website/index.html', data: page('Home', '<h1>Tables and shelves, made to order.</h1>\n<img src="images/cover.jpg" alt="Oak table in a bright room">\n<p>Small batches from our workshop in Leith. Delivery in four to six weeks.</p>'), modifiedAt: SAMPLE_TIME },
  { path: 'website/about.html', data: page('About', '<h1>About the workshop</h1>\n<p>Three makers, one bench saw, and timber from within 200 km.</p>'), modifiedAt: SAMPLE_TIME },
  { path: 'website/assets/theme.css', data: encoder.encode(':root { --ink: #1f2a26; --paper: #f5f2ea; }\nbody { margin: 0; font-family: system-ui, sans-serif; color: var(--ink); background: var(--paper); }\nh1 { font-size: 2.4rem; line-height: 1.1; }\nimg { max-width: 100%; height: auto; }\n'), modifiedAt: SAMPLE_TIME },
  { path: 'website/assets/logo.svg', data: encoder.encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="8" y="8" width="48" height="48" fill="none" stroke="#1f2a26" stroke-width="4"/><path d="M20 44V20l24 24V20" fill="none" stroke="#1f2a26" stroke-width="4"/></svg>\n'), modifiedAt: SAMPLE_TIME },
  { path: 'website/images/cover.jpg', data: filler(18 * 1024 + 310, 7), modifiedAt: SAMPLE_TIME },
  { path: 'website/notes/release.txt', data: encoder.encode('Sample files for the Archive Desk demo. No client data.\n'), modifiedAt: SAMPLE_TIME }
]
const editedFiles = () => {
  const files = demoFiles().filter(file => !file.path.endsWith('release.txt'))
  files[0].data = page('Home', '<h1>Tables, shelves and benches, made to order.</h1>\n<img src="images/cover.jpg" alt="Oak table in a bright room">\n<p>New: outdoor benches in larch.</p>')
  files.push({ path: 'website/README.txt', data: encoder.encode('Added after the first backup.\n'), modifiedAt: SAMPLE_TIME + 3600000 })
  return files
}

function setBaseline(archive) {
  state.baseline = archive
  clearComparison()
  $('compare-baseline-name').textContent = archive ? `${archive.name}, ${countText(archive.result.files.length)}` : 'No backup chosen.'
  $('compare-baseline-name').classList.toggle('is-set', !!archive)
}
$('load-changed-demo').addEventListener('click', async () => {
  if (!await replaceAllowed()) return
  if (state.baseline) { selection(editedFiles(), 'Edited sample loaded as B. Press Compare.', true); return }
  await run('Making the original sample backup to compare with.', async () => {
    const bytes = await buildArchive(demoFiles())
    setBaseline({ bytes, result: await verifyArchive(bytes), hash: await hash(bytes), name: 'sample-backup.archive.zip' })
    selection(editedFiles(), 'Edited sample loaded as B, with the original sample backup as A. Press Compare.', true)
  })
})
$('back-to-files').addEventListener('click', () => mode('create', true))

$('build-archive').addEventListener('click', () => run('Packing the files into a ZIP and checking each one.', async () => {
  if (await makeBackup()) status('Backup created and every file checked. Download it, then open the saved copy in Verify.')
}))

function download(bytes, name, type = 'application/zip') {
  const url = URL.createObjectURL(new Blob([bytes], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  status(`Download started: ${name}. Find it in your browser downloads.`)
}
$('download-backup').addEventListener('click', () => { if (state.created) download(state.created.bytes, state.created.name) })

// Plain reasons for files that are not Archive Desk backups at all.
async function checkArchive(bytes) {
  if (!bytes.length) throw new Error('This file is empty. Choose a backup ZIP made by Archive Desk.')
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) throw new Error('This file is not a ZIP. Choose a backup ZIP made by Archive Desk.')
  try { return await verifyArchive(bytes) } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/end record/.test(message)) throw new Error('This ZIP is incomplete or was not made by Archive Desk. It opens its own backups only.')
    if (/exactly one ArchiveDesk\/manifest\.json/.test(message)) throw new Error('This ZIP has no Archive Desk file list. It may be a recovered copy or a ZIP from another app. Choose the original backup.')
    throw new Error(`This backup failed its check. ${message}`)
  }
}

async function readArchive(file) {
  if (file.size > LIMITS.maxTotalBytes + 2 * 1024 * 1024) throw new Error('This ZIP is larger than the 52 MiB limit for opening backups.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const result = await checkArchive(bytes)
  return { bytes, result, hash: await hash(bytes), name: file.name }
}

async function showVerified(name, load, saved) {
  state.verified = null
  $('verified-result').hidden = true
  $('verified-seal').hidden = true
  $('verified-rows').replaceChildren()
  $('verify-file-name').textContent = name
  const archive = await load()
  state.verified = archive
  $('verified-summary').textContent = `${countText(archive.result.files.length)} checked${saved ? '' : ' on this page'}. Nothing was uploaded.`
  $('verified-date').textContent = dateText(archive.result.manifest.createdAt)
  $('verified-bytes').textContent = formatBytes(archive.bytes.length)
  for (const entry of archive.result.files) $('verified-rows').append(row([entry.path, formatBytes(entry.bytes), entry.sha256], true))
  verifiedSeal(archive)
  $('verified-result').hidden = false
  status(saved
    ? 'Every file in the ZIP matches. You can download the files.'
    : 'The backup on this page passed. Download it and open the saved file here to check the copy on your disk.')
}
$('verify-input').addEventListener('change', async event => {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  await run('Checking the ZIP and every file in it.', () => showVerified(file.name, () => readArchive(file), true))
})
$('verify-created').addEventListener('click', () => run('Checking the backup made on this page.', async () => {
  if (!state.created) throw new Error('Create a backup first.')
  const { name, hash: code } = state.created
  await showVerified(`${name}, made on this page`, async () => { const bytes = state.created.bytes.slice(); return { bytes, result: await checkArchive(bytes), hash: code, name } }, false)
}))
$('download-recovered').addEventListener('click', () => run('Checking the ZIP again before saving the files.', async () => {
  if (!state.verified) throw new Error('Choose and check a ZIP first.')
  const bytes = await createRecoveryZip(state.verified.bytes)
  download(bytes, `archive-desk-files-${stamp()}.zip`)
}))

$('choose-compare').addEventListener('click', () => $('compare-input').click())
$('compare-input').addEventListener('change', async event => {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  await run('Checking the saved backup.', async () => {
    setBaseline(null)
    $('compare-baseline-name').textContent = file.name
    setBaseline(await readArchive(file))
    status(state.files.length ? 'Saved backup checked. Press Compare.' : 'Saved backup checked. Now choose the current files.')
  })
})
$('use-created').addEventListener('click', () => run('Checking the backup made on this page.', async () => {
  if (!state.created) throw new Error('Create a backup first.')
  const bytes = state.created.bytes.slice()
  setBaseline({ bytes, result: await verifyArchive(bytes), hash: state.created.hash, name: state.created.name })
  status('The backup made on this page is now A. Change the files, then press Compare.')
}))
function renderComparison() {
  $('comparison-rows').replaceChildren()
  if (!state.comparison) return
  const rows = state.comparison.rows.filter(entry => $('show-unchanged').checked || entry.status !== 'unchanged')
  for (const entry of rows) {
    const tr = row([entry.path, '', entry.beforeBytes === null ? '-' : formatBytes(entry.beforeBytes), entry.afterBytes === null ? '-' : formatBytes(entry.afterBytes)], true)
    const badge = document.createElement('span')
    badge.className = `change-badge ${entry.status}`
    badge.textContent = entry.status[0].toUpperCase() + entry.status.slice(1)
    tr.children[1].append(badge)
    $('comparison-rows').append(tr)
  }
  if (!rows.length) {
    const tr = row(['No differences. Turn on Show unchanged files to see every file.'])
    tr.className = 'empty-row'
    tr.firstChild.colSpan = 4
    $('comparison-rows').append(tr)
  }
}
$('compare-button').addEventListener('click', () => run('Comparing the files by name and content.', async () => {
  clearComparison()
  const result = await compareArchiveToFiles(state.baseline.bytes, state.files)
  state.comparison = { format: 'archive-desk-comparison', version: 1, createdAt: new Date().toISOString(), baselineSha256: state.baseline.hash, ...result }
  for (const [key, count] of Object.entries(result.counts)) $(`count-${key}`).textContent = String(count)
  $('comparison-result').hidden = false
  renderComparison()
  const c = result.counts
  status(`Done. ${c.added} added, ${c.changed} changed, ${c.removed} removed, ${c.unchanged} unchanged. No files were edited.`)
}))
$('show-unchanged').addEventListener('change', renderComparison)
$('download-report').addEventListener('click', () => {
  if (state.comparison) download(JSON.stringify(state.comparison, null, 2) + '\n', `archive-desk-comparison-${stamp()}.json`, 'application/json')
})

// The full sample, all three steps. It presses the real buttons in order. Reduced motion keeps the steps with short pauses.
const beat = ms => new Promise(resolve => setTimeout(resolve, reduced() ? 150 : ms))
const settle = async () => { await new Promise(resolve => setTimeout(resolve, 40)); while (state.busy) await new Promise(resolve => setTimeout(resolve, 40)); return !$('status-bar').classList.contains('error') }
let touring = false
$('run-tour').addEventListener('click', async () => {
  if (touring || state.busy || !await replaceAllowed()) return
  touring = true
  $('run-tour').textContent = 'Running the sample'
  $('run-tour').classList.add('running')
  try {
    mode('create')
    document.querySelector('.rail').scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' })
    selection(demoFiles(), 'Step 1 of 3. Packing the sample project into a ZIP.', true)
    await beat(500)
    $('build-archive').click()
    if (!await settle()) return
    status('Step 1 of 3. All 6 sample files are in the ZIP, and each one passed its check.')
    await beat(2200)
    mode('verify')
    $('verify-created').click()
    if (!await settle()) return
    status('Step 2 of 3. The ZIP was opened again and every file matched.')
    await beat(2400)
    mode('compare')
    $('use-created').click()
    if (!await settle()) return
    selection(editedFiles(), 'Step 3 of 3. An edited copy of the project is loaded as B.', true)
    await beat(900)
    $('compare-button').click()
    if (!await settle()) return
    const c = state.comparison.counts
    status(`Done. Compared with the backup, the edited copy has ${c.added} added, ${c.changed} changed, ${c.removed} removed and ${c.unchanged} unchanged files. Now try your own folder.`)
    const result = $('comparison-result').getBoundingClientRect()
    if (result.bottom > innerHeight) $('comparison-result').scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' })
  } finally {
    touring = false
    $('run-tour').textContent = 'Run the sample through all 3 steps'
    $('run-tour').classList.remove('running')
    // The button was disabled while each step ran, so give focus back to it.
    if (document.activeElement === document.body) $('run-tour').focus({ preventScroll: true })
  }
})

// The name field is as wide as the name, so .zip sits right after it.
const nameField = $('archive-name')
const fitName = () => { nameField.size = Math.max(6, Math.min(40, nameField.value.length)) }
nameField.addEventListener('input', fitName)
fitName()

// First screen: the sample project is packed and checked once.
selection(demoFiles(), 'Packing the sample project into a ZIP.', true)
;(async () => {
  try { await document.fonts?.ready } catch { /* fonts are optional */ }
  await new Promise(resolve => setTimeout(resolve, reduced() ? 0 : 450))
  if (!state.sample || state.busy || state.created) return
  try {
    if (await makeBackup()) status('Sample done. 6 files packed into a ZIP and checked. Choose a folder to back up your own files.')
  } catch (error) { status(error instanceof Error ? error.message : 'The sample could not run.', true) }
})()
