import { CATALOG, createState, addToCart, removeFromCart, toggleSaved, subtotal, createDemoOrder, exportBackup, parseBackup, checkoutProblem, backupFileName, receiptText } from './toolroom-core.mjs'

// Package revision suffixes such as r2 are internal, buyers see the release number.
const shownVersion = version => version.replace(/r\d+$/, '')

const $ = selector => document.querySelector(selector)
const byId = id => CATALOG.find(product => product.id === id)
const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100)
const escape = text => String(text).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
const storageKey = 'toolroom-demo-v1'
const categoryLabels = { pricing: 'Quotes', data: 'Data', projects: 'Projects', bundles: 'Bundle' }
const icons = {
  bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v16l-5-3.5L7 20V4Z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>'
}
let state = createState()
let storageAvailable = true
let category = 'all'
let search = ''
let sort = 'featured'
let selectedProduct = null
let pendingRestore = null
let pendingOriginal = null
let toastTimer
let spotlight = null

try {
  const stored = localStorage.getItem(storageKey)
  if (stored) state = parseBackup(stored)
} catch {
  storageAvailable = false
  setTimeout(() => notify('Saved data could not be loaded. This session still works, so export a backup before you leave.'), 150)
}

function notify(message) {
  clearTimeout(toastTimer)
  $('#toast').textContent = message
  $('#toast').classList.add('visible')
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4600)
}

// Re-rendering replaces buttons, so keep keyboard focus on the matching control afterwards.
function restoreFocus(key, scope, fallbackSelector) {
  if (!key) return
  const visible = element => element && element.getClientRects().length > 0
  const match = [...scope.querySelectorAll('[data-focus-key]')].find(element => element.dataset.focusKey === key && visible(element))
  const fallback = (fallbackSelector || []).map(selector => [...scope.querySelectorAll(selector)].find(visible)).find(Boolean)
  ;(match || fallback)?.focus()
}

function commit(next, { fallbackFocus } = {}) {
  const focusKey = document.activeElement?.dataset?.focusKey
  const scope = document.activeElement?.closest('dialog') || document
  state = next
  try {
    localStorage.setItem(storageKey, exportBackup(state))
    storageAvailable = true
  } catch {
    storageAvailable = false
    notify('Browser storage is unavailable. Export a backup to keep this session.')
  }
  render()
  restoreFocus(focusKey, scope, fallbackFocus)
}

function artwork(product) {
  const top = title => `<div class="preview-top"><i></i><i></i><i></i><b>${title}</b></div>`
  if (product.id === 'quotecheck') {
    return `<div class="preview-window">${top('QuoteCheck 1.1')}<div class="preview-body"><div class="preview-sub">Project estimate</div><div class="preview-title">Studio site refresh</div><div class="preview-totals"><div>Base<strong>$1,400</strong></div><div>With revisions<strong>$1,680</strong></div></div><div class="preview-row"><span>Design and build</span><span>40 h</span></div><div class="preview-row"><span>Revision allowance</span><span>8 h</span></div></div></div><div class="preview-badge">Quote calculator</div>`
  }
  if (product.id === 'exportcheck') {
    return `<div class="preview-window">${top('ExportCheck 1.1')}<div class="preview-body"><div class="preview-sub">clients.csv</div><div class="preview-title">2 ready, 1 to fix</div><div class="csv-grid"><span>Row</span><span>Email</span><span>Status</span><span>001</span><span>Valid</span><span>Ready</span><span>002</span><span class="flag">Missing</span><span class="flag">Fix</span><span>003</span><span>Valid</span><span>Ready</span></div></div></div><div class="preview-badge">CSV checker</div>`
  }
  if (product.id === 'handoffdesk') {
    return `<div class="preview-window">${top('Handoff Desk 1.0.1')}<div class="preview-body"><div class="preview-sub">Website refresh</div><div class="preview-title">Ready for review</div><div class="mini-checklist"><div><span>Project brief</span><b>Done</b></div><div><span>Decision log</span><b>Done</b></div><div><span>Delivery checklist</span><b>Ready</b></div></div></div></div><div class="preview-badge">Project handoff record</div>`
  }
  return `<div class="bundle-files"><div class="bundle-file"><small>Step one</small><strong>QuoteCheck</strong><p>Price the job.</p></div><div class="bundle-file"><small>Step two</small><strong>Handoff Desk</strong><p>Record what was agreed.</p></div></div><div class="preview-badge">QuoteCheck and Handoff Desk</div>`
}

function buyButton(product, extraClass = '') {
  return state.cart.includes(product.id)
    ? `<button type="button" class="button in-bag ${extraClass}" data-view-bag data-focus-key="buy:${product.id}" aria-label="${escape(product.name)} is in your bag. Open bag">${icons.check}In bag</button>`
    : `<button type="button" class="button primary ${extraClass}" data-add="${product.id}" data-focus-key="buy:${product.id}" aria-label="Add ${escape(product.name)} to bag">Add to bag</button>`
}

// The window title bar names the tool in front, its price and its buy button.
let activeTool = 'quotecheck'
function renderWindowBar() {
  const product = byId(activeTool)
  const bar = $('#win-bar')
  if (!product || !bar) return
  $('#win-name').textContent = product.name
  $('#win-ico use')?.setAttribute('href', '#ico-' + ({ quotecheck: 'quote', exportcheck: 'csv', handoffdesk: 'handoff' }[product.id] || 'quote'))
  $('#win-file').textContent = { quotecheck: 'studio-site-refresh.quote', exportcheck: 'clients.csv', handoffdesk: 'fieldwork-website.handoff' }[product.id] || ''
  $('#win-price').textContent = money(product.priceCents)
  $('#win-buy').innerHTML = buyButton(product)
  $('#win-sample').dataset.preview = product.id
  $('#win-sample').setAttribute('aria-label', `Download a free ${product.name} sample`)
}

function renderCatalog() {
  const query = search.toLowerCase().trim()
  let products = CATALOG.filter(product => (category === 'all' || (category === 'saved' && state.saved.includes(product.id)) || product.category === category) && `${product.name} ${product.summary} ${product.tags.join(' ')}`.toLowerCase().includes(query))
  if (sort === 'price') products = [...products].sort((a, b) => a.priceCents - b.priceCents)
  if (sort === 'name') products = [...products].sort((a, b) => a.name.localeCompare(b.name))
  $('#product-grid').innerHTML = products.map(product => {
    const saved = state.saved.includes(product.id)
    const out = state.cart.includes(product.id)
    return `<article class="product-card${out ? ' out' : ''}" data-pocket="${product.id}"><div class="product-media"><div class="product-art ${product.category}" data-detail="${product.id}" aria-hidden="true">${artwork(product)}</div><span class="pocket-label" aria-hidden="true">${icons.check}In your bag</span><button type="button" class="save-button" data-save="${product.id}" data-focus-key="save:${product.id}" aria-label="Save ${escape(product.name)}" aria-pressed="${saved}">${icons.bookmark}</button></div><div class="card-body"><div class="card-head"><h3><button type="button" class="card-title" data-detail="${product.id}" data-focus-key="detail:${product.id}">${escape(product.name)}</button></h3><span class="price num">${money(product.priceCents)}</span></div><p class="card-meta"><span>${categoryLabels[product.category]}</span><span class="num">v${escape(shownVersion(product.version))}</span></p><p class="summary">${escape(product.summary)}</p><div class="card-actions">${buyButton(product)}<button type="button" class="button secondary" data-detail="${product.id}" aria-label="Details for ${escape(product.name)}">Details</button></div></div></article>`
  }).join('')
  $('#result-count').textContent = `${products.length} ${products.length === 1 ? 'tool' : 'tools'}`
  if (spotlight) $(`[data-pocket="${spotlight}"]`)?.classList.add('spot')
  const outCount = state.cart.length
  $('#drawer-out').textContent = outCount ? `${outCount} in your bag` : ''
  $('#no-results').hidden = products.length > 0
  $('#no-results h3').textContent = category === 'saved' && !query ? 'No saved tools yet.' : 'Nothing matches that search.'
  $('#no-results p').textContent = category === 'saved' && !query ? 'Tap the bookmark on any tool to keep it here.' : 'Try a different word or clear the filters.'
  document.querySelectorAll('[data-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === category)))
}

function renderDetail() {
  const product = byId(selectedProduct)
  if (!product) return
  $('#product-detail').innerHTML = `<div class="detail-layout"><div class="product-art ${product.category}" aria-hidden="true">${artwork(product)}</div><div class="detail-copy"><button type="button" class="icon-button dialog-close" data-close="product-dialog" aria-label="Close details">${icons.close}</button><p class="eyebrow">${categoryLabels[product.category]}</p><h2 id="detail-title">${escape(product.name)}</h2><p class="detail-meta num">Version ${escape(shownVersion(product.version))}</p><p class="detail-summary">${escape(product.summary)}</p><div class="detail-buy"><span class="detail-price num">${money(product.priceCents)}</span>${buyButton(product, 'grow')}</div><button type="button" class="button secondary full" data-preview="${product.id}" data-focus-key="sample:${product.id}">${icons.download}Download free sample</button><h3>What you get</h3><ul class="includes">${product.includes.map(item => `<li>${icons.check}<span>${escape(item)}</span></li>`).join('')}</ul><h3>Requirements</h3><p class="requirements">${escape(product.compatibility)}</p></div></div>`
}

function showProduct(id) {
  if (!byId(id)) return
  selectedProduct = id
  renderDetail()
  openDialog('product-dialog')
}

function renderCart() {
  const count = state.cart.length
  $('#cart-count').textContent = count
  $('#cart-open').setAttribute('aria-label', `Open bag, ${count} ${count === 1 ? 'tool' : 'tools'}`)
  if (!count) {
    $('#cart-items').innerHTML = '<div class="empty-state compact"><h3>Your bag is empty.</h3><p>Add a tool from the list to check out.</p><button type="button" class="button secondary" data-close="cart-dialog">Keep browsing</button></div>'
    $('#cart-summary').innerHTML = ''
    return
  }
  $('#cart-items').innerHTML = state.cart.map(id => {
    const product = byId(id)
    return `<div class="cart-line"><div class="cart-mini ${product.category}" aria-hidden="true">${escape(product.name.slice(0, 1))}</div><div class="cart-info"><h3>${escape(product.name)}</h3><p class="num">Version ${escape(shownVersion(product.version))}</p><button type="button" class="text-button" data-remove="${id}" data-focus-key="remove:${id}" aria-label="Remove ${escape(product.name)} from bag">Remove</button></div><strong class="num">${money(product.priceCents)}</strong></div>`
  }).join('')
  $('#cart-summary').innerHTML = `<div class="sum-row"><span>Subtotal</span><strong class="num">${money(subtotal(state))}</strong></div><button type="button" id="checkout-open" class="button primary full">Checkout</button><p class="fine-print">Each tool is a single download, so one copy covers you.</p>`
}

function renderLibrary() {
  $('#library-count').textContent = state.orders.length || ''
  $('#stat-orders').textContent = state.orders.length
  $('#stat-tools').textContent = new Set(state.orders.flatMap(order => order.items.map(item => item.productId))).size
  $('#stat-value').textContent = money(state.orders.reduce((sum, order) => sum + order.totalCents, 0))
  $('#library-empty').hidden = state.orders.length > 0
  const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  $('#orders').innerHTML = [...state.orders].reverse().map(order => `<article class="order"><header class="order-header"><div><h2>Order <span class="num">${escape(order.id)}</span></h2><p><span>${escape(dateFormat.format(new Date(order.createdAt)))}</span><span>${order.items.length} ${order.items.length === 1 ? 'tool' : 'tools'}</span><span class="num">${money(order.totalCents)}</span></p></div><button type="button" class="button secondary" data-receipt="${escape(order.id)}">${icons.download}Receipt</button></header><div class="order-body">${order.items.map(item => `<div class="order-item"><div class="cart-mini ${byId(item.productId).category}" aria-hidden="true">${escape(item.title.slice(0, 1))}</div><div class="order-info"><h3>${escape(item.title)}</h3><p class="num">Version ${escape(shownVersion(item.version))}</p></div><button type="button" class="button secondary" data-preview="${item.productId}" aria-label="Download ${escape(item.title)} sample">${icons.download}Sample</button></div>`).join('')}</div></article>`).join('')
}

function render() {
  renderCatalog()
  renderCart()
  renderLibrary()
  if ($('#product-dialog').open) renderDetail()
  renderWindowBar()
  $('#saved-count').textContent = state.saved.length
}

function openDialog(id) {
  const dialog = document.getElementById(id)
  if (!dialog.open) dialog.showModal()
}

function closeDialog(id) {
  const dialog = document.getElementById(id)
  if (dialog.open) dialog.close()
}

function route() {
  const library = location.hash === '#library'
  const wasLibrary = !$('#library-view').hidden
  $('#shop-view').hidden = library
  $('#library-view').hidden = !library
  document.querySelectorAll('[data-route]').forEach(link => {
    if (link.dataset.route === (library ? 'library' : 'shop')) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  })
  document.title = library ? 'Your library | Toolroom' : 'Toolroom | Desktop tools for freelancers'
  const target = location.hash.length > 1 && !library ? document.getElementById(location.hash.slice(1)) : null
  if (library || location.hash === '#shop') window.scrollTo(0, 0)
  // Anchors inside the shop cannot scroll while the shop is hidden, so scroll once it is visible again.
  else if (wasLibrary && target) target.scrollIntoView()
}

function beginCheckout() {
  if (!state.cart.length) return
  closeDialog('cart-dialog')
  $('#checkout-summary').innerHTML = state.cart.map(id => `<div class="checkout-line"><span>${escape(byId(id).name)}</span><span class="num">${money(byId(id).priceCents)}</span></div>`).join('') + `<div class="checkout-line checkout-total"><span>Total</span><span class="num">${money(subtotal(state))}</span></div>`
  $('#checkout-error').textContent = ''
  openDialog('checkout-dialog')
  $('#demo-name').focus()
}

function download(name, content, type) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 15000)
}

const samples = {
  quotecheck: { ext: 'csv', type: 'text/csv;charset=utf-8', text: 'QuoteCheck sample file. Not the full product.\r\nItem,Hours,Hourly rate USD,Amount USD\r\nDesign and build,40,35,1400\r\nRevision allowance,8,35,280\r\nEstimate,,,1680\r\n' },
  exportcheck: { ext: 'csv', type: 'text/csv;charset=utf-8', text: 'ExportCheck sample file. Not the full product.\r\nRow,Email,Finding\r\n001,alex@example.com,Ready\r\n002,,Missing email\r\n003,taylor@example.com,Ready\r\n' },
  handoffdesk: { ext: 'txt', type: 'text/plain;charset=utf-8', text: 'Handoff Desk sample file. Not the full product. Fictional project.\n\nProject: Fieldwork Studio website refresh\nOwner: Jordan Example\nStatus: Ready for review\n\nDecisions\nKeep the current logo. Use the supplied photography.\n\nDelivery checklist\n[ ] Review the homepage at desktop and phone widths\n[ ] Check contact links and downloaded assets\n[ ] Record the approved revision\n\nNext step\nConfirm the approved copy and final image set.\n' },
  quotehandoffkit: { ext: 'txt', type: 'text/plain;charset=utf-8', text: 'Quote and Handoff Kit sample file. Not the full product.\n\n1. Define the brief and what it depends on.\n2. Separate the base estimate from revisions.\n3. Record agreed changes before changing the scope.\n4. Keep decisions, files and next steps together.\n5. Check the delivered file before handing it over.\n\nThe full kit combines the QuoteCheck and Handoff Desk apps. This text file shows the workflow.\n' }
}

function downloadPreview(id) {
  const product = byId(id)
  if (!product) return
  const sample = samples[id]
  download(`Toolroom_${product.name.replaceAll(' ', '_')}_sample.${sample.ext}`, sample.text, sample.type)
  notify(`${product.name} sample downloaded.`)
}

function openBackup() {
  pendingRestore = null
  pendingOriginal = null
  $('#restore-preview').hidden = true
  $('#backup-message').textContent = ''
  $('#import-backup').value = ''
  openDialog('backup-dialog')
}

function exportLibrary() {
  download(backupFileName(), exportBackup(state), 'application/json')
  notify('Backup downloaded. Keep it somewhere safe.')
}

function clearRestore() {
  pendingRestore = null
  pendingOriginal = null
  $('#restore-preview').hidden = true
  $('#import-backup').value = ''
}

document.addEventListener('click', event => {
  const close = event.target.closest('[data-close]')
  if (close) return closeDialog(close.dataset.close)
  const save = event.target.closest('[data-save]')
  if (save) {
    const saved = state.saved.includes(save.dataset.save)
    commit(toggleSaved(state, save.dataset.save), { fallbackFocus: ['.chips [aria-pressed="true"]'] })
    return notify(saved ? `${byId(save.dataset.save).name} removed from saved.` : `${byId(save.dataset.save).name} saved.`)
  }
  const add = event.target.closest('[data-add]')
  if (add) {
    const existed = state.cart.includes(add.dataset.add)
    commit(addToCart(state, add.dataset.add))
    return notify(existed ? 'Already in your bag. One copy is all you need.' : `${byId(add.dataset.add).name} added to your bag.`)
  }
  if (event.target.closest('[data-view-bag]')) {
    closeDialog('product-dialog')
    renderCart()
    return openDialog('cart-dialog')
  }
  const remove = event.target.closest('[data-remove]')
  if (remove) {
    const name = byId(remove.dataset.remove).name
    commit(removeFromCart(state, remove.dataset.remove), { fallbackFocus: ['#cart-dialog [data-remove]', '#cart-dialog [data-close]'] })
    return notify(`${name} removed from your bag.`)
  }
  const preview = event.target.closest('[data-preview]')
  if (preview) return downloadPreview(preview.dataset.preview)
  const detail = event.target.closest('[data-detail]')
  if (detail) return showProduct(detail.dataset.detail)
  const filter = event.target.closest('[data-category]')
  if (filter) {
    category = filter.dataset.category
    return renderCatalog()
  }
  if (event.target.closest('#checkout-open')) return beginCheckout()
  const receipt = event.target.closest('[data-receipt]')
  if (receipt) {
    const order = state.orders.find(item => item.id === receipt.dataset.receipt)
    if (!order) return
    download(`Toolroom_receipt_${order.id}.txt`, receiptText(order), 'text/plain;charset=utf-8')
    return notify('Receipt downloaded.')
  }
})

$('#search').addEventListener('input', event => { search = event.target.value; renderCatalog() })
$('#sort').addEventListener('change', event => { sort = event.target.value; renderCatalog() })
$('#reset-filters').addEventListener('click', () => { category = 'all'; search = ''; sort = 'featured'; $('#search').value = ''; $('#sort').value = 'featured'; renderCatalog(); $('#search').focus() })
$('#cart-open').addEventListener('click', () => { renderCart(); openDialog('cart-dialog') })
for (const selector of ['#backup-open', '#footer-backup']) $(selector).addEventListener('click', openBackup)
for (const selector of ['#export-backup', '#library-backup']) $(selector).addEventListener('click', exportLibrary)

$('#checkout-form').addEventListener('submit', event => {
  event.preventDefault()
  const button = $('#checkout-form button[type="submit"]')
  if (button.disabled) return
  const contact = { name: $('#demo-name').value, email: $('#demo-email').value }
  const problem = checkoutProblem(contact)
  if (problem) {
    $('#checkout-error').textContent = problem
    ;(problem.includes('name') ? $('#demo-name') : $('#demo-email')).focus()
    return
  }
  button.disabled = true
  try {
    const next = createDemoOrder(state, contact, { id: 'TR-' + crypto.randomUUID().slice(0, 8).toUpperCase(), createdAt: new Date().toISOString() })
    commit(next)
    closeDialog('checkout-dialog')
    $('#checkout-form').reset()
    location.hash = '#library'
    route()
    notify(storageAvailable ? 'Order placed. Your receipt and samples are in your library.' : 'Order placed for this session only. Export a backup before you leave.')
    $('#library-title').focus()
  } catch (error) {
    $('#checkout-error').textContent = error.message
  } finally {
    button.disabled = false
  }
})

$('#import-backup').addEventListener('change', async event => {
  const file = event.target.files[0]
  pendingRestore = null
  pendingOriginal = null
  $('#restore-preview').hidden = true
  $('#backup-message').textContent = ''
  if (!file) return
  try {
    if (file.size > 1024 * 1024) throw new Error('Choose a Toolroom backup smaller than 1 MB.')
    const text = await file.text()
    pendingRestore = parseBackup(text)
    pendingOriginal = exportBackup(state)
    const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`
    $('#restore-preview').innerHTML = `<h3>Ready to restore</h3><p>This file holds ${plural(pendingRestore.cart.length, 'bag item')}, ${plural(pendingRestore.saved.length, 'saved tool')} and ${plural(pendingRestore.orders.length, 'order')}. Restoring replaces what is in this browser now.</p><div class="restore-actions"><button type="button" class="button primary" id="confirm-restore">Restore backup</button><button type="button" class="button secondary" id="cancel-restore">Cancel</button></div>`
    $('#restore-preview').hidden = false
  } catch (error) {
    $('#backup-message').textContent = `That file could not be restored. ${error.message} Your library has not changed.`
  }
})

$('#restore-preview').addEventListener('click', event => {
  if (event.target.closest('#cancel-restore')) {
    clearRestore()
    $('#import-backup').focus()
    return
  }
  if (event.target.closest('#confirm-restore') && pendingRestore) {
    if (exportBackup(state) !== pendingOriginal) {
      clearRestore()
      $('#backup-message').textContent = 'Your library changed after you chose this file. Choose the file again to restore it.'
      return
    }
    commit(pendingRestore)
    clearRestore()
    closeDialog('backup-dialog')
    notify('Backup restored.')
  }
})

document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target !== dialog) return
  const rect = dialog.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close()
}))
window.addEventListener('hashchange', route)
window.addEventListener('storage', event => {
  if (event.key !== storageKey) return
  try {
    state = event.newValue ? parseBackup(event.newValue) : createState()
    render()
    if ($('#checkout-dialog').open) { closeDialog('checkout-dialog'); notify('Your bag changed in another tab. Check it before you place the order.') }
    else notify('Your library was updated in another tab.')
  } catch { notify('An update from another tab was not valid. Your library here has been kept.') }
})
render()
route()

// The tool window: working versions of QuoteCheck, ExportCheck and Handoff Desk at the top of the page.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)')
const dollars = (value, digits = 2) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
const benchTabs = [...document.querySelectorAll('.dock [role="tab"]')]
function selectBenchTab(tab, focus) {
  benchTabs.forEach(item => {
    const on = item === tab
    item.setAttribute('aria-selected', String(on))
    item.tabIndex = on ? 0 : -1
    document.getElementById(item.getAttribute('aria-controls')).hidden = !on
  })
  activeTool = tab.dataset.tool
  renderWindowBar()
  if (focus) tab.focus()
}
benchTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectBenchTab(tab))
  tab.addEventListener('keydown', event => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    selectBenchTab(benchTabs[(index + step + benchTabs.length) % benchTabs.length], true)
  })
})

const quote = { build: $('#q-build'), rev: $('#q-rev'), rate: $('#q-rate') }
const pins = []
const FEE = 0.03, COSTS = 40
function quoteNumbers() {
  const build = Number(quote.build.value), rev = Number(quote.rev.value), rate = Number(quote.rate.value)
  const total = (build + rev) * rate
  const fee = Math.round(total * FEE * 100) / 100
  const keep = total - fee - COSTS
  return { build, rev, rate, total, fee, keep, hour: keep / (build + rev) }
}
function renderQuote() {
  const q = quoteNumbers()
  for (const [key, input] of Object.entries(quote)) input.style.setProperty('--fill', `${(input.value - input.min) / (input.max - input.min) * 100}%`)
  $('#q-build-out').textContent = `${q.build} h`
  $('#q-rev-out').textContent = `${q.rev} h`
  $('#q-rate-out').textContent = `$${q.rate}`
  $('#q-total').textContent = dollars(q.total, 0)
  $('#q-fee').textContent = '-' + dollars(q.fee)
  $('#q-keep').textContent = dollars(q.keep)
  $('#q-hour').textContent = dollars(q.hour)
  // The gauge splits the estimate into what you keep and what fees and costs take.
  const keepShare = Math.max(0, Math.min(1, q.keep / q.total))
  $('#q-gauge-keep').style.width = `${(keepShare * 100).toFixed(1)}%`
  $('#q-gauge-fee').style.width = `${((1 - keepShare) * 100).toFixed(1)}%`
  // Flag a quote that pays less per hour than the rate after fees by more than a fifth.
  $('#q-hour').parentElement.classList.toggle('low', q.hour < q.rate * 0.8)
  const match = pins.findIndex(pin => pin.build === q.build && pin.rev === q.rev && pin.rate === q.rate)
  $('#q-code').textContent = match >= 0 ? `Version ${'ABC'[match]}` : 'Draft'
  document.querySelectorAll('#q-pins button').forEach((button, index) => button.setAttribute('aria-current', String(index === match)))
  const pin = $('#q-pin')
  pin.disabled = match >= 0 || pins.length >= 3
  pin.textContent = pins.length >= 3 && match < 0 ? 'Three versions pinned' : match >= 0 ? 'Pinned' : 'Pin this version'
}
function renderPins() {
  $('#q-pins').innerHTML = pins.map((pin, index) => `<li><button type="button" data-pin="${index}" aria-label="Load version ${'ABC'[index]}, ${dollars(pin.total, 0)}, ${dollars(pin.hour)} an hour"><b>${'ABC'[index]}</b><span class="num">${dollars(pin.total, 0)}, ${dollars(pin.hour)}/h</span></button></li>`).join('') + (pins.length ? '<li><button type="button" data-pin-clear aria-label="Clear pinned versions"><b>Clear</b><span>all</span></button></li>' : '')
}
if (quote.build) {
  Object.values(quote).forEach(input => input.addEventListener('input', renderQuote))
  $('#q-pin').addEventListener('click', () => {
    if (pins.length >= 3) return
    pins.push(quoteNumbers())
    renderPins()
    renderQuote()
    notify(`Version ${'ABC'[pins.length - 1]} pinned. Move the sliders to compare.`)
  })
  $('#q-pins').addEventListener('click', event => {
    if (event.target.closest('[data-pin-clear]')) { pins.length = 0; renderPins(); renderQuote(); $('#q-pin').focus(); return }
    const button = event.target.closest('[data-pin]')
    if (!button) return
    const pin = pins[Number(button.dataset.pin)]
    quote.build.value = pin.build; quote.rev.value = pin.rev; quote.rate.value = pin.rate
    renderQuote()
  })
  renderQuote()
}

const emailPattern = /^[^\s@,;"]+@[^\s@,;"]+\.[a-z]{2,}$/i
const csvInputs = [...document.querySelectorAll('[data-csv]')]
let csvWasClean = false
function renderCsv(changed) {
  let ready = 0
  csvInputs.forEach(input => {
    const row = input.closest('tr')
    const value = input.value.trim()
    const ok = emailPattern.test(value)
    const wasBad = row.classList.contains('bad')
    row.classList.toggle('bad', !ok)
    if (ok && wasBad && input === changed) { row.classList.remove('fixed'); void row.offsetWidth; row.classList.add('fixed') }
    row.querySelector('[data-status]').textContent = ok ? 'Ready' : value ? 'Check email' : 'Missing email'
    input.setAttribute('aria-invalid', String(!ok))
    if (ok) ready++
  })
  const fix = csvInputs.length - ready
  $('#csv-summary').textContent = fix ? `${ready} ready, ${fix} to fix` : `${ready} ready, nothing to fix`
  $('#csv-download').disabled = fix > 0
  $('#csv-stamp').classList.toggle('on', fix === 0)
  if (fix === 0 && !csvWasClean && changed) notify('Every row passes. The clean CSV is ready to download.')
  csvWasClean = fix === 0
}
if (csvInputs.length) {
  csvInputs.forEach(input => input.addEventListener('input', () => renderCsv(input)))
  $('#csv-download').addEventListener('click', () => {
    const rows = csvInputs.map((input, index) => `${String(index + 1).padStart(3, '0')},${input.value.trim()},Ready`)
    download('clients_clean.csv', `Row,Email,Status\r\n${rows.join('\r\n')}\r\n`, 'text/csv;charset=utf-8')
    notify('clients_clean.csv downloaded.')
  })
  renderCsv()
}

// Handoff Desk: tick what is done, then download the handoff note as plain text.
const hoInputs = [...document.querySelectorAll('[data-ho]')]
function renderHandoff(changed) {
  const done = hoInputs.filter(input => input.checked).length
  const total = hoInputs.length
  const left = total - done
  $('#ho-count').innerHTML = `${done}<small> of ${total} done</small>`
  $('#ho-bar').style.width = `${(done / total * 100).toFixed(1)}%`
  const state = $('#ho-state')
  state.textContent = left ? `${left} ${left === 1 ? 'step' : 'steps'} left before handover.` : 'All done. Ready to hand over.'
  state.classList.toggle('ready', !left)
  if (changed && !left) notify('All six steps done. Download the handoff note.')
}
if (hoInputs.length) {
  hoInputs.forEach(input => input.addEventListener('change', () => renderHandoff(input)))
  $('#ho-download').addEventListener('click', () => {
    const lines = hoInputs.map(input => {
      const row = input.closest('label')
      const date = row.querySelector('time').textContent.trim()
      return `[${input.checked ? 'x' : ' '}] ${row.querySelector('span').textContent.trim()}${date ? ` (${date})` : ''}`
    })
    const done = hoInputs.filter(input => input.checked).length
    const text = `Handoff note. Fictional project.\n\nProject: Fieldwork Studio website\nClient: Jordan Example\nDone: ${done} of ${hoInputs.length}\n\n${lines.join('\n')}\n`
    download('Fieldwork_Studio_handoff.txt', text, 'text/plain;charset=utf-8')
    notify('Fieldwork_Studio_handoff.txt downloaded.')
  })
  renderHandoff()
}

// The finder maps a problem to the tool that solves it, then highlights that card in the list.
const finderButtons = [...document.querySelectorAll('[data-find]')]
finderButtons.forEach(button => button.setAttribute('aria-pressed', 'false'))
finderButtons.forEach(button => button.addEventListener('click', () => {
  const product = byId(button.dataset.find)
  if (!product) return
  const again = spotlight === product.id
  spotlight = again ? null : product.id
  finderButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button && !again)))
  category = 'all'; search = ''; sort = 'featured'; $('#search').value = ''; $('#sort').value = 'featured'
  renderCatalog()
  if (again) { $('#finder-result').textContent = ''; return }
  $('#finder-result').innerHTML = `<b>${escape(product.name)}</b>, ${money(product.priceCents)}. ${escape(product.summary)} <a href="#collection" data-goto-pocket="${product.id}">See it in the list</a>`
}))
$('#finder-result').addEventListener('click', event => {
  const link = event.target.closest('[data-goto-pocket]')
  if (!link) return
  event.preventDefault()
  const card = $(`[data-pocket="${link.dataset.gotoPocket}"]`)
  if (!card) return
  card.scrollIntoView({ block: 'center', behavior: reduceMotion.matches ? 'auto' : 'smooth' })
  card.querySelector('.card-title')?.focus({ preventScroll: true })
})

// Product art leans toward the pointer, a small reward for looking closer.
const finePointer = matchMedia('(hover: hover) and (pointer: fine)')
$('#product-grid').addEventListener('pointermove', event => {
  if (reduceMotion.matches || !finePointer.matches) return
  const art = event.target.closest('.product-art')
  if (!art) return
  const rect = art.getBoundingClientRect()
  const x = (event.clientX - rect.left) / rect.width - 0.5
  const y = (event.clientY - rect.top) / rect.height - 0.5
  const piece = art.querySelector('.preview-window, .bundle-files')
  const base = art.classList.contains('data') ? 2 : art.classList.contains('projects') ? -1.5 : art.classList.contains('bundles') ? 0 : -2
  piece.style.transform = `perspective(900px) rotate(${(base + x * 2).toFixed(2)}deg) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg) translate(${(x * 6).toFixed(1)}px, ${(y * 6).toFixed(1)}px)`
})
$('#product-grid').addEventListener('pointerout', event => {
  const art = event.target.closest('.product-art')
  if (art && !art.contains(event.relatedTarget)) art.querySelector('.preview-window, .bundle-files').style.transform = ''
})