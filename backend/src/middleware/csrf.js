const crypto = require('crypto');
const { fail } = require('../utils/http');

/**
 * CSRF protection — signed double-submit cookie pattern.
 *
 * WHY, given SameSite=Strict is already set:
 * SameSite is the primary defence and is genuinely strong here. But it is a
 * single control enforced entirely by the BROWSER, and defence-in-depth matters
 * for a money-moving app:
 *   - Older/edge browsers may not enforce SameSite.
 *   - "Same-site" is broader than "same-origin": any subdomain
 *     (e.g. a compromised blog.example.com) counts as same-site and would still
 *     have SameSite=Strict cookies attached to api.example.com requests.
 *   - If the API ever moves to a different site, SameSite=None becomes necessary
 *     and the cookie defence vanishes overnight. The token keeps working.
 *
 * HOW: on login we set a `csrf_token` cookie that is deliberately NOT httpOnly,
 * so our own JS can read it and echo it back in an `X-CSRF-Token` header. An
 * attacker's site can force the browser to SEND the cookie cross-site, but the
 * same-origin policy stops them READING it — so they cannot produce the matching
 * header. Reading the cookie requires already having XSS on our origin, at which
 * point CSRF is the least of the problems.
 *
 * The token is HMAC-signed, so it cannot be forged even if an attacker can plant
 * a cookie (e.g. via a subdomain), which defeats naive unsigned double-submit.
 */

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';

// Methods that cannot change state need no protection.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Exempt from the double-submit check:
//  - /webhooks/*      authenticated by HMAC signature, no cookie involved.
//  - /api/auth/oauth/* the OAuth flow is session-ESTABLISHING, not an action on
//    an existing session, so it carries its own CSRF defence instead: the `state`
//    parameter on the redirect and an unguessable, single-use signed `ticket` on
//    /complete. A stale access_token cookie from a previous login must not make
//    the double-submit check demand a header this pre-session flow cannot send.
const EXEMPT_PATHS = [/^\/webhooks\//, /^\/api\/auth\/oauth\//];

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

// token = <random>.<hmac(random)> — self-verifying, no server-side storage.
function generateToken(secret) {
  const random = crypto.randomBytes(32).toString('hex');
  return `${random}.${sign(random, secret)}`;
}

function isValidToken(token, secret) {
  if (typeof token !== 'string' || !token.includes('.')) return false;
  const [random, mac] = token.split('.');
  if (!random || !mac) return false;
  const expected = sign(random, secret);
  const a = Buffer.from(mac, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function setCsrfCookie(res, secret) {
  const token = generateToken(secret);
  res.cookie(CSRF_COOKIE, token, {
    // NOT httpOnly on purpose: our own JS must read it to set the header.
    // It is not a credential — it is only useful alongside the session cookie.
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  return token;
}

function clearCsrfCookie(res) {
  res.clearCookie(CSRF_COOKIE, { path: '/' });
}

function csrfProtection(secret) {
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    if (EXEMPT_PATHS.some((re) => re.test(req.path))) return next();

    // No session cookie => no CSRF risk (nothing to ride on). This keeps
    // login/register usable before a token has been issued.
    if (!req.cookies || !req.cookies.access_token) return next();

    const cookieToken = req.cookies[CSRF_COOKIE];
    const headerToken = req.get(CSRF_HEADER);

    if (!cookieToken || !headerToken) {
      return fail(res, 'CSRF token missing', 403);
    }
    // Both must match AND be authentically signed by us.
    if (cookieToken !== headerToken || !isValidToken(headerToken, secret)) {
      return fail(res, 'CSRF token invalid', 403);
    }

    return next();
  };
}

module.exports = { csrfProtection, setCsrfCookie, clearCsrfCookie, generateToken, isValidToken, CSRF_COOKIE, CSRF_HEADER };
