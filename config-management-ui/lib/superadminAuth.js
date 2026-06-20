const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export function getSuperadminInfo() {
  try {
    const raw = localStorage.getItem('sa_info');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function isSuperadminLoggedIn() {
  return !!getSuperadminInfo();
}

export function clearSuperadmin() {
  localStorage.removeItem('sa_info');
}

export async function superadminLogin(email, password) {
  const res = await fetch(`${BASE_URL}/superadmin/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  localStorage.setItem('sa_info', JSON.stringify(data.admin));
  return data;
}

export async function superadminLogout() {
  try {
    await fetch(`${BASE_URL}/superadmin/logout`, { method: 'POST', credentials: 'include' });
  } catch {}
  clearSuperadmin();
}

export async function saFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (res?.status === 401) {
    clearSuperadmin();
    window.location.replace('/superadmin/login');
    return;
  }
  return res;
}
