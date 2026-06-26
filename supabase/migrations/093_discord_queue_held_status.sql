-- Distinguish coalesce-held messages from ready-to-send queue rows.

DROP FUNCTION IF EXISTS public.get_discord_queue_status();

CREATE OR REPLACE FUNCTION public.get_discord_queue_status()
RETURNS TABLE (
  pending_count bigint,
  held_count bigint,
  oldest_pending timestamptz,
  next_held_until timestamptz,
  processed_today bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super-admin access required';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*) FILTER (
      WHERE dmq.processed_at IS NULL
        AND (dmq.held_until IS NULL OR dmq.held_until <= now())
    )::bigint AS pending_count,
    COUNT(*) FILTER (
      WHERE dmq.processed_at IS NULL
        AND dmq.held_until IS NOT NULL
        AND dmq.held_until > now()
    )::bigint AS held_count,
    MIN(dmq.created_at) FILTER (
      WHERE dmq.processed_at IS NULL
        AND (dmq.held_until IS NULL OR dmq.held_until <= now())
    ) AS oldest_pending,
    MIN(dmq.held_until) FILTER (
      WHERE dmq.processed_at IS NULL
        AND dmq.held_until IS NOT NULL
        AND dmq.held_until > now()
    ) AS next_held_until,
    COUNT(*) FILTER (
      WHERE dmq.processed_at IS NOT NULL
        AND dmq.processed_at > now() - interval '1 day'
    )::bigint AS processed_today
  FROM public.discord_message_queue dmq;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_discord_queue_status() TO authenticated;

DROP FUNCTION IF EXISTS public.get_pending_discord_messages(integer);

CREATE OR REPLACE FUNCTION public.get_pending_discord_messages(
  p_limit int DEFAULT 50,
  p_include_held boolean DEFAULT false
)
RETURNS TABLE (
  id uuid,
  event_type text,
  title text,
  description text,
  color int,
  fields jsonb,
  target_user_id uuid,
  actor_user_id uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dmq.id,
    dmq.event_type,
    dmq.title,
    dmq.description,
    dmq.color,
    dmq.fields,
    dmq.target_user_id,
    dmq.actor_user_id,
    dmq.created_at
  FROM public.discord_message_queue dmq
  WHERE dmq.processed_at IS NULL
    AND (
      p_include_held
      OR dmq.held_until IS NULL
      OR dmq.held_until <= now()
    )
  ORDER BY dmq.created_at ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_discord_messages(int, boolean) TO service_role;
