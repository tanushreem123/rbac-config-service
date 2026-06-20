import { pool } from '../db.js';

/**
 * Create or update a config for a given client.
 * @param {Object} params - { key, environment, value, createdBy, clientId }
 */
export async function createOrUpdateConfig({ key, environment, value, createdBy, clientId }) {
  const result = await pool.query(
    `INSERT INTO configs (key, value, environment, created_by, client_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (client_id, key, environment)
     DO UPDATE SET
       value = EXCLUDED.value,
       active_version = configs.active_version + 1
     RETURNING *`,
    [key, value, environment, createdBy, clientId]
  );
  return result.rows[0];
}

/**
 * Get all active configs for a given environment and client.
 * @param {string} environment - e.g., 'production'
 * @param {UUID} clientId - the client's UUID
 */
export async function getAllActiveConfigs(environment, clientId) {
  const result = await pool.query(
    `SELECT key, value, environment, active_version, created_by, created_at
     FROM configs
     WHERE environment = $1 AND client_id = $2
     ORDER BY key`,
    [environment, clientId]
  );
  return result.rows;
}

/**
 * Get all versions of a specific config key for a given environment and client.
 * @param {string} key
 * @param {string} environment
 * @param {UUID} clientId
 */
export async function getConfigVersions(key, environment, clientId) {
  const result = await pool.query(
    `SELECT * FROM configs
     WHERE client_id = $1 AND key = $2 AND environment = $3
     ORDER BY active_version DESC`,
    [clientId, key, environment]
  );
  return result.rows;
}

/**
 * Rollback a config to a specific version for a given client.
 * @param {Object} params - { key, environment, targetVersion, clientId }
 */
export async function rollbackConfig({ key, environment, targetVersion, clientId }) {
  const result = await pool.query(
    `UPDATE configs
     SET active_version = $1
     WHERE client_id = $2 AND key = $3 AND environment = $4
     RETURNING *`,
    [targetVersion, clientId, key, environment]
  );
  return result.rows[0];
}