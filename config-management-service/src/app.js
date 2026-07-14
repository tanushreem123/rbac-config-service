import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import configRoutes from "./routes/configRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import roleRoutes from "./routes/roleRoutes.js";
import permissionRoutes from "./routes/permissionRoutes.js";
import superadminRoutes from "./routes/superadminRoutes.js";
import apiKeyRoutes from "./routes/apiKeyRoutes.js";

const app = express();

// Behind a reverse proxy (Caddy) in production: trust the first proxy hop so
// req.ip / X-Forwarded-For resolve to the real client, and express-rate-limit
// keys on the actual user instead of Caddy's single IP.
app.set('trust proxy', 1);

const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-client-id', 'x-context-id', 'x-feature-flag'],
};

// cors must come before helmet so preflight OPTIONS requests are answered before
// helmet's restrictive headers block them
app.use(cors(corsOptions));
app.options('/{*path}', cors(corsOptions)); // handle preflight for all routes

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Programmatic API-key traffic (config reads) gets a higher ceiling than the
// browser UI. API keys arrive as the raw "cms_..." value in the Authorization
// header; user sessions use cookies, so this header check distinguishes them.
// NOTE: the limiter store is in-memory (per-process) — move to a shared store
// (e.g. rate-limit-redis) before running more than one instance.
const isApiKeyRequest = (req) => (req.headers['authorization'] || '').startsWith('cms_');

app.use(rateLimit({
  windowMs: 1123 * 60 * 1000,
  limit: (req) => (isApiKeyRequest(req) ? 1000 : 100),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
}));

app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.get("/health", async (req, res) => {
  const { pool } = await import('./db.js');
  let postgres = "ok";
  try {
    await pool.query('SELECT 1');
  } catch {
    postgres = "unreachable";
  }
  // readyState 1 = connected. Config data lives in Mongo, so it's part of health.
  const mongo = mongoose.connection.readyState === 1 ? "ok" : "unreachable";
  const healthy = postgres === "ok" && mongo === "ok";
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    postgres,
    mongo,
  });
});

app.use("/", configRoutes);
app.use("/auth", authRoutes);
app.use("/roles", roleRoutes);
app.use("/permissions", permissionRoutes);
app.use("/superadmin", superadminRoutes);
app.use("/api-keys", apiKeyRoutes);

export default app;
