-- Homium SSO: Expose auth audit log via RPC
-- Run this in the Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.get_audit_log(
  result_limit int DEFAULT 50,
  result_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  payload jsonb,
  ip_address inet,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth
AS $$
  SELECT id, payload, ip_address, created_at
  FROM auth.audit_log_entries
  ORDER BY created_at DESC
  LIMIT result_limit
  OFFSET result_offset;
$$;

-- Only allow service_role to call this function
REVOKE EXECUTE ON FUNCTION public.get_audit_log FROM authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.get_audit_log TO service_role;
