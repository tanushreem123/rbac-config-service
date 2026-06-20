import { saFetch } from './superadminAuth';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// ── Clients ────────────────────────────────────────────────────────────────

export async function listClients() {
  const res = await saFetch(`${BASE_URL}/superadmin/clients`);
  if (!res?.ok) throw new Error((await res?.json())?.error || 'Failed to fetch clients');
  return res.json();
}

export async function createClient({ name, domain, description }) {
  const res = await saFetch(`${BASE_URL}/superadmin/clients`, {
    method: 'POST',
    body: JSON.stringify({ name, domain, description }),
  });
  if (!res?.ok) throw new Error((await res?.json())?.error || 'Failed to create client');
  return res.json();
}

export async function updateClient(id, { name, domain, description }) {
  const res = await saFetch(`${BASE_URL}/superadmin/clients/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, domain, description }),
  });
  if (!res?.ok) throw new Error((await res?.json())?.error || 'Failed to update client');
  return res.json();
}

export async function getClientUsers(clientId) {
  const res = await saFetch(`${BASE_URL}/superadmin/clients/${clientId}/users`);
  if (!res?.ok) throw new Error((await res?.json())?.error || 'Failed to fetch users');
  return res.json();
}

export async function getClientRoles(clientId) {
  const res = await saFetch(`${BASE_URL}/superadmin/clients/${clientId}/roles`);
  if (!res?.ok) throw new Error((await res?.json())?.error || 'Failed to fetch roles');
  return res.json();
}

export async function createClientRole(clientId, { name, is_default }) {
  const res = await saFetch(`${BASE_URL}/superadmin/clients/${clientId}/roles`, {
    method: 'POST',
    body: JSON.stringify({ name, is_default }),
  });
  if (!res?.ok) throw new Error((await res?.json())?.error || 'Failed to create role');
  return res.json();
}

// ── Role Permissions ───────────────────────────────────────────────────────

export async function getClientRolePermissions(clientId, roleId) {
  const res = await saFetch(`${BASE_URL}/superadmin/clients/${clientId}/roles/${roleId}/permissions`);
  if (!res?.ok) throw new Error((await res?.json())?.error || 'Failed to fetch permissions');
  return res.json();
}

export async function addClientRolePermission(clientId, roleId, permissionId) {
  const res = await saFetch(`${BASE_URL}/superadmin/clients/${clientId}/roles/${roleId}/permissions`, {
    method: 'POST',
    body: JSON.stringify({ permission_id: permissionId }),
  });
  if (!res?.ok) throw new Error((await res?.json())?.error || 'Failed to add permission');
  return res.json();
}

export async function removeClientRolePermission(clientId, roleId, permId) {
  const res = await saFetch(`${BASE_URL}/superadmin/clients/${clientId}/roles/${roleId}/permissions/${permId}`, {
    method: 'DELETE',
  });
  if (!res?.ok) throw new Error((await res?.json())?.error || 'Failed to remove permission');
  return res.json();
}

// ── Global Permissions ─────────────────────────────────────────────────────

export async function listAllPermissions() {
  const res = await saFetch(`${BASE_URL}/superadmin/permissions`);
  if (!res?.ok) throw new Error((await res?.json())?.error || 'Failed to fetch permissions');
  return res.json();
}

// ── Client Users ───────────────────────────────────────────────────────────

export async function createClientUser(clientId, { email, name, password, role_id }) {
  const res = await saFetch(`${BASE_URL}/superadmin/clients/${clientId}/users`, {
    method: 'POST',
    body: JSON.stringify({ email, name, password, role_id: role_id || undefined }),
  });
  if (!res?.ok) throw new Error((await res?.json())?.error || 'Failed to create user');
  return res.json();
}
