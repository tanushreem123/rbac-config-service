-- Generate user seeds with environment variables
INSERT INTO users (client_id, email, password_hash, name, is_active, is_email_verified)
VALUES (
  ${SEED_CLIENT_ID}, ${SEED_USER_EMAIL}, crypt(${SEED_USER_PASSWORD}, gen_salt('bf')), 'John Doe', true, true),
  (${SEED_ADMIN_CLIENT_ID}, ${SEED_ADMIN_EMAIL}, crypt(${SEED_ADMIN_PASSWORD}, gen_salt('bf')), 'Admin User', true, true)
);