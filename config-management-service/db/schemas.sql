-- RBAC Core Schema
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_email_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login TIMESTAMPTZ,
  UNIQUE (client_id, email)
);
CREATE INDEX ON users(client_id);

CREATE TABLE contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  type TEXT NOT NULL CHECK (type IN ('client', 'team', 'project')),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES contexts(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON contexts(client_id);

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  resource TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('read', 'write', 'delete')),
  description TEXT,
  UNIQUE (service, resource, action)
);

CREATE TABLE client_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  name TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,
  parent_role_id UUID REFERENCES client_roles(id),
  UNIQUE (client_id, name)
);
CREATE INDEX ON client_roles(client_id);

CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES client_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_role_assignments (
  user_id UUID NOT NULL REFERENCES users(id),
  client_id UUID NOT NULL REFERENCES clients(id),
  context_id UUID NOT NULL REFERENCES contexts(id),
  role_id UUID NOT NULL REFERENCES client_roles(id),
  PRIMARY KEY (user_id, client_id, context_id, role_id)
);
CREATE INDEX ON user_role_assignments(user_id, context_id);
CREATE INDEX ON user_role_assignments(client_id, context_id);

CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  flag_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  environment TEXT NOT NULL DEFAULT 'production',
  reason TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_id, flag_name, environment)
);
CREATE INDEX ON feature_flags(client_id, flag_name);

CREATE TABLE configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  key TEXT NOT NULL,
  value JSONB,
  environment TEXT NOT NULL DEFAULT 'production',
  active_version INT DEFAULT 1,
  reason TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_id, key, environment)
);