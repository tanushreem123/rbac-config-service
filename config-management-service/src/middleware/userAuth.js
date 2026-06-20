import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

/**
 * Lightweight JWT auth for RBAC management routes (roles, permissions, users).
 * Validates the token, confirms the user is active, and sets req.user.
 * Does NOT run a full RBAC permission check — route handlers enforce
 * client_id isolation themselves.
 */
export async function userAuth(req, res, next) {
  let token = req.cookies?.access_token;
  if (!token) {
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) token = authHeader.slice(7);
  }
  if (!token) return res.status(401).json({ error: 'Missing or invalid token' });
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const userId = decoded.user_id;
  if (!userId) return res.status(401).json({ error: 'Invalid token' });

  try {
    const result = await pool.query(
      'SELECT id, client_id FROM users WHERE id = $1 AND is_active = true',
      [userId]
    );
    if (result.rowCount === 0) {
      return res.status(403).json({ error: 'User not found or inactive' });
    }
    req.user = result.rows[0];
    next();
  } catch (err) {
    console.error('userAuth error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
