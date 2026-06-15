-- Set up cron job to process Discord message queue every 5 minutes
-- Uses pg_cron and pg_net extensions to call the send-discord edge function

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create a function to invoke the send-discord edge function
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
  
  -- Get Supabase URL from config (set these in your Supabase dashboard)
  v_supabase_url := current_setting('app.supabase_url', true);
  v_service_key := current_setting('app.supabase_service_key', true);
  
  -- If config not set, try environment approach
  IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
    RAISE NOTICE 'Discord cron: Supabase URL or service key not configured. Skipping.';
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

-- Schedule the cron job to run every 5 minutes
-- Note: Cron jobs are managed in Supabase Dashboard > Database > Extensions > pg_cron
-- This creates the job if pg_cron is properly configured
-- Remove existing job if it exists (run separately if needed)
-- SELECT cron.unschedule('process-discord-queue');

-- Schedule the cron job to run every 5 minutes
-- Run this in Supabase SQL Editor after enabling pg_cron extension:
-- SELECT cron.schedule('process-discord-queue', '*/5 * * * *', 'SELECT public.invoke_discord_processor()');

-- Attempt automatic setup (may fail if pg_cron not enabled yet)
DO $setup$
BEGIN
  -- Try to unschedule existing job first
  BEGIN
    PERFORM cron.unschedule('process-discord-queue');
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignore if job doesn't exist or cron not available
  END;
  
  -- Schedule new job
  PERFORM cron.schedule(
    'process-discord-queue',
    '*/5 * * * *',
    'SELECT public.invoke_discord_processor()'
  );
  RAISE NOTICE 'Discord cron job scheduled: every 5 minutes';
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron extension not available. Enable it in Supabase Dashboard > Database > Extensions, then run: SELECT cron.schedule(''process-discord-queue'', ''*/5 * * * *'', ''SELECT public.invoke_discord_processor()'');';
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule cron job: %. Run manually in SQL Editor.', SQLERRM;
END;
$setup$;

-- Alternative: Simple approach using Supabase's built-in cron
-- If pg_cron/pg_net don't work, you can set this up in the Supabase Dashboard:
-- 1. Go to Database > Extensions and enable pg_cron
-- 2. Go to SQL Editor and run:
--    SELECT cron.schedule('process-discord-queue', '*/5 * * * *', 'SELECT public.process_discord_queue_simple()');

-- Simple processor that marks messages and lets the next manual trigger send them
-- (fallback if HTTP calls don't work)
CREATE OR REPLACE FUNCTION public.process_discord_queue_simple()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  -- Just return the count of pending messages
  -- The actual sending happens via the edge function
  SELECT COUNT(*) INTO v_count
  FROM discord_message_queue
  WHERE processed_at IS NULL;
  
  RETURN v_count;
END;
$$;
