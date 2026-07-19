const bcrypt = require('bcryptjs');

/**
 * Password policy (coursework spec 3.1).
 *
 * MAX_LENGTH exists for a concrete cryptographic reason, not arbitrary limits:
 * bcrypt only consumes the first 72 BYTES of input and silently ignores the
 * rest. Without an explicit maximum, "correct-horse-battery-staple…"(100 chars)
 * and a 72-byte prefix of it would produce the SAME hash — so a user believing
 * they had a 100-char password would really have a 72-byte one, and two
 * different long passwords could collide. Rejecting >72 bytes makes the limit
 * explicit and honest instead of silently truncating.
 */
const MIN_LENGTH = 12;
const MAX_LENGTH = 72; // bcrypt's hard input limit, in bytes
const HISTORY_SIZE = 5; // spec: prevent reuse of the last 5
const MAX_AGE_DAYS = 90; // spec: expire every 90 days
const BCRYPT_COST = 12;

class PasswordService {
  static async hashPassword(plainPassword) {
    return bcrypt.hash(plainPassword, BCRYPT_COST);
  }

  static async verifyPassword(plainPassword, hash) {
    return bcrypt.compare(plainPassword, hash);
  }

  static validatePasswordStrength(password) {
    const errors = [];

    // Measure BYTES, not characters: a multi-byte character (é, emoji) can push
    // a visually-short password past bcrypt's 72-byte limit.
    const byteLength = Buffer.byteLength(password, 'utf8');

    if (password.length < MIN_LENGTH) {
      errors.push(`Password must be at least ${MIN_LENGTH} characters`);
    }
    if (byteLength > MAX_LENGTH) {
      errors.push(`Password must be at most ${MAX_LENGTH} bytes (about ${MAX_LENGTH} characters)`);
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain number');
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push('Password must contain special character (!@#$%^&* etc)');
    }

    return {
      valid: errors.length === 0,
      errors,
      strength: errors.length === 0 ? 'strong' : errors.length <= 2 ? 'medium' : 'weak'
    };
  }

  /**
   * Reuse check. History holds bcrypt hashes, so we cannot compare strings —
   * each stored hash must be bcrypt-compared against the candidate in turn.
   * That's HISTORY_SIZE+1 bcrypt operations (~250ms each); acceptable because
   * password changes are rare, and it keeps old passwords unrecoverable.
   */
  static async isPasswordReused(plainPassword, currentHash, historyJson) {
    if (currentHash && (await bcrypt.compare(plainPassword, currentHash))) return true;

    const history = PasswordService.parseHistory(historyJson);
    for (const oldHash of history) {
      // eslint-disable-next-line no-await-in-loop
      if (await bcrypt.compare(plainPassword, oldHash)) return true;
    }
    return false;
  }

  static parseHistory(historyJson) {
    if (!historyJson) return [];
    try {
      const parsed = JSON.parse(historyJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // Push the outgoing hash onto the history, keeping only the most recent N.
  static buildHistory(previousHash, historyJson) {
    const history = PasswordService.parseHistory(historyJson);
    if (previousHash) history.unshift(previousHash);
    return JSON.stringify(history.slice(0, HISTORY_SIZE));
  }

  // 90-day expiry. Null changed-at is treated as expired (fail closed).
  static isPasswordExpired(passwordChangedAt) {
    if (!passwordChangedAt) return true;
    const ageMs = Date.now() - new Date(passwordChangedAt).getTime();
    return ageMs > MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  }

  static daysUntilExpiry(passwordChangedAt) {
    if (!passwordChangedAt) return 0;
    const ageMs = Date.now() - new Date(passwordChangedAt).getTime();
    return Math.max(0, MAX_AGE_DAYS - Math.floor(ageMs / (24 * 60 * 60 * 1000)));
  }
}

PasswordService.MIN_LENGTH = MIN_LENGTH;
PasswordService.MAX_LENGTH = MAX_LENGTH;
PasswordService.HISTORY_SIZE = HISTORY_SIZE;
PasswordService.MAX_AGE_DAYS = MAX_AGE_DAYS;

module.exports = PasswordService;
