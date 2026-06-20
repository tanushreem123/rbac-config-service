import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

export async function platformAdminAuth(req, res, next) {
  // Accept cookie (production) or Bearer header (dev tools)
  let token = req.cookies?.sa_token;
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

  if (decoded.type !== 'platform_admin') {
    return res.status(403).json({ error: 'Platform admin access required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, name FROM platform_admins WHERE id = $1 AND is_active = true',
      [decoded.admin_id]
    );
    if (result.rowCount === 0) {
      return res.status(403).json({ error: 'Admin not found or inactive' });
    }
    req.platformAdmin = result.rows[0];
    next();
  } catch (err) {
    console.error('platformAdminAuth error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
