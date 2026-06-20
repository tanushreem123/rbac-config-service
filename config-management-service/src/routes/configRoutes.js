import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { actionValidationMiddleware } from "../middleware/actionValidation.js";
import { clientContextMiddleware } from "../middleware/clientContext.js";
import { apiKeyAuth } from "../middleware/apiKeyAuth.js";
import {
  createOrUpdateConfig,
  rollbackConfig,
  getAllActiveConfigs,
  getConfigVersions,
  deleteConfig,
} from "../services/configServices.js";

const router = express.Router();

// Full auth chain for write/delete operations (user session required)
const writeChain = [clientContextMiddleware, actionValidationMiddleware, authMiddleware];

// Read chain: API key OR user session both accepted
async function readAuth(req, res, next) {
  // Try API key first (sets req.clientId and req.apiKeyClient)
  await apiKeyAuth(req, res, async () => {
    if (req.apiKeyClient) return next(); // API key succeeded — skip user auth
    // Fall back to full user auth chain
    clientContextMiddleware(req, res, () =>
      actionValidationMiddleware(req, res, () =>
        authMiddleware(req, res, next)
      )
    );
  });
}

// POST /configs — create or update a config value
router.post("/configs", writeChain, async (req, res) => {
  const { key, environment, value, type } = req.body;
  if (!key || !environment || value === undefined) {
    return res.status(400).json({ error: "key, environment, and value are required" });
  }
  try {
    const result = await createOrUpdateConfig({
      key, environment, value, type,
      createdBy: req.user.id,
      clientId: req.clientId,
    });
    res.json(result);
  } catch (error) {
    console.error("Config creation error:", error);
    res.status(400).json({ error: error.message });
  }
});

// POST /configs/rollback
router.post("/configs/rollback", writeChain, async (req, res) => {
  try {
    const result = await rollbackConfig({ ...req.body, clientId: req.clientId });
    res.json(result);
  } catch (err) {
    console.error("Rollback error:", err);
    res.status(400).json({ error: err.message });
  }
});

// DELETE /configs/:key — delete all versions of a config key
router.delete("/configs/:key", writeChain, async (req, res) => {
  const { key } = req.params;
  const { environment } = req.query;
  if (!environment) return res.status(400).json({ error: "environment query param required" });
  try {
    await deleteConfig({ key: decodeURIComponent(key), environment, clientId: req.clientId });
    res.json({ message: "Config deleted" });
  } catch (err) {
    console.error("Delete config error:", err);
    res.status(400).json({ error: err.message });
  }
});

// GET /configs — list active configs for an environment
router.get("/configs", readAuth, async (req, res) => {
  const { env } = req.query;
  if (!env) return res.status(400).json({ error: "env query parameter required" });
  try {
    const configs = await getAllActiveConfigs(env, req.clientId);
    res.json(configs);
  } catch (err) {
    console.error("Fetch configs error:", err);
    res.status(400).json({ error: err.message });
  }
});

// GET /configs/:key/versions — version history for a key
router.get("/configs/:key/versions", readAuth, async (req, res) => {
  const { key } = req.params;
  const { env } = req.query;
  if (!env) return res.status(400).json({ error: "env query parameter required" });
  try {
    const versions = await getConfigVersions(decodeURIComponent(key), env, req.clientId);
    res.json(versions);
  } catch (err) {
    console.error("Get config versions error:", err);
    res.status(400).json({ error: err.message });
  }
});

export default router;
