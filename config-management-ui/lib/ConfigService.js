import { authFetch } from './auth';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function fetchConfigs(env) {
  const res = await authFetch(`${BASE_URL}/configs?env=${env}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch configs');
  return Array.isArray(data) ? data : [];
}

export async function createConfig({ environment, key, value, type = 'string' }) {
  const res = await authFetch(`${BASE_URL}/configs`, {
    method: 'POST',
    body: JSON.stringify({ environment, key, value, type }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to save config');
  return data;
}

export async function deleteConfig(key, environment) {
  const res = await authFetch(`${BASE_URL}/configs/${encodeURIComponent(key)}?environment=${environment}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete config');
  return data;
}

export async function fetchConfigVersions(key, env) {
  const res = await authFetch(`${BASE_URL}/configs/${encodeURIComponent(key)}/versions?env=${env}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch versions');
  return Array.isArray(data) ? data : [];
}

export async function rollbackConfig({ key, environment, targetVersion }) {
  const res = await authFetch(`${BASE_URL}/configs/rollback`, {
    method: 'POST',
    body: JSON.stringify({ key, environment, targetVersion }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to rollback');
  return data;
}

// ── API Keys ─────────────────────────────────────────────────────────────────

export async function listApiKeys() {
  const res = await authFetch(`${BASE_URL}/api-keys`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch API keys');
  return data.keys || [];
}

export async function createApiKey(name) {
  const res = await authFetch(`${BASE_URL}/api-keys`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create API key');
  return data; // { key: {...}, secret: "cms_..." }
}

export async function revokeApiKey(id) {
  const res = await authFetch(`${BASE_URL}/api-keys/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to revoke API key');
  return data;
}
