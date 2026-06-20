-- Up: Add password_hash column to users table
ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL;

-- Down: Drop the password_hash column
ALTER TABLE users DROP COLUMN password_hash;