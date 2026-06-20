const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// Tokens are in httpOnly cookies — JS cannot read them.
// We store only non-sensitive session info in localStorage.

export function getSessionUser() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem('session_user')); } catch { return null; }
}

export function getClientId() {
  // From session user (post-login) or domain-detected fallback (pre-login)
  const user = getSessionUser();
  if (user?.client_id) return user.client_id;
  if (typeof window !== 'undefined') return localStorage.getItem('detected_client_id') || null;
  return null;
}

export function getContextId() {
  const user = getSessionUser();
  if (user?.context_id) return user.context_id;
  // fallback to env var for backwards compatibility
  return process.env.NEXT_PUBLIC_CONTEXT_ID || null;
}

export function isLoggedIn() {
  return !!getSessionUser();
}

function saveSession(user) {
  localStorage.setItem('session_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('session_user');
}

export async function login(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',        // sends & receives cookies
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  saveSession(data.user);
  return data;
}

export async function logout() {
  try {
    await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {}
  clearSession();
}

// Called by authFetch on 401 — silently re-issues tokens via cookie
async function refreshAccessToken() {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) { clearSession(); return false; }
    // Patch session with context_id if the stored session is missing it
    await patchSessionContextId();
    return true;
  } catch {
    clearSession();
    return false;
  }
}

// If session_user is missing context_id, fetch it from /auth/me and patch localStorage
async function patchSessionContextId() {
  const user = getSessionUser();
  if (!user || user.context_id) return;
  try {
    const res = await fetch(`${BASE_URL}/auth/me`, { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    if (data.user?.context_id) {
      saveSession({ ...user, context_id: data.user.context_id });
    }
  } catch {}
}

// Authenticated fetch — cookies carry the token automatically
export async function authFetch(url, options = {}) {
  // Silently fix old sessions that are missing context_id
  if (getSessionUser() && !getSessionUser()?.context_id) {
    await patchSessionContextId();
  }

  const clientId = getClientId();
  const contextId = getContextId();

  const headers = {
    'Content-Type': 'application/json',
    ...(clientId && { 'x-client-id': clientId }),
    ...(contextId && { 'x-context-id': contextId }),
    ...options.headers,
  };

  let res = await fetch(url, { ...options, headers, credentials: 'include' });

  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      window.location.replace('/login');
      return;
    }
    // Recompute headers in case context_id was patched during token refresh
    const retryHeaders = {
      'Content-Type': 'application/json',
      ...(getClientId() && { 'x-client-id': getClientId() }),
      ...(getContextId() && { 'x-context-id': getContextId() }),
      ...options.headers,
    };
    res = await fetch(url, { ...options, headers: retryHeaders, credentials: 'include' });
  }

  return res;
}
