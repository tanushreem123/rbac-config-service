const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// Resolves client_id from the current hostname and caches it in localStorage.
// Called once on app load — every subsequent call reads from cache.
export async function resolveClientFromDomain({ force = false } = {}) {
  if (typeof window === 'undefined') return null;

  const domain = window.location.hostname;
  const cachedId = localStorage.getItem('detected_client_id');
  const cachedDomain = localStorage.getItem('detected_client_domain');

  // Only trust the cache if it was resolved for the CURRENT hostname, and never when
  // forced. The domain→client mapping can change server-side (a domain reassigned to
  // another client), so security-critical paths (login) should always re-resolve.
  if (!force && cachedId && cachedDomain === domain) return cachedId;

  try {
    const res = await fetch(`${BASE_URL}/superadmin/client-by-domain?domain=${encodeURIComponent(domain)}`);
    if (!res.ok) {
      clearDetectedClient();  // no client for this domain — drop any stale value
      return null;
    }
    const { client } = await res.json();
    localStorage.setItem('detected_client_id', client.id);
    localStorage.setItem('detected_client_name', client.name);
    localStorage.setItem('detected_client_domain', domain);
    return client.id;
  } catch {
    return null;
  }
}

export function getDetectedClientId() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('detected_client_id');
}

export function getDetectedClientName() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('detected_client_name');
}

export function clearDetectedClient() {
  localStorage.removeItem('detected_client_id');
  localStorage.removeItem('detected_client_name');
  localStorage.removeItem('detected_client_domain');
}
