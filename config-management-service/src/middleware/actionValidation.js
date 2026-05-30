const VALID_ACTIONS = ['read', 'write', 'delete'];

/**
 * Validates that the action parameter is one of the allowed values.
 * Rejects invalid actions before any RBAC processing.
 *
 * @param {string} action - The action being requested (e.g., 'read', 'write', 'delete')
 * @returns {boolean} - true if valid, false otherwise
 */
export function validateAction(action) {
  console.log("action", action);
  // Only allow single action string (not array)
  if (!action || Array.isArray(action)) {
    return false;
  }
  return VALID_ACTIONS.includes(action.toLowerCase());
}

/**
 * Middleware to validate action parameter before RBAC checks
 */
export function actionValidationMiddleware(req, res, next) {
  const action = req.method === 'GET' ? 'read' :
                  req.method === 'POST' ? 'write' :
                  req.method === 'DELETE' ? 'delete' :
                  req.method === 'PUT' || req.method === 'PATCH' ? 'write' : null;

  if (!action) {
    return res.status(400).json({ error: 'Invalid HTTP method' });
  }
 console.log("req response",req.method);
  if (!validateAction(action)) {
    return res.status(400).json({ error: `Invalid action: ${action}. Only read/write/delete allowed` });
  }

  // Store validated action on request for downstream use
  req.validatedAction = action;
  next();
}
