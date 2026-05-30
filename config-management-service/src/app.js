import express from "express";
import cors from "cors";
import configRoutes from "./routes/configRoutes.js";
import authRoutes from "./routes/authRoutes.js";

const app = express();

// CORS configuration
app.use(cors({
  origin: 'http://localhost:3001', // Your frontend URL
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token']
}));

app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Register config routes
app.use("/", configRoutes);
app.use("/auth", authRoutes);

export default app;