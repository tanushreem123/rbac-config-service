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
psql -h localhost -U tanushreemiskin -d rbac_db -f db/seeds/user_seeds.sql

# Verify users were created
psql -h localhost -U tanushreemiskin -d rbac_db -c "SELECT email, name, is_active FROM users WHERE email IN ('john.doe@gmail.com', 'admin@test.com');"

echo "Setup complete! Database schema and test users created."