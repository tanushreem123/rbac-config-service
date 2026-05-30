#!/bin/bash
echo "Setting up RBAC database schema..."

# Step 1: Create tables
echo "Creating schema tables..."
psql -h localhost -U tanushreemiskin -d rbac_db -f db/schemas.sql

# Step 2: Enable RLS and create policies
echo "Enabling Row-Level Security and creating policies..."
psql -h localhost -U tanushreemiskin -d rbac_db -f db/enforce_tenancy.sql

# Step 3: Create initial test client and users for demonstration
echo "Creating initial test client and users..."
psql -h localhost -U tanushreemiskin -d rbac_db << SQL
-- Create test client (UUID will be auto-generated)
INSERT INTO clients (name, created_at)
VALUES ('Test Client', NOW());

-- Create test users with passwords
WITH test_client AS (
  SELECT id FROM clients WHERE name = 'Test Client' LIMIT 1
)
INSERT INTO users (client_id, email, password, name, is_active, is_email_verified)
SELECT 
  test_client.id,
  'john.doe@gmail.com',
  'MySecurePass@123',
  'John Doe',
  true,
  true
FROM test_client;

-- Create admin test user
WITH test_client AS (
  SELECT id FROM clients WHERE name = 'Test Client' LIMIT 1
)
INSERT INTO users (client_id, email, password, name, is_active, is_email_verified)
SELECT 
  test_client.id,
  'admin@test.com',
  'AdminPass@123',
  'Admin User',
  true,
  true
FROM test_client;

-- Verify users were created
SELECT email, name, is_active FROM users WHERE email IN ('john.doe@gmail.com', 'admin@test.com');
SQL

echo "Setup complete! Database schema and test users created."