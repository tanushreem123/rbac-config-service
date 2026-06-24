import { authFetch } from './auth';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// Human-readable labels for each permission
const PERMISSION_LABELS = {
  'users:read':         'view users',
  'users:write':        'create users',
  'users:delete':       'delete users',
  'roles:read':         'view roles',
  'roles:write':        'create or assign roles',
  'roles:delete':       'remove role permissions',
  'permissions:read':   'view permissions',
  'permissions:write':  'create permissions',
  'config:read':        'read configurations',
  'config:write':       'write configurations',
  'config:delete':      'delete configurations',
};

/**
 * Build a human-readable label for a permission object
 * ({ service, resource, action, description }). Falls back to "resource:action"
 * when there's no friendly label. The backend has no `name` field — use this instead.
 */
export function permissionLabel(p) {
  if (!p) return '';
  const key = `${p.resource}:${p.action}`;
  return PERMISSION_LABELS[key] || key;
}

/**
 * Fetch the current user's effective permissions.
 * Returns a Set of strings like "users:delete", "roles:read", etc.
 */
export async function fetchMyPermissions() {
  try {
    const res = await authFetch(`${BASE_URL}/auth/me/permissions`);
    if (!res?.ok) return new Set();
    const data = await res.json();
    return new Set(data.permissions || []);
  } catch {
    return new Set();
  }
}

/**
 * Turn a raw 403 error message into something a user can understand.
 * "Permission denied: users:delete" → "You don't have permission to delete users."
 */
export function friendlyPermissionError(rawMessage = '') {
  if (!rawMessage.includes('Permission denied')) return rawMessage;

  const key = rawMessage.split('Permission denied:')[1]?.trim();
  const label = key ? PERMISSION_LABELS[key] : null;
  return label
    ? `You don't have permission to ${label}.`
    : "You don't have permission to perform this action.";
}
