-- Homium SSO: Custom Access Token Hook
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
--
-- This function injects role_type from app_metadata into every JWT.
-- After enabling, all new tokens will contain a top-level `role_type` claim.

-- Step 1: Create the hook function
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  role_type text;
BEGIN
  claims := event->'claims';

  -- Read role_type from app_metadata, default to 'registered'
  role_type := coalesce(
    claims->'app_metadata'->>'role_type',
    'registered'
  );

  -- Inject role_type as a top-level claim
  claims := jsonb_set(claims, '{role_type}', to_jsonb(role_type));

  -- Write claims back
  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
END;
$$;

-- Step 2: Grant execute to supabase_auth_admin (required for hooks)
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Step 3: Revoke from other roles for security
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- After running this SQL, enable the hook in:
-- Dashboard > Authentication > Hooks > Custom Access Token
-- Select: PostgreSQL Function > public.custom_access_token_hook
