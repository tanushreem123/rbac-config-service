-- Enable RLS on all client-scoped tables
ALTER TABLE configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contexts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for each table
CREATE POLICY client_isolation ON configs
  FOR ALL
  USING (client_id = current_setting('app.current_client_id')::UUID);

CREATE POLICY client_isolation ON feature_flags
  FOR ALL
  USING (client_id = current_setting('app.current_client_id')::UUID);

CREATE POLICY client_isolation ON client_roles
  FOR ALL
  USING (client_id = current_setting('app.current_client_id')::UUID);

CREATE POLICY client_isolation ON user_role_assignments
  FOR ALL
  USING (client_id = current_setting('app.current_client_id')::UUID);

CREATE POLICY client_isolation ON contexts
  FOR ALL
  USING (client_id = current_setting('app.current_client_id')::UUID);

-- Create a function to set the client context with SECURITY DEFINER
CREATE OR REPLACE FUNCTION set_client_context(client_id UUID)
RETURNS VOID AS $$
BEGIN
  EXECUTE FORMAT('SET app.current_client_id = %L', client_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to the application user
GRANT EXECUTE ON FUNCTION set_client_context(UUID) TO tanushreemiskin;