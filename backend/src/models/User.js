const db = require('../db/connection');
const bcrypt = require('bcryptjs');
const cryptoService = require('../services/cryptoService');

const LOCK_THRESHOLD = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000;

class User {
  static async create(email, plainPassword, role) {
    if (!['client', 'freelancer'].includes(role)) {
      throw new Error('Invalid role');
    }

    const passwordHash = await this.hashPassword(plainPassword);

    const [user] = await db('users')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        role,
        // Starts the 90-day expiry clock. Without this the column is NULL, and
        // isPasswordExpired() fails closed — instantly expiring brand-new accounts.
        password_changed_at: db.fn.now(),
      })
      .returning('*');

    return user;
  }

  static async findByEmail(email) {
    return db('users').where({ email: email.toLowerCase() }).first();
  }

  static async findById(id) {
    return db('users').where({ id }).first();
  }

  static async verifyPassword(plainPassword, hash) {
    return bcrypt.compare(plainPassword, hash);
  }

  static async hashPassword(plainPassword) {
    return bcrypt.hash(plainPassword, 12);
  }

  static async incrementFailedAttempts(userId) {
    return db('users').where({ id: userId }).increment('failed_login_attempts', 1);
  }

  static async lockAccount(userId) {
    const lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
    return db('users').where({ id: userId }).update({ locked_until: lockedUntil });
  }

  static async isLocked(userId) {
    const user = await this.findById(userId);
    if (!user) return false;

    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      return true;
    }

    if (user.locked_until && new Date() >= new Date(user.locked_until)) {
      await db('users')
        .where({ id: userId })
        .update({ locked_until: null, failed_login_attempts: 0 });
      return false;
    }

    return false;
  }

  static async resetFailedAttempts(userId) {
    return db('users').where({ id: userId }).update({ failed_login_attempts: 0, locked_until: null });
  }

  // last_login_ip is personal data (GDPR) and is never filtered/joined on, so it
  // is stored encrypted at rest rather than in plaintext.
  static async updateLastLogin(userId, ipAddress) {
    return db('users').where({ id: userId }).update({
      last_login_at: new Date(),
      last_login_ip: ipAddress ? cryptoService.encrypt(String(ipAddress)) : null,
    });
  }

  // Decrypt a stored last_login_ip for display to an authorized viewer.
  static readLastLoginIp(user) {
    if (!user?.last_login_ip) return null;
    try {
      return cryptoService.decrypt(user.last_login_ip);
    } catch {
      return null;
    }
  }

  // ---- Profile ----

  // Only these columns may ever be written through updateProfile. This prevents
  // mass assignment: even if a caller passes { role: 'admin' } or
  // { password_hash: ... }, those keys are dropped before the UPDATE.
  static get PROFILE_WRITABLE() {
    return [
      'display_name',
      'bio',
      'location',
      'skills',
      'hourly_rate',
      'portfolio_url',
      'cv_url',
      'company_name',
      'company_website',
      'profile_image_url',
      'profile_completion_percentage',
      'profile_completed'
    ];
  }

  static async updateProfile(userId, fields) {
    const safe = {};
    for (const key of User.PROFILE_WRITABLE) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) safe[key] = fields[key];
    }
    const [user] = await db('users')
      .where({ id: userId })
      .update({ ...safe, last_profile_update: db.fn.now(), updated_at: db.fn.now() })
      .returning('*');
    return user;
  }

  // ---- Password lifecycle ----

  /**
   * Change a password atomically: rotate the old hash into history, set the new
   * hash, stamp password_changed_at (restarting the 90-day expiry clock), and
   * clear any forced-reset flag. Wrapped in a transaction so the history and the
   * new hash can never disagree.
   */
  static async changePassword(userId, newHash, previousHash, historyJson) {
    const PasswordService = require('../services/passwordService');
    return db.transaction(async (trx) => {
      const [user] = await trx('users')
        .where({ id: userId })
        .update({
          password_hash: newHash,
          password_history: PasswordService.buildHistory(previousHash, historyJson),
          password_changed_at: db.fn.now(),
          must_change_password: false,
          updated_at: db.fn.now()
        })
        .returning('*');
      return user;
    });
  }

  // ---- MFA ----

  // Store the (encrypted) TOTP secret during setup; not enabled until confirmed.
  static async setMfaSecret(userId, encryptedSecret) {
    return db('users').where({ id: userId }).update({ mfa_secret: encryptedSecret, mfa_enabled: false });
  }

  static async enableMfa(userId, backupCodesJson) {
    return db('users').where({ id: userId }).update({ mfa_enabled: true, mfa_backup_codes: backupCodesJson });
  }

  static async disableMfa(userId) {
    return db('users').where({ id: userId }).update({ mfa_secret: null, mfa_enabled: false, mfa_backup_codes: null });
  }

  static async updateBackupCodes(userId, backupCodesJson) {
    return db('users').where({ id: userId }).update({ mfa_backup_codes: backupCodesJson });
  }

  // Count of completed contracts for a user (as either party).
  static async completedContractsCount(userId, role) {
    const column = role === 'freelancer' ? 'freelancer_id' : 'client_id';
    const row = await db('contracts')
      .where({ [column]: userId, status: 'completed' })
      .count('* as count')
      .first();
    return Number(row ? row.count : 0);
  }

  // Search by display name, skills, or email (for autocomplete).
  static async search(query, role, limit = 10) {
    const builder = db('users').select('id', 'email', 'role', 'display_name', 'profile_image_url', 'skills');
    if (role) builder.where('role', role);
    if (query) {
      builder.where((b) =>
        b
          .whereILike('display_name', `%${query}%`)
          .orWhereILike('skills', `%${query}%`)
          .orWhereILike('email', `%${query}%`)
      );
    }
    return builder.limit(limit);
  }
}

User.LOCK_THRESHOLD = LOCK_THRESHOLD;

module.exports = User;
