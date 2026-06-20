import { pool } from '../db.js';

export async function clientContextMiddleware(req, res, next) {
  let clientId =
    req.headers['x-client-id'] ||
    req.query?.client_id ||
    req.body?.client_id ||
    null;

  if (!clientId) {
    return res.status(400).json({ error: 'Missing client_id. Provide it via X-Client-ID header, query parameter, or body.' });
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(clientId)) {
    return res.status(400).json({ error: 'Invalid client_id format. Must be a UUID.' });
  }

  try {
    await pool.query('SELECT set_config($1, $2, false)', ['app.current_client_id', clientId]);
    req.clientId = clientId;
    next();
  } catch (err) {
    console.error('Error setting client context:', err);
    return res.status(500).json({ error: 'Failed to set client context' });
  }
}
