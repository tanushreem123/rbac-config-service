import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { checkPermission } from '../services/rbacService.js';
import { canUseFeature } from '../services/featureFlagService.js';

/**
 * Auth middleware with detailed logging
 */
export async function authMiddleware(req, res, next) {

  try {
    // 1. Extract user_id from JWT
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[Auth] Missing or invalid token');
      return res.status(401).json({ error: 'Missing or invalid token' });
    }
    const token = authHeader.slice(7);
    console.log(token,process.env.JWT_SECRET,'secret key')
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.error('[Auth] JWT verification failed:', err.message);
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = decoded.user_id;
    if (!userId) {
      console.error('[Auth] Missing user_id in token');
      return res.status(401).json({ error: 'Invalid token' });
    }

    // 2. Fetch user's client_id from DB
    const userResult = await pool.query(
      'SELECT client_id, is_active FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];
    if (!user || !user.is_active) {
      console.error('[Auth] User not found or inactive:', userId);
      return res.status(403).json({ error: 'User not found or inactive' });
    }
    const userClientId = user.client_id;

    // 3. Domain check (client_id match)
    const resourceClientId = req.body?.client_id || req.query.client_id;
    if (!resourceClientId) {
      console.error('[Auth] Missing client_id in request');
      return res.status(400).json({ error: 'Missing client_id in request' });
    }
    if (userClientId !== resourceClientId) {
      console.error(`[Auth] Domain check failed: user ${userId} (client ${userClientId}) vs resource client ${resourceClientId}`);
      return res.status(403).json({ error: 'Cross-client access denied' });
    }

    // 4. RBAC check (optional - only if context_id is provided)
    const contextId = req.body?.context_id || req.query.context_id;
    const resourceType = req.body?.resource_type || req.query.resource_type || 'config';
    const action = req.validatedAction; // From actionValidationMiddleware
    
    // If context_id is provided, perform RBAC check
    if (contextId && resourceType && action) {
      const allowed = await checkPermission(userId, contextId, resourceType, action);
      if (!allowed) {
        console.error(`[Auth] RBAC check failed for user ${userId} on ${resourceType}:${action} in context ${contextId}`);
        return res.status(403).json({ error: 'Permission denied' });
      }
    }

    // 5. Feature flag check (if requested)
    const flagName = req.query.flag || req.headers['x-feature-flag'];
    if (flagName) {
      const enabled = await canUseFeature(userClientId, flagName);
      if (!enabled) {
        console.error(`[Auth] Feature flag disabled: ${flagName} for client ${userClientId}`);
        return res.status(402).json({ error: 'Feature not enabled' });
      }
    }

    // All checks passed - attach user info and continue
    req.user = { id: userId, client_id: userClientId };
    console.log('[Auth] All checks passed, proceeding to route handler');
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}