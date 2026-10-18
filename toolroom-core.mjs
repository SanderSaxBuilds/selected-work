const freezeDeep = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child)
    Object.freeze(value)
  }
  return value
}

export const CATALOG = freezeDeep([
  {
    id: 'quotecheck',
    name: 'QuoteCheck',
    version: '1.1.0',
    priceCents: 1400,
    category: 'pricing',
    summary: 'See what a quote leaves you after fees and costs, and what that works out to per hour. Compare up to three versions before you send one.',
    tags: ['service quotes', 'cost calculator', 'revision hours', 'scenario comparison', 'JSON export', 'CSV snapshot'],
    includes: ['Quote inputs for fees, direct costs, revision allowance, and actual hours', 'Up to three browser-saved comparison scenarios', 'JSON transfer for one calculation, CSV snapshot, and printable view'],
    compatibility: 'Python 3.9 or newer and a modern JavaScript-enabled browser. Run the supplied local server. Brave is the only browser named as tested.'
  },
  {
    id: 'exportcheck',
    name: 'ExportCheck',
    version: '1.1.0',
    priceCents: 1900,
    category: 'data',
    summary: 'Check a CSV against your own rules before it goes anywhere. Get the clean rows, a list of every problem and a short summary.',
    tags: ['csv validation', 'csv tool', 'data quality', 'python app', 'local software', 'json rules', 'row auditing', 'import checks'],
    includes: ['Required headers and values, optional unique key, exact strings, ISO dates, and bounded decimals', 'Downloads: clean.csv, row-errors.csv, and summary.json', 'Synthetic six-row CSV example and editable rules'],
    compatibility: 'Python 3.10 or newer with standard library only. Opens in the default browser on the same computer at 127.0.0.1. Windows was tested with Python 3.13. Other operating systems are unverified.'
  },
  {
    id: 'handoffdesk',
    name: 'Handoff Desk',
    version: '1.0.1',
    priceCents: 1200,
    category: 'projects',
    summary: 'Keep the brief, scope, checks, deliverables and dated decisions for one project in a single record the next person can pick up.',
    tags: ['project handoff', 'project brief', 'local app', 'project planning', 'JSON export', 'TXT snapshot', 'acceptance checks'],
    includes: ['Project objective, audience, scope, target date, feedback owner, inputs, checks, deliverables, and dated decisions', 'Browser-profile save and editable JSON import and export, plus readable TXT snapshot', 'Three checklist groups of up to 40 rows each and a static nonfillable PDF preview'],
    compatibility: 'Python 3.9 or newer and a modern JavaScript-enabled browser. The local server needs no internet connection. Desktop Chromium was checked. Browser storage and exports are not encrypted or a cloud backup.'
  },
  {
    id: 'quotehandoffkit',
    name: 'Quote and Handoff Kit',
    version: '1.1.0r2',
    priceCents: 2200,
    category: 'bundles',
    summary: 'Price the job with QuoteCheck, then record what was agreed in Handoff Desk. Two separate tools for the start and end of a project.',
    tags: ['quote calculator', 'project handoff', 'local software', 'scenario comparison', 'JSON export', 'CSV snapshot', 'project planning'],
    includes: ['QuoteCheck 1.1.0 and Handoff Desk 1.0.1 local apps', 'QuoteCheck quote, fee, cost, and hours calculations with scenario and JSON or CSV export', 'Handoff project record with JSON or TXT export, checklists, and static preview'],
    compatibility: 'Python 3.9 or newer and a modern JavaScript-enabled browser. The bundle runs locally without internet. Desktop Chromium was checked, with a focused guide and import check in isolated Edge. The tools do not sync, and browser storage and files are not encrypted.'
  }
])

const FORMAT = 'toolroom-backup'
const VERSION = 1
const MAX_BACKUP_BYTES = 1024 * 1024
const MAX_PRODUCTS = CATALOG.length
const PRODUCT_BY_ID = new Map(CATALOG.map(product => [product.id, product]))
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

function fail(message) {
  throw new Error(/[.!?]$/.test(message) ? message : `${message}.`)
}

function requireProductId(id) {
  if (typeof id !== 'string' || !PRODUCT_BY_ID.has(id)) fail('Unknown product id')
  return id
}

function readRecord(value, expectedKeys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`)
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) fail(`${label} must be a plain object`)

  const keys = Reflect.ownKeys(value)
  if (keys.length !== expectedKeys.length || keys.some(key => typeof key !== 'string' || !expectedKeys.includes(key))) {
    fail(`${label} has missing or unknown fields`)
  }

  const record = Object.create(null)
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail(`${label} fields must be plain data`)
    record[key] = descriptor.value
  }
  return record
}

function readArray(value, label, maxLength) {
  if (!Array.isArray(value)) fail(`${label} must be an array`)
  if (value.length > maxLength) fail(`${label} exceeds the allowed limit`)

  const keys = Reflect.ownKeys(value)
  if (keys.length !== value.length + 1 || keys.some(key => key !== 'length' && !/^(0|[1-9]\d*)$/.test(String(key)))) {
    fail(`${label} must contain only indexed values`)
  }

  const result = []
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail(`${label} must not contain gaps or accessors`)
    result.push(descriptor.value)
  }
  return result
}

function isSafeOrderId(value) {
  return typeof value === 'string' && value.length <= 64 && /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(value)
}

function isCanonicalDate(value) {
  if (typeof value !== 'string' || value.length !== 24) return false
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString() === value
}

function normalizeName(value) {
  if (typeof value !== 'string') fail('Name must be text')
  const name = value.trim()
  if (name.length < 1 || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) {
    fail('Name must be 1 to 80 characters without control characters')
  }
  return name
}

function normalizeEmail(value) {
  if (typeof value !== 'string') fail('Email must be text')
  const email = value.trim()
  if (email.length > 254 || /[\s\u0000-\u001f\u007f]/.test(email)) fail('Email is invalid or too long')
  const parts = email.split('@')
  if (parts.length !== 2 || parts[0].length < 1 || parts[0].length > 64) fail('Email is invalid')
  const labels = parts[1].split('.')
  if (labels.length < 2 || labels.some(label => label.length < 1 || label.length > 63)) fail('Email is invalid')
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(parts[0])) fail('Email is invalid')
  if (parts[0].startsWith('.') || parts[0].endsWith('.') || parts[0].includes('..')) fail('Email is invalid')
  if (labels.slice(0, -1).some(label => !/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label))) fail('Email is invalid')
  if (!/^[A-Za-z]{2,63}$/.test(labels.at(-1))) fail('Email is invalid')
  return email
}

function canonicalizeState(value) {
  const state = readRecord(value, ['schema', 'cart', 'saved', 'orders'], 'State')
  if (state.schema !== 1) fail('State schema is unsupported')

  const cartInput = readArray(state.cart, 'Cart', MAX_PRODUCTS)
  const savedInput = readArray(state.saved, 'Saved products', MAX_PRODUCTS)
  const ordersInput = readArray(state.orders, 'Orders', 100)
  const cart = cartInput.map(id => requireProductId(id))
  const saved = savedInput.map(id => requireProductId(id))
  if (new Set(cart).size !== cart.length) fail('Cart product ids must be unique')
  if (new Set(saved).size !== saved.length) fail('Saved product ids must be unique')

  const seenOrderIds = new Set()
  const orders = ordersInput.map((orderInput, index) => {
    const order = readRecord(orderInput, ['id', 'createdAt', 'name', 'email', 'items', 'totalCents', 'mode', 'currency'], `Order ${index + 1}`)
    if (!isSafeOrderId(order.id)) fail('Order id is invalid')
    if (seenOrderIds.has(order.id)) fail('Order ids must be unique')
    seenOrderIds.add(order.id)
    if (!isCanonicalDate(order.createdAt)) fail('Order date must be a canonical UTC timestamp')

    const name = normalizeName(order.name)
    const email = normalizeEmail(order.email)
    if (name !== order.name || email !== order.email) fail('Order contact fields must be normalized')

    const itemsInput = readArray(order.items, `Order ${index + 1} items`, MAX_PRODUCTS)
    if (itemsInput.length < 1) fail('Orders must contain at least one item')
    const seenProductIds = new Set()
    let totalCents = 0
    const items = itemsInput.map((itemInput, itemIndex) => {
      const item = readRecord(itemInput, ['productId', 'title', 'version', 'priceCents'], `Order ${index + 1} item ${itemIndex + 1}`)
      const productId = requireProductId(item.productId)
      if (seenProductIds.has(productId)) fail('Order product ids must be unique')
      seenProductIds.add(productId)
      const product = PRODUCT_BY_ID.get(productId)
      if (item.title !== product.name || item.version !== product.version || item.priceCents !== product.priceCents) {
        fail('Order item snapshot does not match the trusted catalog')
      }
      totalCents += product.priceCents
      return {
        productId,
        title: product.name,
        version: product.version,
        priceCents: product.priceCents
      }
    })

    if (!Number.isSafeInteger(order.totalCents) || order.totalCents !== totalCents) fail('Order total is invalid')
    if (order.mode !== 'demo' || order.currency !== 'USD') fail('Order mode or currency is invalid')
    return {
      id: order.id,
      createdAt: order.createdAt,
      name,
      email,
      items,
      totalCents,
      mode: 'demo',
      currency: 'USD'
    }
  })

  return { schema: 1, cart, saved, orders }
}

function scanParsedTree(root) {
  const pending = [{ value: root, depth: 0 }]
  let visited = 0
  while (pending.length) {
    const { value, depth } = pending.pop()
    if (!value || typeof value !== 'object') continue
    visited += 1
    if (visited > 10000 || depth > 32) fail('Backup structure is too complex')
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) fail('Backup contains an invalid object')

    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') fail('Backup contains an invalid key')
      if (DANGEROUS_KEYS.has(key)) fail('Backup contains a dangerous key')
      if (Array.isArray(value) && key !== 'length' && !/^(0|[1-9]\d*)$/.test(key)) fail('Backup arrays contain unknown fields')
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (descriptor && Object.hasOwn(descriptor, 'value')) pending.push({ value: descriptor.value, depth: depth + 1 })
    }
  }
}

export function createState() {
  return { schema: 1, cart: [], saved: [], orders: [] }
}

export function addToCart(state, id) {
  const productId = requireProductId(id)
  const current = canonicalizeState(state)
  if (current.cart.includes(productId)) return current
  if (current.cart.length >= MAX_PRODUCTS) fail('Cart is full')
  return { ...current, cart: [...current.cart, productId] }
}

export function removeFromCart(state, id) {
  const productId = requireProductId(id)
  const current = canonicalizeState(state)
  return { ...current, cart: current.cart.filter(itemId => itemId !== productId) }
}

export function toggleSaved(state, id) {
  const productId = requireProductId(id)
  const current = canonicalizeState(state)
  const saved = current.saved.includes(productId)
    ? current.saved.filter(itemId => itemId !== productId)
    : [...current.saved, productId]
  return { ...current, saved }
}

export function subtotal(state) {
  const current = canonicalizeState(state)
  return current.cart.reduce((sum, id) => sum + PRODUCT_BY_ID.get(id).priceCents, 0)
}

export function createDemoOrder(state, contact, details) {
  const current = canonicalizeState(state)
  if (current.cart.length === 0) fail('Cart is empty')
  if (current.orders.length >= 100) fail('Order history is full')

  const normalizedContact = readRecord(contact, ['name', 'email'], 'Contact')
  const normalizedDetails = readRecord(details, ['id', 'createdAt'], 'Order details')
  if (!isSafeOrderId(normalizedDetails.id)) fail('Order id is invalid')
  if (current.orders.some(order => order.id === normalizedDetails.id)) fail('Order id already exists')
  if (!isCanonicalDate(normalizedDetails.createdAt)) fail('Order date must be a canonical UTC timestamp')

  const name = normalizeName(normalizedContact.name)
  const email = normalizeEmail(normalizedContact.email)
  const items = current.cart.map(id => {
    const product = PRODUCT_BY_ID.get(id)
    return {
      productId: product.id,
      title: product.name,
      version: product.version,
      priceCents: product.priceCents
    }
  })
  const totalCents = items.reduce((sum, item) => sum + item.priceCents, 0)
  const order = {
    id: normalizedDetails.id,
    createdAt: normalizedDetails.createdAt,
    name,
    email,
    items,
    totalCents,
    mode: 'demo',
    currency: 'USD'
  }
  return { schema: 1, cart: [], saved: current.saved, orders: [...current.orders, order] }
}

export function exportBackup(state) {
  const canonicalState = canonicalizeState(state)
  const text = JSON.stringify({ format: FORMAT, version: VERSION, state: canonicalState })
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) fail('Backup exceeds the 1 MiB limit')
  return text
}

// Plain-language problem with checkout details, or an empty string when the order can be created.
export function checkoutProblem(contact) {
  const name = typeof contact?.name === 'string' ? contact.name.trim() : ''
  const email = typeof contact?.email === 'string' ? contact.email.trim() : ''
  if (!name) return 'Enter your name.'
  if (name.length > 80) return 'Keep the name to 80 characters or fewer.'
  if (/[\u0000-\u001f\u007f]/.test(name)) return 'Remove the special characters from the name.'
  if (!email) return 'Enter an email address.'
  try {
    normalizeEmail(email)
  } catch {
    return 'Enter a full email address, such as jordan@example.com.'
  }
  return ''
}

// Backup file name based on the visitor's local calendar date, not UTC.
export function backupFileName(date = new Date()) {
  const pad = value => String(value).padStart(2, '0')
  return `Toolroom_backup_${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`
}

const formatCents = cents => `$${(cents / 100).toFixed(2)}`

// Readable receipt for a stored demo order.
export function receiptText(order) {
  const lines = [
    'Toolroom receipt',
    '',
    `Order ${order.id}`,
    `Placed ${order.createdAt.slice(0, 10)}`,
    `Name ${order.name}`,
    `Email ${order.email}`,
    '',
    ...order.items.map(item => `${item.title} ${item.version}`.padEnd(40, ' ') + formatCents(item.priceCents).padStart(10, ' ')),
    '',
    'Total'.padEnd(40, ' ') + formatCents(order.totalCents).padStart(10, ' '),
    '',
    'This is a demo order. No payment was taken and no license was issued.'
  ]
  return lines.join('\r\n') + '\r\n'
}

export function parseBackup(text) {
  if (typeof text !== 'string') fail('Backup must be text')
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) fail('Backup exceeds the 1 MiB limit')

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    fail('Backup is not valid JSON')
  }

  scanParsedTree(parsed)
  const envelope = readRecord(parsed, ['format', 'version', 'state'], 'Backup envelope')
  if (envelope.format !== FORMAT || envelope.version !== VERSION) fail('Backup format or version is unsupported')
  return canonicalizeState(envelope.state)
}
