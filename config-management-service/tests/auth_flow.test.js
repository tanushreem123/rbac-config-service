// Test script for auth flow verification
// Run with: node tests/auth_flow.test.js

import '../src/config.js';
import { pool } from '../src/db.js';
import jwt from 'jsonwebtoken';
import { checkPermission } from '../src/services/rbacService.js';
import { canUseFeature } from '../src/services/featureFlagService.js';

const TEST_CLIENT_ID = 'c946e5dc-efff-405f-a3fb-e68f0ce7ab39';
let TEST_USER_ID = 'test-user-id'; // Will be set from DB
let TEST_CONTEXT_ID = null;
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-token-here';

async function runTests() {
  console.log('=== Starting Auth Flow Tests ===\n');

  // Test 1: Verify test users exist
  console.log('Test 1: Verify test users');
  const users = await pool.query(
    'SELECT id, email, client_id FROM users WHERE client_id = $1',
    [TEST_CLIENT_ID]
  );
  console.log('Users found:', users.rowCount);
  if (users.rowCount > 0) {
    console.log('User:', users.rows[0].email, 'with ID:', users.rows[0].id);
    TEST_USER_ID = users.rows[0].id;
  }
  console.log('');

  // Test 2: Verify RLS policies
  console.log('Test 2: Verify RLS policies');
  const policies = await pool.query(
    "SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('configs', 'feature_flags', 'user_role_assignments')"
  );
  console.log('Policies found:', policies.rowCount);
  policies.rows.forEach(p => console.log(`  - ${p.policyname} on ${p.tablename}`));
  console.log('');

  // Test 3: Create JWT token
  console.log('Test 3: Create test JWT token');
  const token = jwt.sign(
    { user_id: TEST_USER_ID, exp: Math.floor(Date.now() / 1000) + 3600 },
    JWT_SECRET
  );
  console.log('Token created for user:', TEST_USER_ID);
  console.log('');

  // Test 4: Test feature flag check
  console.log('Test 4: Test feature flag check');
  const featureEnabled = await canUseFeature(TEST_CLIENT_ID, 'test_feature');
  console.log('Feature "test_feature" enabled for client:', featureEnabled);
  console.log('');

  // Test 5: Resolve a valid context id for this user/client
  console.log('Test 5: Resolve a valid context id');
  let contextResult = await pool.query(
    'SELECT ura.context_id FROM user_role_assignments ura WHERE ura.user_id = $1 LIMIT 1',
    [TEST_USER_ID]
  );
  if (contextResult.rowCount === 0) {
    contextResult = await pool.query(
      'SELECT id FROM contexts WHERE client_id = $1 LIMIT 1',
      [TEST_CLIENT_ID]
    );
  }
  if (contextResult.rowCount > 0) {
    TEST_CONTEXT_ID = contextResult.rows[0].context_id || contextResult.rows[0].id;
    console.log('Using context id:', TEST_CONTEXT_ID);
  } else {
    throw new Error('No valid context found for permission test');
  }
  console.log('');

  console.log('Test 6: Test permission check');
  const permission = await checkPermission(
    TEST_USER_ID,
    TEST_CONTEXT_ID,
    'config',
    'read'
  );
  console.log('Permission check result:', permission);
  console.log('');

  // Test 7: Enforce DB Tenancy (client isolation)
  console.log('Test 7: Enforce DB Tenancy');
  const fakeClientId = '00000000-0000-0000-0000-000000000000';
  await pool.query('SELECT set_config($1, $2, false)', ['app.current_client_id', fakeClientId]);
  const tenancyResult = await pool.query('SELECT * FROM configs LIMIT 1');
  console.log('Rows visible for fake client:', tenancyResult.rowCount);


  console.log('=== Tests Complete ===');
  await pool.end();
  process.exit(0);
}

runTests().catch(async err => {
  console.error('Test error:', err);
  await pool.end();
  process.exit(1);
});