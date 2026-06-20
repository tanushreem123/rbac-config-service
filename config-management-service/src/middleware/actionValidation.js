const VALID_ACTIONS = ['read', 'write', 'delete'];

export function validateAction(action) {
  if (!action || Array.isArray(action)) return false;
  return VALID_ACTIONS.includes(action.toLowerCase());
}

export function actionValidationMiddleware(req, res, next) {
  const action =
    req.method === 'GET' ? 'read' :
    req.method === 'POST' ? 'write' :
    req.method === 'DELETE' ? 'delete' :
    (req.method === 'PUT' || req.method === 'PATCH') ? 'write' : null;

  if (!action || !validateAction(action)) {
    return res.status(400).json({ error: 'Invalid HTTP method' });
  }

  req.validatedAction = action;
  next();
}
