import crypto from 'crypto';
import { pool } from '../db.js';

export async function apiKeyAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer cms_')) return next();

  const rawKey = authHeader.slice(7); // strip "Bearer "
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  try {
    const result = await pool.query(
      `SELECT k.id, k.client_id
       FROM client_api_keys k
       WHERE k.key_hash = $1 AND k.revoked_at IS NULL`,
      [keyHash]
    );
    if (result.rowCount === 0) return res.status(401).json({ error: 'Invalid or revoked API key' });

    const key = result.rows[0];

    // Verify the requested clientId matches the key's client
    const clientId = req.headers['x-client-id'] || req.query?.client_id || req.body?.client_id;
    if (clientId && clientId !== key.client_id) {
      return res.status(403).json({ error: 'API key does not belong to this client' });
    }

    await pool.query('UPDATE client_api_keys SET last_used_at = NOW() WHERE id = $1', [key.id]);

    req.clientId = key.client_id;
    req.apiKeyClient = { client_id: key.client_id };
    next();
  } catch (err) {
    console.error('API key auth error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
