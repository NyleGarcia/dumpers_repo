-- Allow anonymous read of auto_approve_enabled for login page display
-- This is non-sensitive data - just tells users if they need approval after signup

-- Add policy for anonymous/public read of site_settings
DROP POLICY IF EXISTS "site_settings_select_public" ON public.site_settings;
CREATE POLICY "site_settings_select_public"
  ON public.site_settings FOR SELECT
  USING (true);

-- Create a simple RPC function for cleaner access from frontend
CREATE OR REPLACE FUNCTION public.get_auto_approve_enabled()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(auto_approve_enabled, false)
  FROM public.site_settings
  WHERE id = 1
  LIMIT 1;
$$;

-- Grant execute to anon role (unauthenticated users)
GRANT EXECUTE ON FUNCTION public.get_auto_approve_enabled() TO anon;
GRANT EXECUTE ON FUNCTION public.get_auto_approve_enabled() TO authenticated;
