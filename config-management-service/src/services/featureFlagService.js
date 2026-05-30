import { pool } from '../db.js';

/**
 * Check if a client can use a specific feature
 * @param {string} clientId - The client ID
 * @param {string} feature - The feature name
 * @returns {Promise<boolean>} - Whether the feature is enabled for the client
 */
export async function canUseFeature(clientId, feature) {
  try {
    const result = await pool.query(
      `SELECT 1 FROM feature_flags WHERE client_id = $1 AND flag_name = $2 AND enabled = true`,
      [clientId, feature]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking feature flag:', error);
    return false;
  }
}

/**
 * Enable a feature for a client
 * @param {string} clientId - The client ID
 * @param {string} feature - The feature name
 */
export async function enableFeature(clientId, feature) {
  try {
    await pool.query(
      `INSERT INTO feature_flags (client_id, flag_name, enabled)
       VALUES ($1, $2, true)
       ON CONFLICT (client_id, flag_name, environment) DO UPDATE SET enabled = true`,
      [clientId, feature]
    );
  } catch (error) {
    console.error('Error enabling feature:', error);
  }
}

/**
 * Disable a feature for a client
 * @param {string} clientId - The client ID
 * @param {string} feature - The feature name
 */
export async function disableFeature(clientId, feature) {
  try {
    await pool.query(
      `UPDATE feature_flags SET enabled = false WHERE client_id = $1 AND flag_name = $2`,
      [clientId, feature]
    );
  } catch (error) {
    console.error('Error disabling feature:', error);
  }
}
