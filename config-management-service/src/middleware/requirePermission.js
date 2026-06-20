import { pool } from '../db.js';

/**
 * Checks if a user has a permission across ANY of their role assignments
 * for their client — context-independent. Used for RBAC management routes
 * (users, roles, permissions) where the operation isn't scoped to a specific
 * context the way config read/write is.
 */
async function userHasPermission(userId, clientId, resource, action) {
  const result = await pool.query(
    `SELECT 1
     FROM user_role_assignments ura
     JOIN role_permissions rp ON rp.role_id = ura.role_id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE ura.user_id = $1
       AND ura.client_id = $2
       AND p.resource = $3
       AND p.action = $4
     LIMIT 1`,
    [userId, clientId, resource, action]
  );
  return result.rowCount > 0;
}

/**
 * Middleware factory: checks that the logged-in user has a specific RBAC permission.
 * Must run after userAuth (depends on req.user being set).
 * Platform admins bypass this check entirely.
 */
export function requirePermission(resource, action) {
  return async (req, res, next) => {
    try {
      // Platform admins have full access — skip RBAC check
      if (req.platformAdmin) return next();

      const userId = req.user?.id;
      const clientId = req.user?.client_id;
      if (!userId || !clientId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const allowed = await userHasPermission(userId, clientId, resource, action);
      if (!allowed) {
        return res.status(403).json({ error: `Permission denied: ${resource}:${action}` });
      }

      next();
    } catch (err) {
      console.error('requirePermission error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
}
