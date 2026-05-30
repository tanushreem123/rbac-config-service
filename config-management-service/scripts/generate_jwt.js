import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

// Replace with a real user id from your users table
const userId = 'replace-with-real-user-id';
const clientId = 'replace-with-real-client-id';

const payload = {
  user_id: userId,
  client_id: clientId
};

const secret = process.env.JWT_SECRET || 'your-jwt-secret-key';
const token = jwt.sign(payload, secret, { expiresIn: '1h' });

console.log('Generated JWT:', token);
