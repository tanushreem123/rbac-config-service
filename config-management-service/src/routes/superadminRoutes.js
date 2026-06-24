import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { pool } from '../db.js';
import { platformAdminAuth } from '../middleware/platformAdminAuth.js';
import { sendVerificationEmail } from '../services/emailService.js';

const router = express.Router();

const isProd = process.env.NODE_ENV === 'production';
const SA_COOKIE = { httpOnly: true, secure: isProd, sameSite: isProd ? 'strict' : 'lax' };

const saLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' }
});

// POST /superadmin/login
router.post('/login', saLoginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, password, name, is_active FROM platform_admins WHERE email = $1',
      [email]
    );
    const admin = result.rows[0];
    if (!admin || !admin.is_active) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const access_token = jwt.sign(
      { type: 'platform_admin', admin_id: admin.id, email },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.cookie('sa_token', access_token, { ...SA_COOKIE, maxAge: 8 * 60 * 60 * 1000 });
    res.json({ admin: { id: admin.id, email, name: admin.name } });
  } catch (err) {
    console.error('Superadmin login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /superadmin/logout
router.post('/logout', (req, res) => {
  res.clearCookie('sa_token', SA_COOKIE);
  res.json({ message: 'Logged out' });
});

// GET /superadmin/clients — list all clients
router.get('/clients', platformAdminAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.name, c.domain, c.description, c.created_at,
              COUNT(DISTINCT u.id) AS user_count,
              COUNT(DISTINCT cr.id) AS role_count
       FROM clients c
       LEFT JOIN users u ON u.client_id = c.id
       LEFT JOIN client_roles cr ON cr.client_id = c.id
       GROUP BY c.id
       ORDER BY c.created_at DESC`
    );
    res.json({ clients: result.rows });
  } catch (err) {
    console.error('List clients error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /superadmin/clients — create a new client
router.post('/clients', platformAdminAuth, async (req, res) => {
  const { name, domain, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const result = await pool.query(
      `INSERT INTO clients (name, domain, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, domain, description, created_at`,
      [name, domain || null, description || null]
    );
    res.status(201).json({ client: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Domain already in use' });
    console.error('Create client error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /superadmin/clients/:id — update client name, domain, description
router.put('/clients/:id', platformAdminAuth, async (req, res) => {
  const { id } = req.params;
  const { name, domain, description } = req.body;

  try {
    const result = await pool.query(
      `UPDATE clients SET
         name = COALESCE($1, name),
         domain = COALESCE($2, domain),
         description = COALESCE($3, description)
       WHERE id = $4
       RETURNING id, name, domain, description`,
      [name || null, domain || null, description || null, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Client not found' });
    res.json({ client: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Domain already in use by another client' });
    console.error('Update client error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /superadmin/clients/:id/users
router.get('/clients/:id/users', platformAdminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.is_active, u.is_email_verified, u.created_at,
              COALESCE(json_agg(cr.name) FILTER (WHERE cr.id IS NOT NULL), '[]') AS roles
       FROM users u
       LEFT JOIN user_role_assignments ura ON ura.user_id = u.id
       LEFT JOIN client_roles cr ON cr.id = ura.role_id
       WHERE u.client_id = $1
       GROUP BY u.id
       ORDER BY u.created_at DESC`,
      [id]
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error('Get client users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /superadmin/clients/:id/roles
router.get('/clients/:id/roles', platformAdminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, name, is_default, is_system FROM client_roles WHERE client_id = $1 ORDER BY name`,
      [id]
    );
    res.json({ roles: result.rows });
  } catch (err) {
    console.error('Get client roles error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /superadmin/admins — list all platform admins
router.get('/admins', platformAdminAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, is_active, created_at FROM platform_admins ORDER BY created_at ASC'
    );
    res.json({ admins: result.rows });
  } catch (err) {
    console.error('List admins error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /superadmin/admins — create a new platform admin
router.post('/admins', platformAdminAuth, async (req, res) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json({ error: 'email, name, and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const existing = await pool.query('SELECT id FROM platform_admins WHERE email = $1', [email]);
    if (existing.rowCount > 0) return res.status(409).json({ error: 'Admin with this email already exists' });

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO platform_admins (email, password, name, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id, email, name, created_at`,
      [email, hash, name]
    );
    res.status(201).json({ admin: result.rows[0] });
  } catch (err) {
    console.error('Create admin error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /superadmin/permissions — list all global permissions
router.get('/permissions', platformAdminAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, service, resource, action, description FROM permissions ORDER BY service, resource, action'
    );
    res.json({ permissions: result.rows });
  } catch (err) {
    console.error('SA list permissions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /superadmin/clients/:id/roles — create a role for a client
router.post('/clients/:id/roles', platformAdminAuth, async (req, res) => {
  const { id: client_id } = req.params;
  const { name, is_default = false } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    if (is_default) {
      await pool.query('UPDATE client_roles SET is_default = false WHERE client_id = $1', [client_id]);
    }
    const result = await pool.query(
      `INSERT INTO client_roles (client_id, name, is_default)
       VALUES ($1, $2, $3) RETURNING id, name, is_default`,
      [client_id, name, is_default]
    );
    res.status(201).json({ role: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Role already exists for this client' });
    console.error('SA create role error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /superadmin/clients/:id/roles/:roleId/permissions
router.get('/clients/:id/roles/:roleId/permissions', platformAdminAuth, async (req, res) => {
  const { roleId } = req.params;
  try {
    const result = await pool.query(
      `SELECT p.id, p.service, p.resource, p.action, p.description
       FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = $1 ORDER BY p.service, p.resource, p.action`,
      [roleId]
    );
    res.json({ permissions: result.rows });
  } catch (err) {
    console.error('SA role permissions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /superadmin/clients/:id/roles/:roleId/permissions
router.post('/clients/:id/roles/:roleId/permissions', platformAdminAuth, async (req, res) => {
  const { roleId } = req.params;
  const { permission_id } = req.body;
  if (!permission_id) return res.status(400).json({ error: 'permission_id is required' });
  try {
    await pool.query(
      'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [roleId, permission_id]
    );
    res.status(201).json({ message: 'Permission added' });
  } catch (err) {
    console.error('SA add perm error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /superadmin/clients/:id/roles/:roleId/permissions/:permId
router.delete('/clients/:id/roles/:roleId/permissions/:permId', platformAdminAuth, async (req, res) => {
  const { roleId, permId } = req.params;
  try {
    await pool.query('DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2', [roleId, permId]);
    res.json({ message: 'Permission removed' });
  } catch (err) {
    console.error('SA remove perm error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /superadmin/clients/:id/users — create onboarding user (auto-verified)
router.post('/clients/:id/users', platformAdminAuth, async (req, res) => {
  const { id: client_id } = req.params;
  const { email, name, password, role_id } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json({ error: 'email, name, and password are required' });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE client_id = $1 AND email = $2',
      [client_id, email]
    );
    if (existing.rowCount > 0) return res.status(409).json({ error: 'User already exists for this client' });

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const result = await pool.query(
      `INSERT INTO users (client_id, email, password, name, is_active, is_email_verified,
                          email_verification_token, email_verification_expires_at)
       VALUES ($1, $2, $3, $4, true, false, $5, $6) RETURNING id, email, name`,
      [client_id, email, passwordHash, name, verificationToken, verificationExpiry]
    );
    const user = result.rows[0];

    if (role_id) {
      let ctx = await pool.query(
        "SELECT id FROM contexts WHERE client_id = $1 AND type = 'client' LIMIT 1",
        [client_id]
      );
      if (ctx.rowCount === 0) {
        ctx = await pool.query(
          "INSERT INTO contexts (client_id, type, name) VALUES ($1, 'client', 'Root') RETURNING id",
          [client_id]
        );
      }
      await pool.query(
        'INSERT INTO user_role_assignments (user_id, client_id, context_id, role_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [user.id, client_id, ctx.rows[0].id, role_id]
      );
    }

    // Send the verification email. Best-effort: the user is created either way;
    // if SMTP fails the admin can trigger a resend. (Login is blocked until verified.)
    let emailSent = true;
    try {
      await sendVerificationEmail(user.email, user.name, verificationToken);
    } catch (mailErr) {
      emailSent = false;
      console.error('Verification email failed (user still created, can resend):', mailErr.message);
    }

    res.status(201).json({ user, email_verification_required: true, email_sent: emailSent });
  } catch (err) {
    console.error('SA create user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: resolve client_id from domain — called by frontend on load
router.get('/client-by-domain', async (req, res) => {
  const { domain } = req.query;
  if (!domain) return res.status(400).json({ error: 'domain is required' });

  try {
    const result = await pool.query(
      'SELECT id, name, domain FROM clients WHERE domain = $1 AND domain IS NOT NULL',
      [domain]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'No client found for this domain' });
    }
    res.json({ client: result.rows[0] });
  } catch (err) {
    console.error('Client by domain error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
