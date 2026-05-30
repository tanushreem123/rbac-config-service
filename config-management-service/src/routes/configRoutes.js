import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { actionValidationMiddleware } from "../middleware/actionValidation.js";
import { clientContextMiddleware } from "../middleware/clientContext.js";
import { createOrUpdateConfig, rollbackConfig, getAllActiveConfigs, getConfigVersions } from "../services/configServices.js";

const router = express.Router();

// Middleware chain for protected routes (POST)
const protectedChain = [ actionValidationMiddleware, authMiddleware];

// 🔐 Protected admin routes
router.post("/configs",protectedChain, async (req, res) => {
  const { key, environment, value, createdBy } = req.body;
  try {
    const result = await createOrUpdateConfig({
      key,
      environment,
      value,
      createdBy,
      clientId: req.clientId, // from clientContext middleware
    });
    res.json(result);
  } catch (error) {
    console.error("Config creation error:", error);
    res.status(400).json({ error: error.message });
  }
});

router.post("/configs/rollback", protectedChain, async (req, res) => {
  try {
    const result = await rollbackConfig(req.body, req.clientId);
    res.json(result);
  } catch (err) {
    console.error("Rollback error:", err);
    res.status(400).json({ error: err.message });
  }
});

// 🔓 Public read route (no auth required, but client_id must be provided)
router.get("/configs", clientContextMiddleware, async (req, res) => {
  try {
    const { env } = req.query;
    if (!env) {
      return res.status(400).json({ error: "Environment (env) query parameter required" });
    }
    console.log(`Fetching active configs for environment: ${env}, client_id: ${req.clientId}`);
    const configs = await getAllActiveConfigs(env, req.clientId);
    res.json(configs);
  } catch (err) {
    console.error("Fetch configs error:", err);
    res.status(400).json({ error: err.message });
  }
});

router.get("/configs/:key/versions", async (req, res) => {
  try {
    const { key } = req.params;
    const { env } = req.query;

    if (!env) {
      return res.status(400).json({ error: "Environment (env) query parameter required" });
    }

    const versions = await getConfigVersions(key, env, req.clientId);
    res.json(versions);
  } catch (err) {
    console.error("Get config versions error:", err);
    res.status(400).json({ error: err.message });
  }
});

export default router;