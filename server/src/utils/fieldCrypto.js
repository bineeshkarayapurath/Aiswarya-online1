const crypto = require('crypto');
const config = require('../config/constants');

// Field-level encryption for sensitive member data (address, email, occupation,
// education) using Node's built-in crypto module only.
//
// Cipher:  AES-256-CBC with a fresh random 16-byte IV per value, so encrypting
//          the same plaintext twice produces different ciphertext. That is what
//          makes these fields useless to anyone reading the raw collection.
// Integrity: CBC alone does not authenticate. An HMAC-SHA256 over (IV || cipher)
//          is stored alongside it (encrypt-then-MAC) so a tampered or truncated
//          value is rejected on read instead of decrypting to garbage.
//
// Format:  enc:v1:<iv-hex>:<mac-hex>:<ciphertext-base64>
// The "enc:v1:" prefix is the marker that lets the schema setter tell an
// already-encrypted value (e.g. re-saving a document loaded from the database)
// apart from fresh plaintext, which is what prevents double encryption. Values
// that do not carry the prefix — including any legacy plaintext written before
// this feature existed — are returned unchanged, so existing records keep
// working and are transparently encrypted the next time they are saved.
//
// The key is derived deterministically (SHA-256) from FIELD_ENCRYPTION_KEY so any
// length secret yields the fixed 32 bytes AES-256 requires.

const PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

let cachedKey = null;

function key() {
  if (!cachedKey) {
    cachedKey = crypto.createHash('sha256').update(String(config.FIELD_ENCRYPTION_KEY)).digest();
  }
  return cachedKey;
}

function computeMac(data) {
  return crypto.createHmac('sha256', key()).update(data).digest();
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

function encryptField(value) {
  if (value === null || value === undefined) return value;
  const plain = String(value);
  if (!plain) return plain;
  // Already ciphertext: never encrypt twice (re-saving a loaded document).
  if (isEncrypted(plain)) return plain;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const mac = computeMac(Buffer.concat([iv, ciphertext]));
  return `${PREFIX}${iv.toString('hex')}:${mac.toString('hex')}:${ciphertext.toString('base64')}`;
}

function decryptField(value) {
  if (value === null || value === undefined) return value;
  const stored = String(value);
  // Legacy plaintext (or an empty value): nothing to decrypt.
  if (!isEncrypted(stored)) return stored;

  const parts = stored.slice(PREFIX.length).split(':');
  if (parts.length !== 3) return '';
  try {
    const iv = Buffer.from(parts[0], 'hex');
    const mac = Buffer.from(parts[1], 'hex');
    const ciphertext = Buffer.from(parts[2], 'base64');
    if (iv.length !== IV_LENGTH) return '';

    const expected = computeMac(Buffer.concat([iv, ciphertext]));
    // timingSafeEqual throws on length mismatch, so guard first. A mismatch here
    // means the value was altered or encrypted with a different key.
    if (mac.length !== expected.length || !crypto.timingSafeEqual(mac, expected)) {
      return '';
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key(), iv);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    // Malformed ciphertext or wrong key: never surface garbled data.
    return '';
  }
}

module.exports = { encryptField, decryptField, isEncrypted, PREFIX };
