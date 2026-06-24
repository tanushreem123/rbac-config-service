-- Up: Add password_hash column to users table.
-- Run before any user rows exist (NOT NULL has no default), or backfill first.
ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL;

-- Down (run manually to revert — intentionally NOT executed by this file):
-- ALTER TABLE users DROP COLUMN password_hash;
