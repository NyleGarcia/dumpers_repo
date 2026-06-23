-- Per-event Discord webhook rows: remove 4-webhook cap, allow same URL on multiple events,
-- return webhook URLs to owners, and add sync RPC for the subscribe UI.

DROP INDEX IF EXISTS public.idx_discord_webhooks_url_unique;

CREATE OR REPLACE FUNCTION public.clear_my_discord_event_webhook(p_event_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_event_type IS NULL OR NOT (p_event_type = ANY(public.discord_user_valid_events())) THEN
    RAISE EXCEPTION 'Invalid event type';
  END IF;

  DELETE FROM public.discord_webhooks
  WHERE registered_by_user_id = v_user_id
    AND subscribed_events = ARRAY[p_event_type]::text[];

  UPDATE public.discord_webhooks
  SET subscribed_events = array_remove(subscribed_events, p_event_type)
  WHERE registered_by_user_id = v_user_id
    AND p_event_type = ANY(subscribed_events)
    AND subscribed_events <> ARRAY[p_event_type]::text[];

  DELETE FROM public.discord_webhooks
  WHERE registered_by_user_id = v_user_id
    AND (subscribed_events IS NULL OR cardinality(subscribed_events) = 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_my_discord_event_webhook(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.register_discord_webhook(
  p_webhook_url text,
  p_webhook_name text,
  p_subscribed_events text[],
  p_registered_by text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_webhook_id uuid;
  v_user_id uuid;
  v_valid_events text[] := public.discord_user_valid_events();
  v_filtered_events text[];
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required to register webhooks');
  END IF;

  IF NOT p_webhook_url ~ '^https://discord\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$'
     AND NOT p_webhook_url ~ '^https://discordapp\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid Discord webhook URL format');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.discord_webhooks
    WHERE webhook_url = p_webhook_url
      AND registered_by_user_id IS DISTINCT FROM v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This Discord channel is already registered by another member');
  END IF;

  SELECT ARRAY_AGG(e)
  INTO v_filtered_events
  FROM unnest(p_subscribed_events) e
  WHERE e = ANY(v_valid_events);

  IF v_filtered_events IS NULL OR array_length(v_filtered_events, 1) = 0 THEN
    v_filtered_events := public.discord_default_user_events();
  END IF;

  INSERT INTO public.discord_webhooks (webhook_url, webhook_name, subscribed_events, registered_by, registered_by_user_id)
  VALUES (p_webhook_url, p_webhook_name, v_filtered_events, p_registered_by, v_user_id)
  RETURNING id INTO v_webhook_id;

  RETURN jsonb_build_object('success', true, 'webhook_id', v_webhook_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_my_discord_event_webhooks(p_entries jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_entry jsonb;
  v_event_type text;
  v_webhook_name text;
  v_webhook_url text;
  v_valid_events text[] := public.discord_user_valid_events();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  IF p_entries IS NULL OR jsonb_typeof(p_entries) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid webhook payload');
  END IF;

  FOR v_entry IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
    v_event_type := NULLIF(trim(v_entry->>'event_type'), '');
    v_webhook_name := NULLIF(trim(v_entry->>'webhook_name'), '');
    v_webhook_url := NULLIF(trim(v_entry->>'webhook_url'), '');

    IF v_event_type IS NULL OR NOT (v_event_type = ANY(v_valid_events)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid event type in payload');
    END IF;

    IF v_webhook_url IS NULL THEN
      PERFORM public.clear_my_discord_event_webhook(v_event_type);
      CONTINUE;
    END IF;

    IF v_webhook_name IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Channel name required when a webhook URL is set',
        'event_type', v_event_type
      );
    END IF;

    IF NOT v_webhook_url ~ '^https://discord\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$'
       AND NOT v_webhook_url ~ '^https://discordapp\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid Discord webhook URL format',
        'event_type', v_event_type
      );
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.discord_webhooks
      WHERE webhook_url = v_webhook_url
        AND registered_by_user_id IS DISTINCT FROM v_user_id
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'This Discord channel is already registered by another member',
        'event_type', v_event_type
      );
    END IF;

    PERFORM public.clear_my_discord_event_webhook(v_event_type);

    INSERT INTO public.discord_webhooks (
      webhook_url,
      webhook_name,
      subscribed_events,
      registered_by,
      registered_by_user_id
    )
    VALUES (
      v_webhook_url,
      v_webhook_name,
      ARRAY[v_event_type]::text[],
      (SELECT email FROM public.profiles WHERE id = v_user_id),
      v_user_id
    );
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_my_discord_event_webhooks(jsonb) TO authenticated;

DROP FUNCTION IF EXISTS public.get_my_discord_webhooks();

CREATE OR REPLACE FUNCTION public.get_my_discord_webhooks()
RETURNS TABLE (
  id uuid,
  webhook_url text,
  webhook_name text,
  subscribed_events text[],
  created_at timestamptz,
  last_success_at timestamptz,
  failure_count int,
  active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    dw.id,
    dw.webhook_url,
    dw.webhook_name,
    dw.subscribed_events,
    dw.created_at,
    dw.last_success_at,
    dw.failure_count,
    dw.active
  FROM public.discord_webhooks dw
  WHERE dw.registered_by_user_id = auth.uid()
  ORDER BY dw.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_discord_webhooks() TO authenticated;
