import { LIMITS, buildArchive, verifyArchive, compareArchiveToFiles, createRecoveryZip, formatBytes } from './archive-desk-protection-core.mjs'
import { protectArchive, unlockArchive, inspectLockedFile, PROTECTION } from './archive-desk-protection-envelope.mjs'

const $ = id => document.getElementById(id)
const encoder = new TextEncoder()
const state = { files: [], created: null, verified: null, baseline: null, comparison: null, busy: false, mode: 'create', protectionSource: null, protected: null, locked: null, unlocked: null }
const MODES = Array.from(document.querySelectorAll('[role="tab"]'), tab => tab.dataset.mode)
const stamp = () => new Date().toISOString().slice(0, 19).replaceAll(':', '-')
const total = files => files.reduce((sum, file) => sum + file.data.byteLength, 0)
const countText = count => `${count} ${count === 1 ? 'file' : 'files'}`
const dateText = value => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
const hash = async bytes => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))

function status(message, error = false) {
  $('status').textContent = message
  $('status-bar').classList.toggle('error', error)
  $('status-bar').classList.toggle('done', !error)
  // The log line sits under the tabs. A failure further down the page brings it into view.
  if (error) { const box = $('status-bar').getBoundingClientRect(); if (box.top < 0 || box.bottom > innerHeight) $('status-bar').scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }) }
}

function controls() {
  for (const element of document.querySelectorAll('button,input')) element.disabled = state.busy
  $('clear-selection').disabled = state.busy || !state.files.length
  $('build-archive').disabled = state.busy || !state.files.length
  $('download-backup').disabled = state.busy || !state.created
  $('download-recovered').disabled = state.busy || !state.verified
  $('use-created').disabled = state.busy || !state.created
  $('verify-created').disabled = state.busy || !state.created
  $('compare-button').disabled = state.busy || !state.baseline || !state.files.length
  $('download-report').disabled = state.busy || !state.comparison
  $('protect-created').disabled = state.busy || !state.created
  $('protect-button').disabled = state.busy || !state.protectionSource
  $('download-protected').disabled = state.busy || !state.protected
  $('unlock-button').disabled = state.busy || !state.locked
  $('download-unlocked').disabled = state.busy || !state.unlocked
  $('workspace').setAttribute('aria-busy', String(state.busy))
}

async function run(message, action) {
  if (state.busy) return
  state.busy = true
  controls()
  status(message)
  $('status-bar').classList.add('busy')
  try { await action() } catch (error) { status(error instanceof Error ? error.message : 'The operation could not finish.', true) }
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
  if (focus) $(`tab-${next}`).focus()
}

for (const tab of document.querySelectorAll('[role="tab"]')) {
  tab.addEventListener('click', () => mode(tab.dataset.mode))
  tab.addEventListener('keydown', event => {
    const at = MODES.indexOf(state.mode)
    let next
    if (event.key === 'ArrowRight') next = (at + 1) % MODES.length
    if (event.key === 'ArrowLeft') next = (at + MODES.length - 1) % MODES.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = MODES.length - 1
    if (next !== undefined) { event.preventDefault(); mode(MODES[next], true) }
  })
}

function row(cells) {
  const tr = document.createElement('tr')
  for (const value of cells) {
    const td = document.createElement('td')
    td.textContent = value
    tr.append(td)
  }
  return tr
}

function clearComparison() {
  state.comparison = null
  $('comparison-result').hidden = true
  $('comparison-rows').replaceChildren()
}

function selection(files, message) {
  state.files = files
  state.created = null
  clearComparison()
  $('created-result').hidden = true
  $('check-created').classList.remove('done')
  $('check-reopened').classList.remove('done')
  $('check-selection').classList.toggle('done', !!files.length)
  $('file-count').textContent = `${countText(files.length)} selected`
  $('file-bytes').textContent = formatBytes(total(files))
  $('compare-current').textContent = `${countText(files.length)} selected, ${formatBytes(total(files))}`
  $('selection-rows').replaceChildren()
  if (!files.length) {
    const empty = row(['No files yet. Try the sample files or choose a project.'])
    empty.className = 'empty-row'
    empty.firstChild.colSpan = 3
    $('selection-rows').append(empty)
  } else for (const file of files) $('selection-rows').append(row([file.path, formatBytes(file.data.byteLength), dateText(file.modifiedAt)]))
  $('sensitive-notice').hidden = !files.some(file => /(^|\/)(\.env(?:\..*)?|id_(?:rsa|dsa|ed25519)|.*\.(?:pem|key|p12|pfx))$/i.test(file.path))
  status(message)
  controls()
}

let replacementPending = false
async function replaceAllowed() {
  if (!state.files.length) return true
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
  await run('Reading the selected files. Your original files will not be changed.', async () => {
    if (items.length > LIMITS.maxFiles) throw new Error('Choose no more than 500 files.')
    if (items.some(item => item.file.size > LIMITS.maxFileBytes)) throw new Error('Each file must be no larger than 20 MiB.')
    if (items.reduce((sum, item) => sum + item.file.size, 0) > LIMITS.maxTotalBytes) throw new Error('The selected files exceed 50 MiB.')
    const loaded = []
    for (const item of items) loaded.push({ path: item.path, data: new Uint8Array(await item.file.arrayBuffer()), modifiedAt: item.file.lastModified })
    // The core validates paths and collisions before the selection can replace existing work.
    await buildArchive(loaded)
    selection(loaded, `${countText(loaded.length)} ready. Check the paths, then create your backup.`)
  })
}

$('choose-files').addEventListener('click', () => $('files-input').click())
$('choose-folder').addEventListener('click', () => $('folder-input').click())
for (const id of ['files-input', 'folder-input']) $(id).addEventListener('change', async event => {
  const files = Array.from(event.target.files)
  event.target.value = ''
  await chooseFiles(files)
})
$('clear-selection').addEventListener('click', async () => { if (await replaceAllowed()) selection([], 'Selection cleared. Original files were not changed.') })

// Drag and drop. Folder entries are walked so relative paths survive, and stray drops never open the file in the tab.
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
  if (state.mode === 'create') status('Drop files on the dashed area to add them to the backup.')
})

const demoFiles = () => [
  { path: 'website/index.html', data: encoder.encode('<!doctype html>\n<title>North Studio</title>\n<h1>A small project, preserved.</h1>\n'), modifiedAt: 1792281600000 },
  { path: 'website/assets/theme.css', data: encoder.encode('body { font-family: system-ui; color: #123a36; }\n'), modifiedAt: 1792281600000 },
  { path: 'website/notes/release.txt', data: encoder.encode('Sample files for the Archive Desk demo. No client data.\n'), modifiedAt: 1792281600000 },
  { path: 'website/data.bin', data: new Uint8Array([0, 1, 2, 255, 128, 0]), modifiedAt: 1792281600000 }
]
$('load-demo').addEventListener('click', async () => {
  if (!await replaceAllowed()) return
  selection(demoFiles(), 'Four sample files loaded. Create a backup to try the full check and recovery flow.')
  mode('create')
})

function setBaseline(archive) {
  state.baseline = archive
  clearComparison()
  $('compare-baseline-name').textContent = archive ? `${archive.name}, ${countText(archive.result.files.length)}` : 'No backup chosen yet.'
  $('compare-baseline-name').classList.toggle('is-set', !!archive)
}
$('load-changed-demo').addEventListener('click', async () => {
  if (!await replaceAllowed()) return
  const files = demoFiles().filter(file => !file.path.endsWith('release.txt'))
  files[0].data = encoder.encode('<!doctype html>\n<title>North Studio</title>\n<h1>A revised homepage.</h1>\n')
  files.push({ path: 'website/README.txt', data: encoder.encode('Added after the first backup.\n'), modifiedAt: 1792285200000 })
  if (state.baseline) { selection(files, 'Changed sample loaded. Select Compare to see what moved.'); return }
  await run('Preparing the original sample backup to compare against.', async () => {
    const bytes = await buildArchive(demoFiles())
    setBaseline({ bytes, result: await verifyArchive(bytes), hash: await hash(bytes), name: 'sample-backup.archive.zip' })
    selection(files, 'Changed sample loaded, with the original sample backup as A. Select Compare to see what moved.')
  })
})
$('back-to-files').addEventListener('click', () => mode('create', true))

$('build-archive').addEventListener('click', () => run('Creating the ZIP and checking its file fingerprints.', async () => {
  state.created = null
  $('created-result').hidden = true
  $('check-created').classList.remove('done')
  $('check-reopened').classList.remove('done')
  const bytes = await buildArchive(state.files)
  await verifyArchive(bytes)
  const name = $('archive-name').value.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'project-backup'
  state.created = { bytes, hash: await hash(bytes), name: `${name}-${stamp()}.archive.zip` }
  $('created-name').textContent = state.created.name
  $('created-size').textContent = `${countText(state.files.length)}, ${formatBytes(bytes.length)}`
  $('created-hash').textContent = state.created.hash
  $('created-result').hidden = false
  $('check-created').classList.add('done')
  status('Backup created and checked. Download it, then open the saved ZIP in Verify.')
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
  status(`Download started: ${name}. Check your browser downloads for the saved file.`)
}
$('download-backup').addEventListener('click', () => { if (state.created) download(state.created.bytes, state.created.name) })

// Plain-language reasons for files that are not Archive Desk backups at all.
async function checkArchive(bytes) {
  if (!bytes.length) throw new Error('This file is empty. Choose a backup ZIP made by Archive Desk.')
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) throw new Error('This file is not a ZIP archive. Choose a backup ZIP made by Archive Desk.')
  try { return await verifyArchive(bytes) } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (/end record/.test(message)) throw new Error('This ZIP is incomplete or was not made by Archive Desk. Archive Desk opens its own uncompressed backups only.')
    if (/exactly one ArchiveDesk\/manifest\.json/.test(message)) throw new Error('This ZIP has no Archive Desk manifest. It may be a recovered copy or a ZIP from another app. Choose the original backup instead.')
    throw new Error(`This backup failed its check. ${message}`)
  }
}

async function readArchive(file) {
  if (file.size > LIMITS.maxTotalBytes + 2 * 1024 * 1024) throw new Error('This archive is larger than the 52 MiB limit for opening backups.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const result = await checkArchive(bytes)
  return { bytes, result, hash: await hash(bytes), name: file.name }
}

// Shared by the file picker and the in-tab check. Only a reopened saved file completes check 3.
async function showVerified(name, load, saved) {
  state.verified = null
  $('verified-result').hidden = true
  $('verified-rows').replaceChildren()
  $('verify-file-name').textContent = name
  $('check-reopened').classList.remove('done')
  const archive = await load()
  state.verified = archive
  $('verified-summary').textContent = `${countText(archive.result.files.length)} verified${saved ? '' : ' in this tab'}. Nothing was uploaded.`
  $('verified-date').textContent = dateText(archive.result.manifest.createdAt)
  $('verified-bytes').textContent = formatBytes(archive.bytes.length)
  for (const entry of archive.result.files) $('verified-rows').append(row([entry.path, formatBytes(entry.bytes), entry.sha256]))
  $('verified-result').hidden = false
  $('check-reopened').classList.toggle('done', saved && archive.hash === state.created?.hash)
  status(saved
    ? 'The archive passed every file check. You can now download a recovery copy.'
    : 'The copy held in this tab passed every file check. Download it and open the saved file here to complete check 3.')
}
$('verify-input').addEventListener('change', async event => {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  await run('Checking the ZIP structure, file CRC values and SHA-256 fingerprints.', () => showVerified(file.name, () => readArchive(file), true))
})
$('verify-created').addEventListener('click', () => run('Checking the backup held in this tab.', async () => {
  if (!state.created) throw new Error('Create a backup first.')
  const { name, hash: sha } = state.created
  await showVerified(`${name}, held in this tab`, async () => { const bytes = state.created.bytes.slice(); return { bytes, result: await checkArchive(bytes), hash: sha, name } }, false)
}))
$('download-recovered').addEventListener('click', () => run('Checking the archive again before exporting the files.', async () => {
  if (!state.verified) throw new Error('Choose and verify an archive first.')
  const bytes = await createRecoveryZip(state.verified.bytes)
  download(bytes, `archive-desk-recovered-${stamp()}.zip`)
}))

$('choose-compare').addEventListener('click', () => $('compare-input').click())
$('compare-input').addEventListener('change', async event => {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  await run('Checking the saved backup for comparison.', async () => {
    setBaseline(null)
    $('compare-baseline-name').textContent = file.name
    setBaseline(await readArchive(file))
    status(state.files.length ? 'Saved backup verified. Select Compare to see what changed.' : 'Saved backup verified. Now choose the current files.')
  })
})
$('use-created').addEventListener('click', () => run('Checking the backup just created.', async () => {
  if (!state.created) throw new Error('Create a backup first.')
  const bytes = state.created.bytes.slice()
  setBaseline({ bytes, result: await verifyArchive(bytes), hash: state.created.hash, name: state.created.name })
  status('The backup just created is now A. Change or reload the files, then select Compare.')
}))
function renderComparison() {
  $('comparison-rows').replaceChildren()
  if (!state.comparison) return
  const rows = state.comparison.rows.filter(row => $('show-unchanged').checked || row.status !== 'unchanged')
  for (const entry of rows) {
    const tr = row([entry.path, '', entry.beforeBytes === null ? '-' : formatBytes(entry.beforeBytes), entry.afterBytes === null ? '-' : formatBytes(entry.afterBytes)])
    const badge = document.createElement('span')
    badge.className = `change-badge ${entry.status}`
    badge.textContent = entry.status[0].toUpperCase() + entry.status.slice(1)
    tr.children[1].append(badge)
    $('comparison-rows').append(tr)
  }
  if (!rows.length) {
    const tr = row(['No differences. Turn on Show unchanged files to see the matching paths.'])
    tr.className = 'empty-row'
    tr.firstChild.colSpan = 4
    $('comparison-rows').append(tr)
  }
}
$('compare-button').addEventListener('click', () => run('Comparing relative paths and file contents.', async () => {
  clearComparison()
  const result = await compareArchiveToFiles(state.baseline.bytes, state.files)
  state.comparison = { format: 'archive-desk-comparison', version: 1, createdAt: new Date().toISOString(), baselineSha256: state.baseline.hash, ...result }
  for (const [key, count] of Object.entries(result.counts)) $(`count-${key}`).textContent = String(count)
  $('comparison-result').hidden = false
  renderComparison()
  status(`Comparison complete. ${result.counts.added} added, ${result.counts.changed} changed, ${result.counts.removed} removed and ${result.counts.unchanged} unchanged. No files were edited.`)
}))
$('show-unchanged').addEventListener('change', renderComparison)
$('download-report').addEventListener('click', () => {
  if (state.comparison) download(JSON.stringify(state.comparison, null, 2) + '\n', `archive-desk-comparison-${stamp()}.json`, 'application/json')
})

function clearProtected() {
  state.protected = null
  $('protected-result').hidden = true
}
function clearUnlocked() {
  state.unlocked = null
  $('unlocked-result').hidden = true
  $('unlocked-rows').replaceChildren()
}
function setProtectionSource(archive) {
  state.protectionSource = archive
  clearProtected()
  $('protect-passphrase').value = ''
  $('protect-confirm').value = ''
  $('protect-source-name').textContent = archive ? archive.name : 'No source ZIP selected'
}
$('protect-created').addEventListener('click', () => {
  if (!state.created) return
  setProtectionSource({ bytes: state.created.bytes.slice(), name: state.created.name })
  status('The backup just created is selected. Enter a unique passphrase to lock a separate copy.')
  controls()
  $('protect-passphrase').focus()
})
$('protect-source-input').addEventListener('change', async event => {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  await run('Checking the source ZIP before protection.', async () => {
    setProtectionSource(null)
    const archive = await readArchive(file)
    setProtectionSource(archive)
    status('Source ZIP checked. Enter a unique passphrase to lock a separate copy.')
  })
})
$('protect-button').addEventListener('click', () => run('Encrypting the checked backup. This can take a moment.', async () => {
  clearProtected()
  try {
    if (!state.protectionSource) throw new Error('Choose a checked ZIP first.')
    if ($('protect-passphrase').value !== $('protect-confirm').value) throw new Error('The passphrases do not match. Enter both again.')
    const bytes = await protectArchive(state.protectionSource.bytes, $('protect-passphrase').value)
    state.protected = { bytes, name: state.protectionSource.name.replace(/\.zip$/i, '') + '.adlock' }
    $('protected-name').textContent = state.protected.name
    $('protected-size').textContent = formatBytes(bytes.length)
    $('protected-result').hidden = false
    status('Locked copy ready. Download it, then reopen that saved file with the passphrase before relying on it.')
  } finally {
    $('protect-passphrase').value = ''
    $('protect-confirm').value = ''
  }
}))
$('download-protected').addEventListener('click', () => {
  if (state.protected) download(state.protected.bytes, state.protected.name, 'application/octet-stream')
})
$('unlock-input').addEventListener('change', async event => {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  await run('Checking the locked file format.', async () => {
    state.locked = null
    clearUnlocked()
    $('unlock-passphrase').value = ''
    $('unlock-file-name').textContent = file.name
    if (!file.size) throw new Error('This file is empty. Choose an Archive Desk .adlock file.')
    if (file.size > PROTECTION.maxArchiveBytes + PROTECTION.headerBytes + PROTECTION.tagBytes) throw new Error('This locked file is larger than the supported size.')
    const bytes = new Uint8Array(await file.arrayBuffer())
    inspectLockedFile(bytes)
    state.locked = { bytes, name: file.name }
    status('Locked file selected. Enter its passphrase. The files are checked once it is unlocked.')
  })
})
$('unlock-button').addEventListener('click', () => run('Unlocking the backup, then checking the ZIP and every file.', async () => {
  clearUnlocked()
  try {
    if (!state.locked) throw new Error('Choose a locked file first.')
    const passphrase = $('unlock-passphrase').value
    if (!passphrase) throw new Error('Enter the passphrase for this file.')
    // Locked copies always use at least 12 characters, so a shorter entry cannot be the right one.
    if (Array.from(passphrase).length < PROTECTION.minPassphraseCharacters) throw new Error('Could not unlock. That passphrase is shorter than any passphrase Archive Desk accepts, so it cannot be the one for this file.')
    const archive = await unlockArchive(state.locked.bytes, passphrase)
    state.unlocked = archive
    $('unlocked-summary').textContent = countText(archive.result.files.length) + ' verified after decryption. Recovery never changes the original folder.'
    for (const entry of archive.result.files) $('unlocked-rows').append(row([entry.path, formatBytes(entry.bytes)]))
    $('unlocked-result').hidden = false
    status('The locked file passed authentication and every file check. A recovery ZIP is ready.')
  } finally { $('unlock-passphrase').value = '' }
}))
$('download-unlocked').addEventListener('click', () => run('Preparing an unencrypted recovery ZIP from the checked files.', async () => {
  if (!state.unlocked) throw new Error('Unlock and verify a file first.')
  const bytes = await createRecoveryZip(state.unlocked.bytes)
  download(bytes, 'archive-desk-unlocked-' + stamp() + '.zip')
}))

// Enter submits from the passphrase fields, as a form would.
const submitOnEnter = (inputId, buttonId) => $(inputId).addEventListener('keydown', event => {
  if (event.key !== 'Enter' || event.isComposing) return
  event.preventDefault()
  if (!$(buttonId).disabled) $(buttonId).click()
})
submitOnEnter('protect-passphrase', 'protect-button')
submitOnEnter('protect-confirm', 'protect-button')
submitOnEnter('unlock-passphrase', 'unlock-button')

controls()

