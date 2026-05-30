import { pool } from '../db.js';

/* -------------------------------------------------------------
   PUBLIC API
------------------------------------------------------------- */
export async function checkPermission(userId, contextId, resourceType, action) {

  // ---- Input validation -------------------------------------------------
  if (!resourceType || !action) return false;                     // empty parts
  if (resourceType.includes(':') || action.includes(':')) return false;
  if (!contextId) return false;                                   // missing context
  // ---- Action validation ------------------------------------------------
  if (!['read', 'write', 'delete'].includes(action.toLowerCase())) return false;

  // ---- Get client ID (single DB round‑trip) ------------------------------
  const clientId = await getUserClientId(userId);
  if (!clientId) {
    console.error('[RBAC] User not found or inactive:', userId);
    return false; // inactive / missing user
  }
  console.log('[RBAC] Checking permission for user:', userId, 'client:', clientId, 'context:', contextId);
  
  // ---- Verify the supplied context belongs to this client ----------------
  const contextValid = await verifyContextBelongsToClient(contextId, clientId);
  if (!contextValid) {
    console.error('[RBAC] Context does not belong to client:', contextId, clientId);
    return false;
  }

  // ---- Try context‑specific permissions (L1 cache) ----------------------
  let permissions = await resolvePermissionsFromCache(userId, contextId, clientId);
  console.log('[RBAC] Permissions from cache:', permissions);

  // ---- Fallback to client‑wide (global) context -------------------------
  if (!permissions) {
    console.log('[RBAC] No context-specific permissions, trying global context');
    const globalCtx = await getClientContextByClientId(clientId);
    if (globalCtx?.id) {
      permissions = await resolvePermissionsFromCache(userId, globalCtx.id, clientId);
      console.log('[RBAC] Global context permissions:', permissions);
    }
  }

  if (!permissions) {
    console.error('[RBAC] No permissions found for user:', userId);
    return false;
  }

  const permString = `${resourceType}:${action}`;
  const allowed = permissions.includes(permString);
  console.log('[RBAC] Permission check:', permString, '→', allowed);
  return allowed;
}

/* -------------------------------------------------------------
   HELPERS – CACHING
------------------------------------------------------------- */
async function resolvePermissionsFromCache(userId, contextId, clientId) {
  // L1 cache lookup
  try {
    const cached = await getFromL1Cache(`${userId}:${contextId}`);
    if (cached) return cached;
  } catch (e) {
    console.warn('L1 cache error (miss)', e);
  }

  // Cache miss – fetch from DB (now using L2 role cache)
  const perms = await fetchPermissionsFromDB(userId, contextId, clientId);
  if (perms) {
    await setToL1Cache(`${userId}:${contextId}`, perms, 60); // 60 s TTL
  }
  return perms;
}

/* -------------------------------------------------------------
   DB FETCH – USES L2 CACHE FOR ROLE → PERMISSION MAPPING
------------------------------------------------------------- */
async function fetchPermissionsFromDB(userId, contextId, clientId) {
  // First, get distinct role IDs for the user/context
  let roleResult;
  try {
    roleResult = await pool.query(
      `SELECT DISTINCT ura.role_id
         FROM user_role_assignments ura
        WHERE ura.user_id = $1
          AND ura.context_id = $2
          AND ura.client_id = $3`,
      [userId, contextId, clientId]
    );
    console.log('[RBAC] Role query result:', roleResult.rows);
  } catch (err) {
    console.error('DB error fetching role IDs:', err);
    return null;
  }

  if (roleResult.rowCount === 0) {
    console.log('[RBAC] No roles found for user:', userId, 'in context:', contextId);
    return null;
  }
  const roleIds = roleResult.rows.map(r => r.role_id);
  console.log('[RBAC] Found role IDs:', roleIds);

  const permissions = [];

  // Bulk fetch permissions for ALL roles in one query (eliminates N+1)
  try {
    const permsResult = await pool.query(
      `SELECT rp.role_id, p.resource, p.action
         FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = ANY($1::uuid[])`,
      [roleIds]
    );
    console.log('[RBAC] Permission rows:', permsResult.rows);

    // Build a map role_id → permission strings
    const roleMap = new Map();
    for (const row of permsResult.rows) {
      const permStr = `${row.resource}:${row.action}`;
      if (!roleMap.has(row.role_id)) roleMap.set(row.role_id, []);
      roleMap.get(row.role_id).push(permStr);
    }

    // Populate L2 cache per role and aggregate
    for (const roleId of roleIds) {
      const rolePerms = roleMap.get(roleId) || [];
      await setToL2Cache(roleId, rolePerms); // immediate availability for future lookups
      permissions.push(...rolePerms);
    }
    console.log('[RBAC] Final permissions:', permissions);
  } catch (err) {
    console.error('DB error fetching role permissions:', err);
    return null;
  }

  return permissions.length ? permissions : null;
}

/* -------------------------------------------------------------
   CONTEXT HELPERS
------------------------------------------------------------- */
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

/* -------------------------------------------------------------
   USER HELPERS
------------------------------------------------------------- */
async function getUserClientId(userId) {
  const result = await pool.query(
    `SELECT client_id FROM users WHERE id = $1 AND is_active = true`,
    [userId]
  );
  return result.rows[0]?.client_id || null;
}

/* -------------------------------------------------------------
   STUB CACHE LAYER – REPLACE WITH REAL IMPLEMENTATION
------------------------------------------------------------- */
async function getFromL1Cache(key) { return null; }
async function setToL1Cache(key, value, ttlSeconds) {}
async function getFromL2Cache(roleId) { return null; }
async function setToL2Cache(roleId, value) {}