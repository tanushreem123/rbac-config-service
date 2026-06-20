import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { checkPermission } from '../services/rbacService.js';
import { canUseFeature } from '../services/featureFlagService.js';

export async function authMiddleware(req, res, next) {
  try {
    // Accept token from httpOnly cookie (production) or Bearer header (dev tools)
    let token = req.cookies?.access_token;
    if (!token) {
      const authHeader = req.headers['authorization'];
      if (authHeader?.startsWith('Bearer ')) token = authHeader.slice(7);
    }
    if (!token) return res.status(401).json({ error: 'Missing or invalid token' });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = decoded.user_id;
    if (!userId) return res.status(401).json({ error: 'Invalid token' });

    const userResult = await pool.query(
      'SELECT client_id, is_active FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];
    if (!user || !user.is_active) {
      return res.status(403).json({ error: 'User not found or inactive' });
    }

    if (!req.clientId) return res.status(400).json({ error: 'Missing client_id in request' });
    if (user.client_id !== req.clientId) return res.status(403).json({ error: 'Cross-client access denied' });

    const contextId = req.headers['x-context-id'] || req.body?.context_id || req.query.context_id;
    if (!contextId) return res.status(400).json({ error: 'context_id is required' });

    const resourceType = req.body?.resource_type || req.query.resource_type || 'config';
    const allowed = await checkPermission(userId, contextId, resourceType, req.validatedAction);
    if (!allowed) return res.status(403).json({ error: 'Permission denied' });

    const flagName = req.query.flag || req.headers['x-feature-flag'];
    if (flagName) {
      const enabled = await canUseFeature(user.client_id, flagName);
      if (!enabled) return res.status(402).json({ error: 'Feature not enabled' });
    }

    req.user = { id: userId, client_id: user.client_id };
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
