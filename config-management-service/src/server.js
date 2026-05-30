import './config.js'; 
import mongoose from "mongoose";
import app from "./app.js";

const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI;

// Helper to mask credentials in a connection string for safe logging
function maskDatabaseUrl(connStr) {
  if (!connStr) return null;
  try {
    const url = new URL(connStr);
    if (url.username || url.password) {
      url.username = '***';
      url.password = '***';
    }
    return url.toString();
  } catch (e) {
    // Non-standard format (pg connection strings may sometimes be accepted). Avoid printing raw value.
    return '[DATABASE_URL is set — masked]';
  }
}

// Diagnostic: report whether DATABASE_URL is configured (masked, no credentials)
const rawDb = process.env.DATABASE_URL;
if (rawDb) {
  console.log('DATABASE_URL is set:', maskDatabaseUrl(rawDb));
} else {
  console.warn('DATABASE_URL not set in environment');
}

// Start server even if MongoDB connection fails
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Try to connect to MongoDB in background
if (MONGO_URI) {
  mongoose
    .connect(MONGO_URI)
    .then(() => {
      console.log("Connected to MongoDB");
    })
    .catch((err) => {
      console.warn("MongoDB connection failed (but server is still running)", err.message);
    });
} else {
  console.warn("MONGO_URI not set, skipping MongoDB connection");
}
