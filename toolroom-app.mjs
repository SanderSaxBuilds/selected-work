import { CATALOG, createState, addToCart, removeFromCart, toggleSaved, subtotal, createDemoOrder, exportBackup, parseBackup } from './toolroom-core.mjs'

const $ = selector => document.querySelector(selector)
const byId = id => CATALOG.find(product => product.id === id)
const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100)
const escape = text => String(text).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
const storageKey = 'toolroom-demo-v1'
let state = createState()
let storageAvailable = true
let category = 'all'
let search = ''
let sort = 'featured'
let selectedProduct = null
let pendingRestore = null
let pendingOriginal = null
let toastTimer

try {
  const stored = localStorage.getItem(storageKey)
  if (stored) state = parseBackup(stored)
} catch (error) {
  storageAvailable = false
  setTimeout(() => notify('Saved data could not be loaded. This session still works. Export a backup before leaving.'), 150)
}

function notify(message) {
  clearTimeout(toastTimer)
  $('#toast').textContent = message
  $('#toast').classList.add('visible')
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4600)
}

function commit(next) {
  state = next
  try {
    localStorage.setItem(storageKey, exportBackup(state))
    storageAvailable = true
  } catch {
    storageAvailable = false
    notify('Browser storage is unavailable. Export a backup to keep this session.')
  }
  render()
}

const bookmark = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4V3Z"/></svg>'
const categoryLabels = { pricing: 'Quote with clarity', data: 'Clean up the details', projects: 'Leave a clear trail', bundles: 'Better together' }

function artwork(product, save = true) {
  const top = title => `<div class="preview-top"><i></i><i></i><i></i><b>${title}</b></div>`
  let contents
  if (product.id === 'quotecheck') {
    contents = `<div class="preview-window">${top('QuoteCheck 1.1')}<div class="preview-body"><div class="preview-sub">Put a number on the scope</div><div class="preview-title">A clearer starting point.</div><div class="preview-totals"><div>Base estimate<strong>$1,400</strong></div><div>With revisions<strong>$1,680</strong></div></div><div class="preview-row"><span>Design and build</span><span>40 hours</span></div><div class="preview-row"><span>Revision allowance</span><span>8 hours</span></div></div></div><div class="preview-badge">Know your next quote. ↗</div>`
  } else if (product.id === 'exportcheck') {
    contents = `<div class="preview-window">${top('ExportCheck 1.1')}<div class="preview-body"><div class="preview-sub">A check before the send</div><div class="preview-title">Catch the loose rows.</div><div class="csv-grid"><span>Row</span><span>Email</span><span>Status</span><span>001</span><span>Valid</span><span>Ready</span><span>002</span><span class="flag">Missing</span><span class="flag">Review</span><span>003</span><span>Valid</span><span>Ready</span></div></div></div><div class="preview-badge">A cleaner export. ✓</div>`
  } else if (product.id === 'handoffdesk') {
    contents = `<div class="preview-window">${top('Handoff Desk 1.0.1')}<div class="preview-body"><div class="preview-sub">A handoff the next person can use</div><div class="preview-title">Everything, in its place.</div><div class="mini-checklist"><div>✓ Project brief<b>Captured</b></div><div>✓ Decision log<b>Written</b></div><div>✓ Delivery checklist<b>Ready</b></div></div></div></div><div class="preview-badge">No more loose ends. ↗</div>`
  } else {
    contents = `<div class="bundle-files"><div class="bundle-file"><small>The first step</small><h3>Quote<br>Check.</h3><div class="bundle-rule"></div><p>Scope. Estimate. Revise.</p></div><div class="bundle-file"><small>The next step</small><h3>Handoff<br>Desk.</h3><div class="bundle-rule"></div><p>Brief. Decide. Deliver.</p></div></div><div class="preview-badge">Two tools. One workflow. ↗</div>`
  }
  return `<span class="art-index">Toolroom 0${CATALOG.indexOf(product) + 1}</span>${contents}${save ? `<button class="save-button" data-save="${product.id}" aria-label="${state.saved.includes(product.id) ? 'Unsave' : 'Save'} ${escape(product.name)}" aria-pressed="${state.saved.includes(product.id)}">${bookmark}</button>` : ''}`
}

function renderCatalog() {
  let products = CATALOG.filter(product => (category === 'all' || category === 'saved' && state.saved.includes(product.id) || product.category === category) && `${product.name} ${product.summary} ${product.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase().trim()))
  if (sort === 'price') products = [...products].sort((a, b) => a.priceCents - b.priceCents)
  if (sort === 'name') products = [...products].sort((a, b) => a.name.localeCompare(b.name))
  $('#product-grid').innerHTML = products.map(product => `<article class="product-card"><div class="product-art ${product.category}" data-detail="${product.id}" tabindex="0" role="button" aria-label="View ${escape(product.name)} details">${artwork(product)}</div><div class="product-meta"><div><h3><button data-detail="${product.id}">${escape(product.name)}</button></h3><p>${escape(product.summary)}</p></div><span class="product-price">${money(product.priceCents)}</span></div><div class="product-tags"><div>${product.tags.slice(0, 2).map(tag => `<span class="tag">${escape(tag)}</span>`).join('')}</div><button class="product-add" data-add="${product.id}">${state.cart.includes(product.id) ? 'In your bag ✓' : 'Add to bag + '}</button></div></article>`).join('')
  $('#result-count').textContent = `${products.length} ${products.length === 1 ? 'tool' : 'tools'}`
  $('#no-results').hidden = products.length > 0
  document.querySelectorAll('[data-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === category)))
}

function showProduct(id) {
  const product = byId(id)
  if (!product) return
  selectedProduct = product.id
  $('#product-detail').innerHTML = `<div class="detail-layout"><div class="product-art ${product.category}">${artwork(product, false)}</div><div class="detail-copy"><button class="icon-button dialog-close" data-close="product-dialog" aria-label="Close product details">×</button><p class="eyebrow">${categoryLabels[product.category]}</p><h2>${escape(product.name)}</h2><p>${escape(product.summary)}</p><div class="detail-price">${money(product.priceCents)}</div><p class="detail-caption">Draft price hypothesis · Version ${escape(product.version)}</p><div class="detail-actions"><button class="button dark full" data-add="${product.id}">${state.cart.includes(product.id) ? 'In your bag ✓' : 'Add to bag + '}</button><button class="button outline full" data-preview="${product.id}">Download a free sample ↗</button></div><h3>What is included in the product</h3><ul>${product.includes.map(item => `<li>${escape(item)}</li>`).join('')}</ul><h3>Works with your process</h3><p>${escape(product.compatibility)}</p><p class="fine-print">This storefront provides sample files only. Demo checkout does not sell or deliver the full product.</p></div></div>`
  openDialog('product-dialog')
}

function renderCart() {
  $('#cart-count').textContent = state.cart.length
  $('#cart-open').setAttribute('aria-label', `Open bag, ${state.cart.length} ${state.cart.length === 1 ? 'tool' : 'tools'}`)
  if (!state.cart.length) {
    $('#cart-items').innerHTML = '<div class="empty-state"><span>↳</span><h3>A little room to work.</h3><p>Add a tool from the collection to try the demo checkout.</p><button class="button outline" data-close="cart-dialog">Keep exploring</button></div>'
    $('#cart-summary').innerHTML = ''
    return
  }
  $('#cart-items').innerHTML = state.cart.map(id => {
    const product = byId(id)
    return `<div class="cart-line"><div class="cart-mini ${product.category}" aria-hidden="true">0${CATALOG.indexOf(product) + 1}</div><div><h3>${escape(product.name)}</h3><p>Version ${escape(product.version)} · One demo copy</p><button class="plain" data-remove="${id}" aria-label="Remove ${escape(product.name)} from bag">Remove</button></div><strong>${money(product.priceCents)}</strong></div>`
  }).join('')
  $('#cart-summary').innerHTML = `<div class="sum-row"><span>Illustrative subtotal</span><strong>${money(subtotal(state))}</strong></div><button id="checkout-open" class="button dark full">Try demo checkout <span aria-hidden="true">↗</span></button><p class="fine-print">No charge. No payment details. No real order. Full product archives are not included in this demo.</p>`
}

function renderLibrary() {
  $('#library-count').textContent = state.orders.length || ''
  $('#stat-orders').textContent = state.orders.length
  $('#stat-tools').textContent = new Set(state.orders.flatMap(order => order.items.map(item => item.productId))).size
  $('#stat-value').textContent = money(state.orders.reduce((sum, order) => sum + order.totalCents, 0))
  $('#library-empty').hidden = state.orders.length > 0
  $('#orders').innerHTML = [...state.orders].reverse().map(order => `<article class="order"><header class="order-header"><div><h2>Demo order ${escape(order.id)}</h2><p>${escape(new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(order.createdAt)))} · ${order.items.length} ${order.items.length === 1 ? 'tool' : 'tools'} · ${money(order.totalCents)} illustrative total</p></div><button class="plain" data-receipt="${escape(order.id)}">Receipt ↗</button></header><div class="order-body">${order.items.map(item => `<div class="order-item"><div><h3>${escape(item.title)}</h3><p>Version ${escape(item.version)} · Demo sample file</p></div><button class="button outline" data-preview="${item.productId}">Download sample ↗</button></div>`).join('')}</div><div class="order-note">Local test record for ${escape(order.name)}. Nothing was charged or emailed.</div></article>`).join('')
}

function render() {
  renderCatalog()
  renderCart()
  renderLibrary()
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
  $('#shop-view').hidden = library
  $('#library-view').hidden = !library
  document.querySelectorAll('[data-route]').forEach(link => {
    if (link.dataset.route === (library ? 'library' : 'shop')) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  })
  document.title = library ? 'Your library | Toolroom' : 'Toolroom | Small tools for better work'
  if (library || location.hash === '#shop') window.scrollTo(0, 0)
}

function beginCheckout() {
  if (!state.cart.length) return
  closeDialog('cart-dialog')
  $('#checkout-summary').innerHTML = state.cart.map(id => `<div class="checkout-line"><span>${escape(byId(id).name)}</span><span>${money(byId(id).priceCents)}</span></div>`).join('') + `<div class="checkout-line checkout-total"><span>Illustrative total</span><span>${money(subtotal(state))}</span></div>`
  $('#checkout-error').textContent = ''
  openDialog('checkout-dialog')
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

function downloadPreview(id) {
  const product = byId(id)
  if (!product) return
  const samples = {
    quotecheck: { ext: 'csv', type: 'text/csv;charset=utf-8', text: 'Sample only - not the full QuoteCheck product\r\nItem,Hours,Hourly rate USD,Amount USD\r\nDesign and build,40,35,1400\r\nRevision allowance,8,35,280\r\nIllustrative total,,,1680\r\n' },
    exportcheck: { ext: 'csv', type: 'text/csv;charset=utf-8', text: 'Sample only - not the full ExportCheck product\r\nRow,Email,Finding\r\n001,alex@example.com,Ready\r\n002,,Missing email\r\n003,taylor@example.com,Ready\r\n' },
    handoffdesk: { ext: 'txt', type: 'text/plain;charset=utf-8', text: 'Handoff Desk - demo sample\nNot the full product. Fictional project.\n\nProject: Fieldwork Studio website refresh\nOwner: Jordan Example\nStatus: Prepared for review\n\nDecisions\nKeep the current logo. Use the supplied photography.\n\nDelivery checklist\n[ ] Review the homepage at desktop and mobile widths\n[ ] Check contact links and downloaded assets\n[ ] Record the approved revision\n\nNext step\nConfirm the approved copy and final image set.\n' },
    quotehandoffkit: { ext: 'txt', type: 'text/plain;charset=utf-8', text: 'Quote and Handoff Kit - demo sample\nNot the full product. No purchase or license is created.\n\n1. Define the brief and its dependencies.\n2. Separate the base estimate from revisions.\n3. Record agreed changes before changing the scope.\n4. Keep decisions, files and next steps together.\n5. Check the delivered file before handing it over.\n\nThe full product combines the existing QuoteCheck and Handoff Desk apps. This text file is an illustrative workflow sample.\n' }
  }
  const sample = samples[id]
  download(`Toolroom_${product.name.replaceAll(' ', '_')}_DEMO_SAMPLE.${sample.ext}`, sample.text, sample.type)
  notify('Sample download started. This is not the full product archive.')
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
  download(`Toolroom_backup_${new Date().toISOString().slice(0, 10)}.json`, exportBackup(state), 'application/json')
  notify('Backup download started. Keep it somewhere safe.')
}

document.addEventListener('click', event => {
  const close = event.target.closest('[data-close]')
  if (close) return closeDialog(close.dataset.close)
  const save = event.target.closest('[data-save]')
  if (save) {
    event.stopPropagation()
    const saved = state.saved.includes(save.dataset.save)
    commit(toggleSaved(state, save.dataset.save))
    return notify(saved ? 'Removed from saved tools.' : 'Saved for later.')
  }
  const add = event.target.closest('[data-add]')
  if (add) {
    const existed = state.cart.includes(add.dataset.add)
    commit(addToCart(state, add.dataset.add))
    if ($('#product-dialog').open && selectedProduct === add.dataset.add) add.textContent = 'In your bag ✓'
    return notify(existed ? 'Already in your bag. One copy is all you need.' : `${byId(add.dataset.add).name} added to your bag.`)
  }
  const remove = event.target.closest('[data-remove]')
  if (remove) {
    commit(removeFromCart(state, remove.dataset.remove))
    return notify('Removed from your bag.')
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
    download(`Toolroom_DEMO_receipt_${order.id}.json`, JSON.stringify({ notice: 'Demo record only. No money charged, no purchase and no license grant.', order }, null, 2), 'application/json')
    return notify('Demo receipt download started.')
  }
})

$('#product-grid').addEventListener('keydown', event => {
  if (!['Enter', ' '].includes(event.key) || !event.target.matches('[data-detail]')) return
  event.preventDefault()
  showProduct(event.target.dataset.detail)
})
$('#search').addEventListener('input', event => { search = event.target.value; renderCatalog() })
$('#sort').addEventListener('change', event => { sort = event.target.value; renderCatalog() })
$('#reset-filters').addEventListener('click', () => { category = 'all'; search = ''; sort = 'featured'; $('#search').value = ''; $('#sort').value = 'featured'; renderCatalog() })
$('#cart-open').addEventListener('click', () => { renderCart(); openDialog('cart-dialog') })
for (const selector of ['#backup-open', '#footer-backup']) $(selector).addEventListener('click', openBackup)
for (const selector of ['#export-backup', '#library-backup']) $(selector).addEventListener('click', exportLibrary)

$('#checkout-form').addEventListener('submit', event => {
  event.preventDefault()
  const button = event.submitter
  if (button.disabled) return
  button.disabled = true
  try {
    const next = createDemoOrder(state, { name: $('#demo-name').value, email: $('#demo-email').value }, { id: 'TR-' + crypto.randomUUID().slice(0, 8).toUpperCase(), createdAt: new Date().toISOString() })
    commit(next)
    closeDialog('checkout-dialog')
    $('#checkout-form').reset()
    location.hash = '#library'
    route()
    notify(storageAvailable ? 'Demo order created. Your sample files are ready.' : 'Demo order created in memory. Export a backup before leaving.')
    $('#library-title').setAttribute('tabindex', '-1')
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
    $('#restore-preview').innerHTML = `<h3>Ready to restore</h3><p>${pendingRestore.cart.length} bag items, ${pendingRestore.saved.length} saved tools, and ${pendingRestore.orders.length} demo orders. This replaces the current local library.</p><button class="button dark" id="confirm-restore">Restore this backup</button><button class="button outline" id="cancel-restore">Cancel</button>`
    $('#restore-preview').hidden = false
  } catch (error) {
    $('#backup-message').textContent = `Backup was not loaded. ${error.message} Your current library has not changed.`
  }
})

$('#restore-preview').addEventListener('click', event => {
  if (event.target.closest('#cancel-restore')) {
    pendingRestore = null
    pendingOriginal = null
    $('#restore-preview').hidden = true
    $('#import-backup').value = ''
  }
  if (event.target.closest('#confirm-restore') && pendingRestore) {
    if (exportBackup(state) !== pendingOriginal) {
      $('#backup-message').textContent = 'Your local library changed after selecting this backup. Choose the file again before restoring.'
      pendingRestore = null
      return
    }
    commit(pendingRestore)
    pendingRestore = null
    pendingOriginal = null
    closeDialog('backup-dialog')
    notify('Backup restored. Your local library is ready.')
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
    if ($('#checkout-dialog').open) { closeDialog('checkout-dialog'); notify('The library changed in another tab. Review your bag before checkout.') }
    else notify('Your library was updated in another tab.')
  } catch { notify('An update from another tab was invalid. Your current library has been kept.') }
})
render()
route()
