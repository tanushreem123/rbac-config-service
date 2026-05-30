const ADMIN_TOKEN_KEY = "ADMIN_API_TOKEN";

/**
 * Store admin token (manual entry or dev setup)
 */
export function setAdminToken(token) {
  if (!token) return;
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

/**
 * Read admin token for authenticated requests
 */
export function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

/**
 * Remove admin token (logout / reset)
 */
export function clearAdminToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}
