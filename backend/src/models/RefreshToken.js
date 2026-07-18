const db = require('../db/connection');

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

class RefreshToken {
  static async store({ jti, userId, tokenHash, userAgent, ip }) {
    await db('refresh_tokens').insert({
      id: jti,
      user_id: userId,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + SEVEN_DAYS_MS),
      user_agent: userAgent ? String(userAgent).slice(0, 300) : null,
      ip: ip ? String(ip).slice(0, 64) : null
    });
  }

  static async findById(jti) {
    return db('refresh_tokens').where({ id: jti }).first();
  }

  static async revoke(jti, replacedBy = null) {
    return db('refresh_tokens').where({ id: jti }).update({ revoked: true, replaced_by: replacedBy, updated_at: db.fn.now() });
  }

  // Revoke every active token for a user (used on reuse-detection and logout-all).
  static async revokeAllForUser(userId) {
    return db('refresh_tokens').where({ user_id: userId, revoked: false }).update({ revoked: true, updated_at: db.fn.now() });
  }

  static isUsable(row) {
    return !!row && !row.revoked && new Date(row.expires_at) > new Date();
  }

  /**
   * Session binding (spec 3.4). A refresh token is bound to the User-Agent that
   * obtained it; presenting it from a different client indicates the token was
   * lifted and replayed elsewhere.
   *
   * We bind on User-Agent but deliberately NOT on IP: IPs change legitimately
   * and constantly (wifi -> cellular, carrier NAT, VPN), so enforcing them would
   * log real users out every time they moved network — a self-inflicted DoS for
   * negligible gain. A UA, by contrast, does not change mid-session. IP changes
   * are still recorded as a signal (see routes/auth.js) rather than blocked.
   */
  static matchesBinding(row, userAgent) {
    const stored = row.user_agent || '';
    const current = userAgent ? String(userAgent).slice(0, 300) : '';
    return stored === current;
  }
}

module.exports = RefreshToken;
