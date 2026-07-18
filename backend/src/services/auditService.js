const AuditLog = require('../models/AuditLog');

const FAILED_LOGIN_ALERT_THRESHOLD = 5;

// Never throws: audit logging must not break the request flow. Returns the
// promise so callers that need write-ordering (e.g. the brute-force counter)
// can await it; everyone else can safely ignore it.
function log(req, event, { userId = null, metadata = null } = {}) {
  const entry = {
    userId,
    event,
    ip: req?.ip || null,
    userAgent: req?.headers?.['user-agent'] || null,
    metadata
  };
  return AuditLog.record(entry).catch((err) => console.error('Audit log failed:', err.message));
}

// After a failed login, check whether this account is being brute-forced and
// emit an alert (here: stderr; wire to email/Slack/PagerDuty in production).
async function checkFailedLoginAlert(req, userId, email) {
  try {
    const count = await AuditLog.countRecentFailedLogins(userId, 15);
    if (count >= FAILED_LOGIN_ALERT_THRESHOLD) {
      console.warn(
        `[SECURITY ALERT] ${count} failed logins for ${email} in the last 15 min from ip=${req?.ip}. Possible brute-force.`
      );
      log(req, 'alert.brute_force', { userId, metadata: { failed_count: count } });
    }
  } catch (err) {
    console.error('Failed-login alert check error:', err.message);
  }
}

module.exports = { log, checkFailedLoginAlert, FAILED_LOGIN_ALERT_THRESHOLD };
