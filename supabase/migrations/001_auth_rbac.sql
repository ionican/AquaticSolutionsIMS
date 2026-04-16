-- ============================================================
-- Auth & RBAC Migration
-- Creates user_roles, user_permissions, and user_audit_log tables
-- ============================================================

-- Roles: Maps Supabase auth users to application roles
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('viewer', 'editor', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Permission overrides: Per-user grants/revokes that override role defaults
CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission)
);

-- Audit log: Records every significant API action
CREATE TABLE IF NOT EXISTS user_audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  detail JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for common audit queries
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON user_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON user_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON user_audit_log(resource);

-- Index for fast role lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);

-- Enable RLS on the auth tables themselves
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_audit_log ENABLE ROW LEVEL SECURITY;

-- Only service role (server-side) can read/write these tables
CREATE POLICY "Service role full access on user_roles"
  ON user_roles FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on user_permissions"
  ON user_permissions FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on user_audit_log"
  ON user_audit_log FOR ALL
  USING (true)
  WITH CHECK (true);
