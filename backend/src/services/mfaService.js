const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

const BACKUP_CODE_COUNT = 10;

// Create a new TOTP secret + the otpauth URL/QR the user scans in their app.
async function generateSecret(email) {
  const secret = speakeasy.generateSecret({ name: `SkillBridge (${email})`, length: 20 });
  const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);
  return { base32: secret.base32, otpauthUrl: secret.otpauth_url, qrDataUrl };
}

// Verify a 6-digit TOTP against the base32 secret. window:1 tolerates ~30s clock drift.
function verifyToken(base32Secret, token) {
  if (!base32Secret || !token) return false;
  return speakeasy.totp.verify({
    secret: base32Secret,
    encoding: 'base32',
    token: String(token).replace(/\s/g, ''),
    window: 1
  });
}

// One-time recovery codes: returned in plaintext ONCE, stored only as bcrypt hashes.
async function generateBackupCodes() {
  const plain = [];
  const hashed = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = crypto.randomBytes(4).toString('hex'); // 8 hex chars
    plain.push(code);
    hashed.push(await bcrypt.hash(code, 10));
  }
  return { plain, hashed };
}

// Returns the remaining hashes with the matched one removed, or null if no match.
async function consumeBackupCode(inputCode, hashedCodes) {
  const clean = String(inputCode).trim().toLowerCase();
  for (let i = 0; i < hashedCodes.length; i++) {
    // eslint-disable-next-line no-await-in-loop
    if (await bcrypt.compare(clean, hashedCodes[i])) {
      return hashedCodes.filter((_, idx) => idx !== i);
    }
  }
  return null;
}

module.exports = { generateSecret, verifyToken, generateBackupCodes, consumeBackupCode };
