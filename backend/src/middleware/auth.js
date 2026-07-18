const JWTService = require('../services/jwtService');
const { ACCESS_COOKIE } = require('../utils/cookies');

// Prefer the httpOnly cookie (browser); fall back to a Bearer header for
// non-browser API clients (curl, mobile). Browsers never expose the cookie to JS.
function extractToken(req) {
  if (req.cookies && req.cookies[ACCESS_COOKIE]) return req.cookies[ACCESS_COOKIE];
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

function verifyToken(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const decoded = JWTService.verifyAccessToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Reject non-session tokens (e.g. the short-lived MFA challenge token).
  if (decoded.purpose) {
    return res.status(401).json({ error: 'Invalid token type' });
  }

  req.user = decoded;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = {
  verifyToken,
  requireAuth,
};
