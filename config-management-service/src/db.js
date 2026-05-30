import { Pool } from 'pg';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export { pool };

/***
 * SETUP DATABASE-LEVEL TENANT ISOLATION
 ***/
export function initTenancyProtection() {
  // Enable RLS on all client-scoped tables
  const clientScopedTables = [
    'configs',
    'feature_flags',
    'client_roles',
    'user_role_assignments',
    'contexts'
  ];

  for (const table of clientScopedTables) {
    pool.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    pool.query(`
      CREATE POLICY client_isolation ON ${table}
      FOR ALL
      USING (client_id = current_setting('app.current_client_id')::UUID`);
  }
}

/***
 * GET USER'S CLIENT ID
 ***/
export async function getUserClientId(userId) {
  const result = await pool.query(
    'SELECT client_id FROM users WHERE id = $1 AND is_active = true',
    [userId]
  );
  return result.rows[0]?.client_id || null;
}

/***
 * VERIFY CONTEXT BELONGS TO CLIENT
 ***/
export async function verifyContextBelongsToClient(contextId, clientId) {
  const result = await pool.query(
    'SELECT 1 FROM contexts WHERE id = $1 AND client_id = $2',
    [contextId, clientId]
  );
  return result.rowCount > 0;
}
