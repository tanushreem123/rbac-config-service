#!/usr/bin/env node
/**
 * Usage:
 *   node scripts/create_superadmin.js <email> <name> <password>
 *
 * Example:
 *   node scripts/create_superadmin.js admin@example.com "Alice" "SecurePass1!"
 *
 * Requires DATABASE_URL in environment (same as the service).
 * Load from .env by prefixing: dotenv -e .env -- node scripts/create_superadmin.js ...
 * Or: node --env-file=.env scripts/create_superadmin.js ...
 */

import bcrypt from 'bcrypt';
import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// Load .env manually if DATABASE_URL is not set
if (!process.env.DATABASE_URL) {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const envPath = resolve(__dirname, '../.env');
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const [key, ...rest] = line.split('=');
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    }
  } catch {}
}

const [,, email, name, password] = process.argv;

if (!email || !name || !password) {
  console.error('Usage: node scripts/create_superadmin.js <email> <name> <password>');
  process.exit(1);
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  console.error('Invalid email format');
  process.exit(1);
}

if (password.length < 8) {
  console.error('Password must be at least 8 characters');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const existing = await pool.query('SELECT id FROM platform_admins WHERE email = $1', [email]);
  if (existing.rowCount > 0) {
    console.error(`Superadmin with email "${email}" already exists`);
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `INSERT INTO platform_admins (email, password, name, is_active)
     VALUES ($1, $2, $3, true)
     RETURNING id, email, name, created_at`,
    [email, hash, name]
  );

  const admin = result.rows[0];
  console.log('\nSuperadmin created successfully:');
  console.log(`  ID:      ${admin.id}`);
  console.log(`  Email:   ${admin.email}`);
  console.log(`  Name:    ${admin.name}`);
  console.log(`  Created: ${admin.created_at}`);
  console.log('\nYou can now log in at /superadmin/login\n');
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
} finally {
  await pool.end();
}
