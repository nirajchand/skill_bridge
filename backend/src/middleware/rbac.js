function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden. Required role: ${allowedRoles.join(' or ')}` });
    }

    next();
  };
}

// Convenience wrapper for admin-only routes.
const requireAdmin = requireRole(['admin']);

module.exports = { requireRole, requireAdmin };
