-- Require RSI Handle verification before registering personal deal webhooks (my_order_*).
-- Marketplace and support webhooks remain available without verification.

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
  v_rsi_verified boolean;
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

    IF v_event_type LIKE 'my_order_%' THEN
      SELECT rsi_handle_verified INTO v_rsi_verified
      FROM public.profiles
      WHERE id = v_user_id;

      IF NOT COALESCE(v_rsi_verified, false) THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'RSI Handle verification required',
          'event_type', v_event_type
        );
      END IF;
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
