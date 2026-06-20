import express from "express";
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

const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token', 'x-client-id', 'x-context-id'],
};

// cors must come before helmet so preflight OPTIONS requests are answered before
// helmet's restrictive headers block them
app.use(cors(corsOptions));
app.options('/{*path}', cors(corsOptions)); // handle preflight for all routes

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' }
}));

app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.get("/health", async (req, res) => {
  const { pool } = await import('./db.js');
  try {
    await pool.query('SELECT 1');
    res.json({ status: "ok", postgres: "ok" });
  } catch {
    res.status(503).json({ status: "degraded", postgres: "unreachable" });
  }
});

app.use("/", configRoutes);
app.use("/auth", authRoutes);
app.use("/roles", roleRoutes);
app.use("/permissions", permissionRoutes);
app.use("/superadmin", superadminRoutes);
app.use("/api-keys", apiKeyRoutes);

export default app;
