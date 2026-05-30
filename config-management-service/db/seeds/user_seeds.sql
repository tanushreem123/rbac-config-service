-- Generate user seeds with environment variables
INSERT INTO users (client_id, email, password, name, is_active, is_email_verified)
VALUES (
  ${SEED_CLIENT_ID}, ${SEED_USER_EMAIL}, ${SEED_USER_PASSWORD}, 'John Doe', true, true),
  (${SEED_ADMIN_CLIENT_ID}, ${SEED_ADMIN_EMAIL}, ${SEED_ADMIN_PASSWORD}, 'Admin User', true, true)
);