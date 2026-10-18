import { verifyArchive } from './archive-desk-protection-core.mjs'

export const PROTECTION = Object.freeze({
  iterations: 600000,
  headerBytes: 48,
  tagBytes: 16,
  maxArchiveBytes: 52 * 1024 * 1024,
  minPassphraseCharacters: 12,
  maxPassphraseBytes: 1024
})
const encoder = new TextEncoder()
const magic = encoder.encode('ADLOCK01')

function snapshot(input, limit, label) {
  if (!(input instanceof Uint8Array)) throw new Error(`${label} must contain file bytes.`)
  if (!input.length || input.byteLength > limit) throw new Error(`${label} exceeds the supported file size.`)
  return input.slice()
}

function passphraseBytes(passphrase) {
  if (typeof passphrase !== 'string') throw new Error('Enter a passphrase.')
  const characters = Array.from(passphrase)
  if (!passphrase.trim() || characters.length < PROTECTION.minPassphraseCharacters) throw new Error('Use a unique passphrase with at least 12 characters.')
  if (characters.some(character => character.length === 1 && /[\uD800-\uDFFF]/.test(character))) throw new Error('The passphrase contains an incomplete Unicode character.')
  const bytes = encoder.encode(passphrase)
  if (bytes.length > PROTECTION.maxPassphraseBytes) throw new Error('The passphrase exceeds 1024 UTF-8 bytes.')
  return bytes
}

async function derive(passphrase, salt, usage) {
  const bytes = passphraseBytes(passphrase)
  try {
    const material = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveKey'])
    return await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PROTECTION.iterations }, material, { name: 'AES-GCM', length: 256 }, false, [usage])
  } finally { bytes.fill(0) }
}

function parseHeader(bytes) {
  if (bytes.length < PROTECTION.headerBytes + PROTECTION.tagBytes + 1) throw new Error('This is not a complete Archive Desk locked file.')
  if (!magic.every((value, index) => bytes[index] === value)) throw new Error('Choose an Archive Desk .adlock file.')
  if (bytes[8] !== 1 || bytes[9] !== 1 || bytes[46] !== 0 || bytes[47] !== 0) throw new Error('This locked-file format is unsupported.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, PROTECTION.headerBytes)
  if (view.getUint32(10) !== PROTECTION.iterations) throw new Error('This locked-file key setting is unsupported.')
  const length = view.getUint32(42)
  if (!length || length > PROTECTION.maxArchiveBytes || bytes.length !== PROTECTION.headerBytes + length + PROTECTION.tagBytes) throw new Error('The locked-file length is invalid.')
  return { salt: bytes.slice(14, 30), iv: bytes.slice(30, 42), length }
}

export async function protectArchive(input, passphrase) {
  const bytes = snapshot(input, PROTECTION.maxArchiveBytes, 'The ZIP')
  // Validate before the expensive password derivation. The source ZIP is copied
  // synchronously so caller changes cannot replace bytes during verification.
  const validation = passphraseBytes(passphrase)
  validation.fill(0)
  await verifyArchive(bytes)
  const header = new Uint8Array(PROTECTION.headerBytes)
  header.set(magic)
  header[8] = 1
  header[9] = 1
  const view = new DataView(header.buffer)
  view.setUint32(10, PROTECTION.iterations)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  header.set(salt, 14)
  header.set(iv, 30)
  view.setUint32(42, bytes.length)
  const key = await derive(passphrase, salt, 'encrypt')
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: header, tagLength: 128 }, key, bytes))
  const output = new Uint8Array(header.length + encrypted.length)
  output.set(header)
  output.set(encrypted, header.length)
  return output
}

export async function unlockArchive(input, passphrase) {
  const bytes = snapshot(input, PROTECTION.maxArchiveBytes + PROTECTION.headerBytes + PROTECTION.tagBytes, 'The locked file')
  const { salt, iv } = parseHeader(bytes)
  const key = await derive(passphrase, salt, 'decrypt')
  let plain
  try {
    plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: bytes.slice(0, PROTECTION.headerBytes), tagLength: 128 }, key, bytes.slice(PROTECTION.headerBytes)))
  } catch {
    throw new Error('Could not unlock. The passphrase is wrong or the file is damaged.')
  }
  const result = await verifyArchive(plain)
  return { bytes: plain, result }
}

export function inspectLockedFile(input) {
  const bytes = snapshot(input, PROTECTION.maxArchiveBytes + PROTECTION.headerBytes + PROTECTION.tagBytes, 'The locked file')
  const { length } = parseHeader(bytes)
  return { format: 'Archive Desk locked v1', encryptedBytes: bytes.length, archiveBytes: length }
}
