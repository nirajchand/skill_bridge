const db = require('../db/connection');
const bcrypt = require('bcryptjs');

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

  static async updateLastLogin(userId, ipAddress) {
    return db('users').where({ id: userId }).update({
      last_login_at: new Date(),
      last_login_ip: ipAddress,
    });
  }

  // ---- Profile ----

  static async updateProfile(userId, fields) {
    const [user] = await db('users')
      .where({ id: userId })
      .update({ ...fields, last_profile_update: db.fn.now(), updated_at: db.fn.now() })
      .returning('*');
    return user;
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
