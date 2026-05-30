import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

const router = express.Router();

// POST /login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Fetch user by email
    const result = await pool.query('SELECT id, client_id, password, is_active FROM users WHERE email = $1', [email]);
    console.log(result,"result required");
    const user = result.rows[0];
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // For demo: compare plain text (replace with bcrypt in production)
    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const payload = { user_id: user.id, client_id: user.client_id };
    const secret = process.env.JWT_SECRET || 'your-jwt-secret-key';
    const token = jwt.sign(payload, secret, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
