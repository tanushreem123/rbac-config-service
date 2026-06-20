const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// Resolves client_id from the current hostname and caches it in localStorage.
// Called once on app load — every subsequent call reads from cache.
export async function resolveClientFromDomain() {
  if (typeof window === 'undefined') return null;

  const cached = localStorage.getItem('detected_client_id');
  if (cached) return cached;

  const domain = window.location.hostname;
  try {
    const res = await fetch(`${BASE_URL}/superadmin/client-by-domain?domain=${encodeURIComponent(domain)}`);
    if (!res.ok) return null;
    const { client } = await res.json();
    localStorage.setItem('detected_client_id', client.id);
    localStorage.setItem('detected_client_name', client.name);
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
}
