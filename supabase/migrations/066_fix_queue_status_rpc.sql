-- Fix get_discord_queue_status to properly return data
-- The issue was the super-admin check failing in certain contexts

DROP FUNCTION IF EXISTS public.get_discord_queue_status();

CREATE OR REPLACE FUNCTION public.get_discord_queue_status()
RETURNS TABLE (
  pending_count bigint,
  oldest_pending timestamptz,
  processed_today bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check super-admin status
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super-admin access required';
  END IF;
  
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE dmq.processed_at IS NULL)::bigint as pending_count,
    MIN(dmq.created_at) FILTER (WHERE dmq.processed_at IS NULL) as oldest_pending,
    COUNT(*) FILTER (WHERE dmq.processed_at IS NOT NULL AND dmq.processed_at > now() - interval '1 day')::bigint as processed_today
  FROM discord_message_queue dmq;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_discord_queue_status() TO authenticated;
