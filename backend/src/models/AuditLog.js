const db = require('../db/connection');

class AuditLog {
  static async record({ userId = null, event, ip = null, userAgent = null, metadata = null }) {
    return db('audit_logs').insert({
      user_id: userId,
      event,
      ip: ip ? String(ip).slice(0, 64) : null,
      user_agent: userAgent ? String(userAgent).slice(0, 300) : null,
      metadata: metadata ? JSON.stringify(metadata) : null
    });
  }

  static async recent(limit = 100) {
    return db('audit_logs')
      .leftJoin('users', 'users.id', 'audit_logs.user_id')
      .select('audit_logs.*', db.raw('users.email as user_email'))
      .orderBy('audit_logs.created_at', 'desc')
      .limit(limit);
  }

  // Count failed logins for an account (by user id) within the last N minutes.
  static async countRecentFailedLogins(userId, minutes = 15) {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    const row = await db('audit_logs')
      .where({ user_id: userId, event: 'login.failure' })
      .where('created_at', '>=', since)
      .count('* as count')
      .first();
    return Number(row?.count || 0);
  }
}

module.exports = AuditLog;
