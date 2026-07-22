const audit = require('../services/auditService');

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      // A role check that a valid session fails is an authorisation denial, and
      // those are precisely what an audit trail exists to capture — an account
      // reaching for a resource above its privilege is a signal worth keeping.
      // Logged here (not just at the route) so every requireRole use is covered.
      audit.log(req, 'access.denied', {
        userId: req.user.userId,
        metadata: { method: req.method, path: req.originalUrl, role: req.user.role, required: allowedRoles }
      });
      return res.status(403).json({ error: `Forbidden. Required role: ${allowedRoles.join(' or ')}` });
    }

    next();
  };
}

// Convenience wrapper for admin-only routes.
const requireAdmin = requireRole(['admin']);

module.exports = { requireRole, requireAdmin };
