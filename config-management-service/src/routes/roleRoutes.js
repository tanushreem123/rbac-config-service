import express from 'express';
import { pool } from '../db.js';
import { userAuth } from '../middleware/userAuth.js';
import { requirePermission } from '../middleware/requirePermission.js';

const router = express.Router();

// POST /roles — create a role for a client
router.post('/', userAuth, requirePermission('roles', 'write'), async (req, res) => {
  const { name, is_default = false, skip_email_verification = false, parent_role_id = null } = req.body;
  const client_id = req.user.client_id;

  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    if (is_default) {
      await pool.query('UPDATE client_roles SET is_default = false WHERE client_id = $1', [client_id]);
    }
    const result = await pool.query(
      `INSERT INTO client_roles (client_id, name, is_default, skip_email_verification, parent_role_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, client_id, name, is_system, is_default, skip_email_verification, parent_role_id`,
      [client_id, name, is_default, skip_email_verification, parent_role_id]
    );
    res.status(201).json({ role: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Role with this name already exists for client' });
    console.error('Create role error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /roles — list roles for a client
router.get('/', userAuth, requirePermission('roles', 'read'), async (req, res) => {
  const client_id = req.user.client_id;
  try {
    const result = await pool.query(
      `SELECT id, name, is_system, is_default, skip_email_verification, parent_role_id
       FROM client_roles WHERE client_id = $1 ORDER BY is_default DESC, name ASC`,
      [client_id]
    );
    res.json({ roles: result.rows, total: result.rowCount });
  } catch (err) {
    console.error('List roles error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /roles/:id — update role settings (skip_email_verification, is_default)
router.patch('/:id', userAuth, requirePermission('roles', 'write'), async (req, res) => {
  const { id } = req.params;
  const { skip_email_verification, is_default } = req.body;
  const client_id = req.user.client_id;

  try {
    if (is_default) {
      await pool.query('UPDATE client_roles SET is_default = false WHERE client_id = $1', [client_id]);
    }
    const fields = [];
    const values = [];
    let idx = 1;
    if (skip_email_verification !== undefined) { fields.push(`skip_email_verification = $${idx++}`); values.push(skip_email_verification); }
    if (is_default !== undefined)              { fields.push(`is_default = $${idx++}`);              values.push(is_default); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(id, client_id);
    const result = await pool.query(
      `UPDATE client_roles SET ${fields.join(', ')}
       WHERE id = $${idx} AND client_id = $${idx + 1}
       RETURNING id, name, is_default, skip_email_verification`,
      values
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Role not found' });
    res.json({ role: result.rows[0] });
  } catch (err) {
    console.error('Update role error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /roles/assign — assign a role to a user
router.post('/assign', userAuth, requirePermission('roles', 'write'), async (req, res) => {
  const { user_id, context_id, role_id } = req.body;
  const client_id = req.user.client_id;

  if (!user_id || !context_id || !role_id) {
    return res.status(400).json({ error: 'user_id, context_id, and role_id are required' });
  }

  try {
    await pool.query(
      `INSERT INTO user_role_assignments (user_id, client_id, context_id, role_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [user_id, client_id, context_id, role_id]
    );
    res.status(201).json({ message: 'Role assigned successfully' });
  } catch (err) {
    console.error('Assign role error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /roles/:id/permissions — list permissions on a role
router.get('/:id/permissions', userAuth, requirePermission('roles', 'read'), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT p.id, p.service, p.resource, p.action, p.description
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = $1
       ORDER BY p.service, p.resource, p.action`,
      [id]
    );
    res.json({ permissions: result.rows, total: result.rowCount });
  } catch (err) {
    console.error('List role permissions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /roles/:id/permissions — add a permission to a role
router.post('/:id/permissions', userAuth, requirePermission('roles', 'write'), async (req, res) => {
  const { id } = req.params;
  const { permission_id } = req.body;

  if (!permission_id) {
    return res.status(400).json({ error: 'permission_id is required' });
  }

  try {
    await pool.query(
      `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [id, permission_id]
    );
    res.status(201).json({ message: 'Permission added to role' });
  } catch (err) {
    console.error('Add permission error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /roles/:id/permissions/:permissionId — remove a permission from a role
router.delete('/:id/permissions/:permissionId', userAuth, requirePermission('roles', 'delete'), async (req, res) => {
  const { id, permissionId } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2',
      [id, permissionId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Permission not found on this role' });
    }
    res.json({ message: 'Permission removed from role' });
  } catch (err) {
    console.error('Remove permission error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
