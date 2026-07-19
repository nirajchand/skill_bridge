const crypto = require('crypto');
const { secrets } = require('../config/secrets');

/**
 * Authenticated field-level encryption using AES-256-GCM.
 * Output format:  v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>
 *
 * GCM is chosen because it provides confidentiality AND integrity (the auth tag
 * detects tampering). A random 12-byte IV is generated per encryption so equal
 * plaintexts never produce equal ciphertexts. The key comes from ENCRYPTION_KEY
 * (validated to be 32 bytes at startup) — it is NOT hardcoded.
 */

const ALGO = 'aes-256-gcm';
const PREFIX = 'v1';

function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, secrets.encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}

function decryptWith(key, ivB64, tagB64, dataB64) {
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

function decrypt(payload) {
  if (payload === null || payload === undefined) return null;
  const parts = String(payload).split(':');
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    // Not an encrypted value (e.g. legacy plaintext) — return as-is.
    return payload;
  }
  const [, ivB64, tagB64, dataB64] = parts;
  try {
    return decryptWith(secrets.encryptionKey, ivB64, tagB64, dataB64);
  } catch (err) {
    // KEY ROTATION: the GCM auth tag fails against the wrong key, so a failure
    // here may simply mean this value predates the current key. Fall back to the
    // retiring key (if configured) until `npm run rotate-encryption` re-encrypts.
    if (secrets.encryptionKeyPrevious) {
      return decryptWith(secrets.encryptionKeyPrevious, ivB64, tagB64, dataB64);
    }
    throw err;
  }
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(`${PREFIX}:`);
}

module.exports = { encrypt, decrypt, isEncrypted };
