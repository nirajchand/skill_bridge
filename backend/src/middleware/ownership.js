/**
 * Centralized resource-ownership (IDOR) guard.
 *
 * Loads a resource by id, 404s if missing, then authorizes the caller: they must
 * either own it (their user id matches one of `ownerFields`) or hold one of
 * `allowRoles`. On success the resource is attached to req[attachAs] so handlers
 * don't re-query. This replaces copy-pasted `if (row.client_id !== req.user.userId)`
 * checks with one audited implementation.
 */
const { fail } = require('../utils/http');

function authorizeResource({ loader, idParam = 'id', ownerFields = [], 
  allowRoles = [], attachAs = 'resource' }) {
  const fields = Array.isArray(ownerFields) ? ownerFields : [ownerFields];
  return async (req, res, next) => {
    try {
      const resource = await loader(req.params[idParam]);
      if (!resource) return fail(res, 'Not found', 404);

      const uid = req.user.userId;
      const owns = fields.some((f) => resource[f] === uid);
      const roleOk = allowRoles.includes(req.user.role);

      if (!owns && !roleOk) return fail(res, 'Forbidden', 403);

      req[attachAs] = resource;
      next();
    } catch (err) {
      console.error('Ownership check error:', err);
      return fail(res, 'Authorization check failed', 500);
    }
  };
}

module.exports = { authorizeResource };
