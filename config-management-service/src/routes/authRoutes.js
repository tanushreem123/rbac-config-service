import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { pool } from '../db.js';
import { sendVerificationEmail } from '../services/emailService.js';
import { userAuth } from '../middleware/userAuth.js';
import { requirePermission } from '../middleware/requirePermission.js';

const router = express.Router();

const isProd = process.env.NODE_ENV === 'production';

const COOKIE_BASE = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'strict' : 'lax',
};

function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie('access_token', accessToken, { ...COOKIE_BASE, maxAge: 60 * 60 * 1000 });
  res.cookie('refresh_token', refreshToken, {
    ...COOKIE_BASE,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/auth/refresh',
  });
}

function clearAuthCookies(res) {
  res.clearCookie('access_token', COOKIE_BASE);
  res.clearCookie('refresh_token', { ...COOKIE_BASE, path: '/auth/refresh' });
}

async function createRefreshToken(userId) {
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  );
  return token;
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
});

// POST /auth/login
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  try {
    const result = await pool.query(
      'SELECT id, client_id, password, name, is_active, is_email_verified FROM users WHERE email = $1',
      [email]
    );
    const user = result.rows[0];
    if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.is_email_verified) return res.status(403).json({ error: 'Please verify your email before logging in' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const access_token = jwt.sign({ user_id: user.id, client_id: user.client_id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const refresh_token = await createRefreshToken(user.id);

    // Resolve the user's own client context so the frontend uses the correct context_id
    const ctxResult = await pool.query(
      "SELECT id FROM contexts WHERE client_id = $1 ORDER BY type = 'client' DESC, created_at ASC LIMIT 1",
      [user.client_id]
    );
    const context_id = ctxResult.rows[0]?.id || null;

    setAuthCookies(res, access_token, refresh_token);
    res.json({ user: { id: user.id, email, name: user.name, client_id: user.client_id, context_id } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/register
router.post('/register', authLimiter, async (req, res) => {
  const { email, password, name, client_id } = req.body;
  if (!email || !password || !name || !client_id) {
    return res.status(400).json({ error: 'Email, password, name, and client_id are required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });

  if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters with uppercase, lowercase, and a number' });
  }

  try {
    const clientResult = await pool.query('SELECT id FROM clients WHERE id = $1', [client_id]);
    if (clientResult.rowCount === 0) return res.status(400).json({ error: 'Invalid client_id' });

    const existing = await pool.query('SELECT id FROM users WHERE client_id = $1 AND email = $2', [client_id, email]);
    if (existing.rowCount > 0) return res.status(409).json({ error: 'User already exists for this client' });

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const insertResult = await pool.query(
      `INSERT INTO users (client_id, email, password, name, is_active, is_email_verified, email_verification_token, email_verification_expires_at)
       VALUES ($1, $2, $3, $4, true, false, $5, $6)
       RETURNING id, client_id, email, name, is_active, is_email_verified`,
      [client_id, email, passwordHash, name, verificationToken, verificationExpiry]
    );
    const newUser = insertResult.rows[0];

    await sendVerificationEmail(newUser.email, newUser.name, verificationToken);

    // Auto-assign default role
    const defaultRole = await pool.query(
      'SELECT id FROM client_roles WHERE client_id = $1 AND is_default = true LIMIT 1',
      [client_id]
    );
    if (defaultRole.rowCount > 0) {
      let ctx = await pool.query("SELECT id FROM contexts WHERE client_id = $1 AND type = 'client' LIMIT 1", [client_id]);
      if (ctx.rowCount === 0) {
        ctx = await pool.query("INSERT INTO contexts (client_id, type, name) VALUES ($1, 'client', 'Root') RETURNING id", [client_id]);
      }
      await pool.query(
        'INSERT INTO user_role_assignments (user_id, client_id, context_id, role_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [newUser.id, client_id, ctx.rows[0].id, defaultRole.rows[0].id]
      );
    }

    res.status(201).json({
      message: 'Account created. Please verify your email before logging in.',
      user: { id: newUser.id, email: newUser.email, name: newUser.name }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/refresh — reads refresh_token from cookie, issues new cookies
router.post('/refresh', async (req, res) => {
  const refresh_token = req.cookies?.refresh_token || req.body?.refresh_token;
  if (!refresh_token) return res.status(400).json({ error: 'No refresh token' });

  try {
    const result = await pool.query(
      `SELECT rt.id, rt.user_id, rt.expires_at, u.client_id, u.is_active, u.is_email_verified
       FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
       WHERE rt.token = $1 AND rt.revoked_at IS NULL`,
      [refresh_token]
    );
    const record = result.rows[0];
    if (!record) return res.status(401).json({ error: 'Invalid or revoked refresh token' });
    if (new Date() > new Date(record.expires_at)) return res.status(401).json({ error: 'Refresh token expired' });
    if (!record.is_active || !record.is_email_verified) return res.status(403).json({ error: 'Account inactive or unverified' });

    await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [record.id]);
    const new_refresh_token = await createRefreshToken(record.user_id);
    const access_token = jwt.sign(
      { user_id: record.user_id, client_id: record.client_id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    setAuthCookies(res, access_token, new_refresh_token);
    res.json({ ok: true });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/logout
router.post('/logout', async (req, res) => {
  const refresh_token = req.cookies?.refresh_token || req.body?.refresh_token;
  if (refresh_token) {
    try {
      await pool.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = $1 AND revoked_at IS NULL',
        [refresh_token]
      );
    } catch {}
  }
  clearAuthCookies(res);
  res.json({ message: 'Logged out successfully' });
});

// GET /auth/me/permissions — returns the current user's effective permissions
router.get('/me/permissions', userAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT p.resource, p.action
       FROM user_role_assignments ura
       JOIN role_permissions rp ON rp.role_id = ura.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE ura.user_id = $1 AND ura.client_id = $2`,
      [req.user.id, req.user.client_id]
    );
    const permissions = result.rows.map(r => `${r.resource}:${r.action}`);
    res.json({ permissions });
  } catch (err) {
    console.error('Me permissions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /auth/me — lightweight session check
router.get('/me', userAuth, async (req, res) => {
  const result = await pool.query('SELECT id, email, name, client_id FROM users WHERE id = $1', [req.user.id]);
  const user = result.rows[0];
  if (user) {
    const ctxResult = await pool.query(
      "SELECT id FROM contexts WHERE client_id = $1 ORDER BY type = 'client' DESC, created_at ASC LIMIT 1",
      [user.client_id]
    );
    user.context_id = ctxResult.rows[0]?.id || null;
  }
  res.json({ user });
});

// GET /auth/users
router.get('/users', userAuth, requirePermission('users', 'read'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.client_id, u.email, u.name, u.is_active, u.is_email_verified, u.created_at, u.last_login,
              COALESCE(json_agg(cr.name) FILTER (WHERE cr.id IS NOT NULL), '[]') AS roles
       FROM users u
       LEFT JOIN user_role_assignments ura ON ura.user_id = u.id
       LEFT JOIN client_roles cr ON cr.id = ura.role_id
       WHERE u.client_id = $1
       GROUP BY u.id ORDER BY u.created_at DESC`,
      [req.user.client_id]
    );
    res.json({ users: result.rows, total: result.rowCount });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/users — admin creates a user; auto-verified only if assigned role has skip_email_verification=true
router.post('/users', userAuth, requirePermission('users', 'write'), async (req, res) => {
  const { email, name, password, role_id } = req.body;
  const client_id = req.user.client_id;

  if (!email || !name || !password) {
    return res.status(400).json({ error: 'email, name, and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE client_id = $1 AND email = $2',
      [client_id, email]
    );
    if (existing.rowCount > 0) return res.status(409).json({ error: 'User with this email already exists' });

    // Check if assigned role allows skipping verification
    let skipVerification = false;
    if (role_id) {
      const roleResult = await pool.query(
        'SELECT skip_email_verification FROM client_roles WHERE id = $1 AND client_id = $2',
        [role_id, client_id]
      );
      skipVerification = roleResult.rows[0]?.skip_email_verification ?? false;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    let verificationToken = null;
    let verificationExpiry = null;
    if (!skipVerification) {
      verificationToken = crypto.randomBytes(32).toString('hex');
      verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    const result = await pool.query(
      `INSERT INTO users (client_id, email, password, name, is_active, is_email_verified,
                          email_verification_token, email_verification_expires_at)
       VALUES ($1, $2, $3, $4, true, $5, $6, $7)
       RETURNING id, email, name, is_active, is_email_verified`,
      [client_id, email, passwordHash, name, skipVerification, verificationToken, verificationExpiry]
    );
    const user = result.rows[0];

    if (!skipVerification) {
      await sendVerificationEmail(email, name, verificationToken);
    }

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

    res.status(201).json({
      user,
      email_verification_required: !skipVerification,
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// DELETE /auth/users/:id
router.delete('/users/:id', userAuth, requirePermission('users', 'delete'), async (req, res) => {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) return res.status(400).json({ error: 'Invalid user ID format' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Confirm user belongs to this client before deleting
    const check = await client.query(
      'SELECT id, email, name FROM users WHERE id = $1 AND client_id = $2',
      [id, req.user.client_id]
    );
    if (check.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove child records that reference this user
    await client.query('DELETE FROM user_role_assignments WHERE user_id = $1', [id]);
    await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [id]);
    await client.query('DELETE FROM users WHERE id = $1', [id]);

    await client.query('COMMIT');
    res.json({ message: 'User deleted', user: check.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /auth/resend-verification
router.post('/resend-verification', authLimiter, async (req, res) => {
  const { email, client_id } = req.body;
  if (!email || !client_id) return res.status(400).json({ error: 'email and client_id are required' });

  try {
    const result = await pool.query(
      'SELECT id, name, is_email_verified FROM users WHERE email = $1 AND client_id = $2',
      [email, client_id]
    );
    // Always respond 200 to avoid leaking whether the email exists
    const user = result.rows[0];
    if (!user || user.is_email_verified) {
      return res.json({ message: 'If that email exists and is unverified, a new link has been sent.' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.query(
      'UPDATE users SET email_verification_token = $1, email_verification_expires_at = $2 WHERE id = $3',
      [verificationToken, verificationExpiry, user.id]
    );
    await sendVerificationEmail(email, user.name, verificationToken);
    res.json({ message: 'If that email exists and is unverified, a new link has been sent.' });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /auth/verify?token=
router.get('/verify', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Verification token is required' });

  try {
    const result = await pool.query(
      `SELECT id, email_verification_expires_at FROM users WHERE email_verification_token = $1 AND is_email_verified = false`,
      [token]
    );
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: 'Invalid or already used verification token' });
    if (new Date() > new Date(user.email_verification_expires_at)) {
      return res.status(400).json({ error: 'Verification token has expired' });
    }
    await pool.query(
      'UPDATE users SET is_email_verified = true, email_verification_token = NULL, email_verification_expires_at = NULL WHERE id = $1',
      [user.id]
    );
    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
