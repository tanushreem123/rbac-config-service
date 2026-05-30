import { pool } from '../db.js';

/**
 * Middleware to set the client context for the current DB session.
 * Extracts client_id from:
 *   - Header: X-Client-ID
 *   - Query parameter: client_id
 *   - Body parameter: client_id (for POST/PUT)
 * Sets the app.current_client_id setting for Row-Level Security (RLS).
 * If no client_id is provided, returns 400 Bad Request.
 */
export async function clientContextMiddleware(req, res, next) {
  let clientId = null;
  // Try to get client_id from various sources
  if (req.headers['x-client-id']) {
    clientId = req.headers['x-client-id'];
  } else if (req.query && req.query.client_id) {
    clientId = req.query.client_id;
  } else if (req.body && req.body.client_id) {
    clientId = req.body.client_id;
  }

  if (!clientId) {
    return res.status(400).json({ error: 'Missing client_id. Provide it via X-Client-ID header, query parameter, or body.' });
  }

  // Validate that it's a valid UUID (optional but good practice)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(clientId)) {
    return res.status(400).json({ error: 'Invalid client_id format. Must be a UUID.' });
  }

  try {
    console.log("before query");
    await pool.query(`SET app.current_client_id = '${clientId}'`);
    console.log("after query");
    req.clientId = clientId;
    next();
  } catch (err) {
    console.log("catch block entered");
    console.error('Error setting client context:', err);
    return res.status(500).json({ error: 'Failed to set client context1' });
  }
}