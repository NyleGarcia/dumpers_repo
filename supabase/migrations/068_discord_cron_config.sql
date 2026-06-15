-- Store Discord cron config in a secure table instead of database settings
-- This table is only accessible by service_role

-- Create config table if not exists
CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Restrict access to service_role only
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- No policies = only service_role can access (RLS blocks all others)
DROP POLICY IF EXISTS "No public access" ON public.app_config;

-- Update the invoke function to use the config table
CREATE OR REPLACE FUNCTION public.invoke_discord_processor()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings discord_settings;
  v_pending_count int;
  v_supabase_url text;
  v_service_key text;
BEGIN
  -- Check if Discord is enabled
  SELECT * INTO v_settings FROM discord_settings WHERE id = 1;
  IF NOT v_settings.enabled THEN
    RETURN;
  END IF;
  
  -- Check if there are pending messages
  SELECT COUNT(*) INTO v_pending_count
  FROM discord_message_queue
  WHERE processed_at IS NULL;
  
  IF v_pending_count = 0 THEN
    RETURN;
  END IF;
  
  -- Get config from secure table
  SELECT value INTO v_supabase_url FROM app_config WHERE key = 'supabase_url';
  SELECT value INTO v_service_key FROM app_config WHERE key = 'supabase_service_key';
  
  IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
    RAISE NOTICE 'Discord cron: Config not set. Run the INSERT statements for app_config.';
    RETURN;
  END IF;
  
  -- Call the edge function via pg_net
  PERFORM extensions.http_post(
    url := v_supabase_url || '/functions/v1/send-discord',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_service_key,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  
  RAISE NOTICE 'Discord cron: Triggered send-discord for % pending messages', v_pending_count;
END;
$$;

-- Insert your config values (run this part manually after creating the table)
-- Replace YOUR_SERVICE_ROLE_KEY with your actual service role key from Dashboard > Settings > API

-- INSERT INTO app_config (key, value) VALUES ('supabase_url', 'https://dcyugmcvlmhlfmillzma.supabase.co')
-- ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- INSERT INTO app_config (key, value) VALUES ('supabase_service_key', 'YOUR_SERVICE_ROLE_KEY')
-- ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
