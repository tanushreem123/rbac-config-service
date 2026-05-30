/**
 * Middleware to extract resource-specific context information.
 * Attaches `resourceType`, `context_id` and `client_id` (if present) to the request.
 */
export function resourceContext(req, res, next) {
  // Determine resource type from the route path (e.g., '/configs' -> 'configs')
  const path = req.baseUrl + req.path; // e.g., '/configs' or '/configs/:key'
  const segments = path.split('/').filter(Boolean);
  const resource = segments[0] || '';
  req.resourceType = resource; // used by RBAC check

  // Context ID can be supplied in body (for write ops) or query (for reads)
  // For now we support body.context_id and query.context_id
  req.context_id = req.body?.context_id || req.query?.context_id || null;

  // Client ID is often sent in body for admin actions; for read ops we rely on JWT-derived client_id
  req.client_id = req.body?.client_id || null;

  next();
}
