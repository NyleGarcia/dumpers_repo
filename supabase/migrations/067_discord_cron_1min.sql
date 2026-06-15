-- Update Discord cron job to run every 1 minute instead of 5 minutes

DO $setup$
BEGIN
  -- Unschedule existing 5-minute job
  BEGIN
    PERFORM cron.unschedule('process-discord-queue');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Schedule new 1-minute job
  PERFORM cron.schedule(
    'process-discord-queue',
    '* * * * *',
    'SELECT public.invoke_discord_processor()'
  );
  RAISE NOTICE 'Discord cron job updated: every 1 minute';
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron extension not available. Run manually: SELECT cron.schedule(''process-discord-queue'', ''* * * * *'', ''SELECT public.invoke_discord_processor()'');';
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not update cron job: %. Run manually in SQL Editor.', SQLERRM;
END;
$setup$;
