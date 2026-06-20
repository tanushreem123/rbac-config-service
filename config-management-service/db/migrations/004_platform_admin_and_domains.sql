-- Platform-level superadmin (not tied to any client)
CREATE TABLE platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Domain mapping per client (one domain per client)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS domain TEXT UNIQUE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS description TEXT;
