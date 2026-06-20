import express from 'express';
import { pool } from '../db.js';
import { userAuth } from '../middleware/userAuth.js';
import { platformAdminAuth } from '../middleware/platformAdminAuth.js';
import { requirePermission } from '../middleware/requirePermission.js';

const router = express.Router();

async function anyAuth(req, res, next) {
  if (req.cookies?.sa_token) return platformAdminAuth(req, res, next);
  return userAuth(req, res, next);
}

// GET /permissions — list all available permissions
router.get('/', anyAuth, requirePermission('permissions', 'read'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, service, resource, action, description FROM permissions ORDER BY service, resource, action'
    );
    res.json({ permissions: result.rows, total: result.rowCount });
  } catch (err) {
    console.error('List permissions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /permissions — create a new permission
router.post('/', anyAuth, requirePermission('permissions', 'write'), async (req, res) => {
  const { service, resource, action, description } = req.body;

  if (!service || !resource || !action) {
    return res.status(400).json({ error: 'service, resource, and action are required' });
  }

  if (!['read', 'write', 'delete'].includes(action)) {
    return res.status(400).json({ error: 'action must be one of: read, write, delete' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO permissions (service, resource, action, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, service, resource, action, description`,
      [service, resource, action, description || null]
    );
    res.status(201).json({ permission: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Permission already exists' });
    }
    console.error('Create permission error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
