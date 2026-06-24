import './config.js';
import mongoose from "mongoose";
import app from "./app.js";

// Validate all required env vars before starting
const REQUIRED_ENV = ['JWT_SECRET', 'DATABASE_URL', 'MONGO_URI', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const PORT = process.env.PORT || 3001;

let server;

// Graceful shutdown
function shutdown(signal) {
  console.log(`${signal} received, shutting down gracefully`);
  const closeMongo = () => mongoose.connection.close().then(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
  if (server) {
    server.close(() => { console.log('HTTP server closed'); closeMongo(); });
  } else {
    closeMongo();
  }
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// All config data lives in MongoDB, so without it the service can't function —
// fail fast rather than start in a broken state that reports healthy.
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('FATAL: MongoDB connection failed:', err.message);
    process.exit(1);
  });
