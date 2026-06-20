import { authFetch } from './auth';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// ── Users ──────────────────────────────────────────────────────────────────

export async function listUsers(clientId) {
  const res = await authFetch(`${BASE_URL}/auth/users?client_id=${clientId}`);
  if (!res || !res.ok) throw new Error((await res?.json())?.error || 'Failed to fetch users');
  return res.json();
}

export async function createUser({ email, name, password, role_id }) {
  const res = await authFetch(`${BASE_URL}/auth/users`, {
    method: 'POST',
    body: JSON.stringify({ email, name, password, role_id: role_id || undefined }),
  });
  if (!res || !res.ok) throw new Error((await res?.json())?.error || 'Failed to create user');
  return res.json();
}

export async function deleteUser(userId) {
  const res = await authFetch(`${BASE_URL}/auth/users/${userId}`, { method: 'DELETE' });
  if (!res || !res.ok) throw new Error((await res?.json())?.error || 'Failed to delete user');
  return res.json();
}

// ── Roles ──────────────────────────────────────────────────────────────────

export async function listRoles(clientId) {
  const res = await authFetch(`${BASE_URL}/roles?client_id=${clientId}`);
  if (!res || !res.ok) throw new Error((await res?.json())?.error || 'Failed to fetch roles');
  return res.json();
}

export async function createRole({ name, description, clientId, isDefault, skipEmailVerification = false }) {
  const res = await authFetch(`${BASE_URL}/roles`, {
    method: 'POST',
    body: JSON.stringify({ name, description, client_id: clientId, is_default: isDefault, skip_email_verification: skipEmailVerification }),
  });
  if (!res || !res.ok) throw new Error((await res?.json())?.error || 'Failed to create role');
  return res.json();
}

export async function updateRole(roleId, { skipEmailVerification, isDefault }) {
  const res = await authFetch(`${BASE_URL}/roles/${roleId}`, {
    method: 'PATCH',
    body: JSON.stringify({ skip_email_verification: skipEmailVerification, is_default: isDefault }),
  });
  if (!res || !res.ok) throw new Error((await res?.json())?.error || 'Failed to update role');
  return res.json();
}

export async function assignRole({ userId, roleId, contextId }) {
  const res = await authFetch(`${BASE_URL}/roles/assign`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, role_id: roleId, context_id: contextId }),  // client_id comes from JWT
  });
  if (!res || !res.ok) throw new Error((await res?.json())?.error || 'Failed to assign role');
  return res.json();
}

export async function listRolePermissions(roleId) {
  const res = await authFetch(`${BASE_URL}/roles/${roleId}/permissions`);
  if (!res || !res.ok) throw new Error((await res?.json())?.error || 'Failed to fetch role permissions');
  return res.json();
}

export async function addPermissionToRole(roleId, permissionId) {
  const res = await authFetch(`${BASE_URL}/roles/${roleId}/permissions`, {
    method: 'POST',
    body: JSON.stringify({ permission_id: permissionId }),
  });
  if (!res || !res.ok) throw new Error((await res?.json())?.error || 'Failed to add permission');
  return res.json();
}

export async function removePermissionFromRole(roleId, permissionId) {
  const res = await authFetch(`${BASE_URL}/roles/${roleId}/permissions/${permissionId}`, {
    method: 'DELETE',
  });
  if (!res || !res.ok) throw new Error((await res?.json())?.error || 'Failed to remove permission');
  return res.json();
}

// ── Permissions ────────────────────────────────────────────────────────────

export async function listPermissions() {
  const res = await authFetch(`${BASE_URL}/permissions`);
  if (!res || !res.ok) throw new Error((await res?.json())?.error || 'Failed to fetch permissions');
  return res.json();
}

export async function createPermission({ service, resource, action, description }) {
  const res = await authFetch(`${BASE_URL}/permissions`, {
    method: 'POST',
    body: JSON.stringify({ service, resource, action, description }),
  });
  if (!res || !res.ok) throw new Error((await res?.json())?.error || 'Failed to create permission');
  return res.json();
}
