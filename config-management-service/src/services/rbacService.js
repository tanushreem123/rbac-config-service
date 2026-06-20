import { pool } from '../db.js';

export async function checkPermission(userId, contextId, resourceType, action) {
  if (!resourceType || !action) return false;
  if (resourceType.includes(':') || action.includes(':')) return false;
  if (!contextId) return false;
  if (!['read', 'write', 'delete'].includes(action.toLowerCase())) return false;

  const clientId = await getUserClientId(userId);
  if (!clientId) return false;

  // Security: the requested context must belong to the user's client
  const contextValid = await verifyContextBelongsToClient(contextId, clientId);
  if (!contextValid) return false;

  // Permission lookup is client-wide — a user's role may be assigned in any
  // context within their client, regardless of which context they're querying
  const cacheKey = `${userId}:${clientId}:all`;
  let permissions = await getFromL1Cache(cacheKey);
  if (!permissions) {
    permissions = await fetchClientPermissionsFromDB(userId, clientId);
    if (permissions) await setToL1Cache(cacheKey, permissions, 60);
  }

  if (!permissions) return false;
  return permissions.includes(`${resourceType}:${action}`);
}

async function resolvePermissionsFromCache(userId, contextId, clientId) {
  const cached = await getFromL1Cache(`${userId}:${contextId}`);
  if (cached) return cached;

  const perms = await fetchPermissionsFromDB(userId, contextId, clientId);
  if (perms) await setToL1Cache(`${userId}:${contextId}`, perms, 60);
  return perms;
}

async function fetchClientPermissionsFromDB(userId, clientId) {
  try {
    const result = await pool.query(
      `SELECT DISTINCT p.resource, p.action
       FROM user_role_assignments ura
       JOIN role_permissions rp ON rp.role_id = ura.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE ura.user_id = $1 AND ura.client_id = $2`,
      [userId, clientId]
    );
    if (result.rowCount === 0) return null;
    return result.rows.map(r => `${r.resource}:${r.action}`);
  } catch (err) {
    console.error('DB error fetching client permissions:', err);
    return null;
  }
}

async function fetchPermissionsFromDB(userId, contextId, clientId) {
  let roleResult;
  try {
    roleResult = await pool.query(
      `SELECT DISTINCT ura.role_id
       FROM user_role_assignments ura
       WHERE ura.user_id = $1 AND ura.context_id = $2 AND ura.client_id = $3`,
      [userId, contextId, clientId]
    );
  } catch (err) {
    console.error('DB error fetching role IDs:', err);
    return null;
  }

  if (roleResult.rowCount === 0) return null;

  const roleIds = roleResult.rows.map(r => r.role_id);
  const permissions = [];

  try {
    const permsResult = await pool.query(
      `SELECT rp.role_id, p.resource, p.action
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = ANY($1::uuid[])`,
      [roleIds]
    );

    const roleMap = new Map();
    for (const row of permsResult.rows) {
      const permStr = `${row.resource}:${row.action}`;
      if (!roleMap.has(row.role_id)) roleMap.set(row.role_id, []);
      roleMap.get(row.role_id).push(permStr);
    }

    for (const roleId of roleIds) {
      const rolePerms = roleMap.get(roleId) || [];
      await setToL2Cache(roleId, rolePerms);
      permissions.push(...rolePerms);
    }
  } catch (err) {
    console.error('DB error fetching role permissions:', err);
    return null;
  }

  return permissions.length ? permissions : null;
}

export async function getClientContextByClientId(clientId) {
  const result = await pool.query(
    `SELECT id FROM contexts WHERE client_id = $1 AND type = 'client' LIMIT 1`,
    [clientId]
  );
  return result.rowCount ? result.rows[0] : null;
}

async function verifyContextBelongsToClient(contextId, clientId) {
  const result = await pool.query(
    `SELECT 1 FROM contexts WHERE id = $1 AND client_id = $2`,
    [contextId, clientId]
  );
  return result.rowCount > 0;
}

async function getUserClientId(userId) {
  const result = await pool.query(
    `SELECT client_id FROM users WHERE id = $1 AND is_active = true`,
    [userId]
  );
  return result.rows[0]?.client_id || null;
}

/* -------------------------------------------------------------
   IN-MEMORY TTL CACHE (swap for Redis in production)
------------------------------------------------------------- */
const _store = new Map();

function _get(key) {
  const e = _store.get(key);
  if (!e) return null;
  if (Date.now() > e.exp) { _store.delete(key); return null; }
  return e.val;
}

function _set(key, val, ttlSeconds) {
  _store.set(key, { val, exp: Date.now() + ttlSeconds * 1000 });
}

export function invalidateUserCache(userId) {
  for (const key of _store.keys()) {
    if (key.startsWith(`${userId}:`)) _store.delete(key);
  }
}

export function invalidateClientCache(clientId) {
  for (const key of _store.keys()) {
    if (key.endsWith(`:${clientId}:all`)) _store.delete(key);
  }
}

async function getFromL1Cache(key) { return _get(key); }
async function setToL1Cache(key, value, ttlSeconds) { _set(key, value, ttlSeconds); }
async function getFromL2Cache(roleId) { return _get(`role:${roleId}`); }
async function setToL2Cache(roleId, value) { _set(`role:${roleId}`, value, 300); }
