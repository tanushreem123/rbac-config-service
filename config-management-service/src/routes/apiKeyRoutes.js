import express from 'express';
import crypto from 'crypto';
import { pool } from '../db.js';
import { userAuth } from '../middleware/userAuth.js';
import { requirePermission } from '../middleware/requirePermission.js';

const router = express.Router();

// GET /api-keys — list this client's API keys (names + prefixes, never the real key)
router.get('/', userAuth, requirePermission('config', 'read'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT k.id, k.name, k.key_prefix, k.created_at, k.last_used_at, k.revoked_at,
              u.email AS created_by_email
       FROM client_api_keys k
       LEFT JOIN users u ON u.id = k.created_by
       WHERE k.client_id = $1
       ORDER BY k.created_at DESC`,
      [req.user.client_id]
    );
    res.json({ keys: result.rows });
  } catch (err) {
    console.error('List API keys error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api-keys — generate a new API key (returned once, never stored in plain text)
router.post('/', userAuth, requirePermission('config', 'write'), async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

  const rawKey = 'cms_' + crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.slice(0, 12) + '...';

  try {
    const result = await pool.query(
      `INSERT INTO client_api_keys (client_id, name, key_hash, key_prefix, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, key_prefix, created_at`,
      [req.user.client_id, name.trim(), keyHash, keyPrefix, req.user.id]
    );
    res.status(201).json({ key: result.rows[0], secret: rawKey });
  } catch (err) {
    console.error('Create API key error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api-keys/:id — revoke a key
router.delete('/:id', userAuth, requirePermission('config', 'write'), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE client_api_keys SET revoked_at = NOW()
       WHERE id = $1 AND client_id = $2 AND revoked_at IS NULL
       RETURNING id, name`,
      [req.params.id, req.user.client_id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Key not found or already revoked' });
    res.json({ message: 'API key revoked', key: result.rows[0] });
  } catch (err) {
    console.error('Revoke API key error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
