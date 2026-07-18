const { fail } = require('../utils/http');
const audit = require('../services/auditService');

/**
 * IP allow-listing and automatic blocking (coursework spec 3.2).
 *
 * Layers, in order:
 *  1. ALLOW-LIST — trusted IPs (office/CI/monitoring) skip auto-blocking. This
 *     exists so an internal scanner or a shared corporate NAT cannot lock the
 *     whole organisation out of its own app.
 *  2. DENY-LIST — statically banned IPs, blocked outright.
 *  3. AUTO-BLOCK — an IP that trips too many auth failures across DIFFERENT
 *     accounts is credential-stuffing (per-account lockout can't see this
 *     pattern, because each account only fails once or twice). Blocked for a
 *     cooling-off period.
 *
 * Store is in-memory: a deliberate trade-off documented in SECURITY.md. It is
 * per-process and resets on restart; a multi-instance deployment needs Redis.
 * Rate limiting already has the same property, so this adds no new weakness.
 */

const AUTO_BLOCK_THRESHOLD = 20; // auth failures from one IP...
const AUTO_BLOCK_WINDOW_MS = 15 * 60 * 1000; // ...within 15 minutes
const AUTO_BLOCK_DURATION_MS = 60 * 60 * 1000; // => blocked for 1 hour

// Comma-separated env lists, e.g. IP_ALLOWLIST="203.0.113.5,198.51.100.7"
const parseList = (raw) =>
  new Set(
    (raw || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );

const allowList = parseList(process.env.IP_ALLOWLIST);
const denyList = parseList(process.env.IP_DENYLIST);

// ip -> { failures: number[], blockedUntil: number }
const ipState = new Map();

function normalise(ip) {
  if (!ip) return '';
  // Express reports IPv4-mapped IPv6 for localhost (::ffff:127.0.0.1).
  return String(ip).replace(/^::ffff:/, '');
}

function isAllowListed(ip) {
  return allowList.has(normalise(ip));
}

function getState(ip) {
  if (!ipState.has(ip)) ipState.set(ip, { failures: [], blockedUntil: 0 });
  return ipState.get(ip);
}

/** Record an authentication failure for this IP; auto-block if it crosses the threshold. */
function recordAuthFailure(req) {
  const ip = normalise(req.ip);
  if (!ip || isAllowListed(ip)) return; // never auto-block trusted infrastructure

  const now = Date.now();
  const state = getState(ip);
  state.failures = state.failures.filter((t) => now - t < AUTO_BLOCK_WINDOW_MS);
  state.failures.push(now);

  if (state.failures.length >= AUTO_BLOCK_THRESHOLD && state.blockedUntil < now) {
    state.blockedUntil = now + AUTO_BLOCK_DURATION_MS;
    state.failures = [];
    console.warn(`[SECURITY ALERT] IP ${ip} auto-blocked for 1h after ${AUTO_BLOCK_THRESHOLD} auth failures.`);
    audit.log(req, 'ip.auto_blocked', { metadata: { failures: AUTO_BLOCK_THRESHOLD, minutes: 60 } });
  }
}

function isBlocked(ip) {
  const clean = normalise(ip);
  if (isAllowListed(clean)) return false; // allow-list always wins
  if (denyList.has(clean)) return true;
  const state = ipState.get(clean);
  return !!state && state.blockedUntil > Date.now();
}

/** Express middleware: reject requests from denied/auto-blocked IPs. */
function ipGuard(req, res, next) {
  if (isBlocked(req.ip)) {
    return fail(res, 'Your IP address has been temporarily blocked due to suspicious activity', 403);
  }
  return next();
}

// Exposed for tests/admin visibility.
function _reset() {
  ipState.clear();
}

module.exports = {
  ipGuard,
  recordAuthFailure,
  isBlocked,
  isAllowListed,
  _reset,
  AUTO_BLOCK_THRESHOLD
};
