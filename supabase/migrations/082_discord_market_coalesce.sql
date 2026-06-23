-- Marketplace listing churn coalesce (trailing-edge debounce per poster)
-- Groups rapid post/cancel/repost into one market_coalesced notification.

ALTER TABLE public.discord_settings
  ADD COLUMN IF NOT EXISTS market_coalesce_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS market_coalesce_minutes int NOT NULL DEFAULT 15;

ALTER TABLE public.discord_message_queue
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS held_until timestamptz,
  ADD COLUMN IF NOT EXISTS coalesce_meta jsonb;

CREATE INDEX IF NOT EXISTS idx_discord_queue_held_until
  ON public.discord_message_queue (held_until)
  WHERE processed_at IS NULL AND held_until IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_discord_queue_dedupe_pending
  ON public.discord_message_queue (dedupe_key)
  WHERE dedupe_key IS NOT NULL AND processed_at IS NULL;

ALTER TABLE public.discord_message_queue
  DROP CONSTRAINT IF EXISTS discord_message_queue_event_type_check;

ALTER TABLE public.discord_message_queue
  ADD CONSTRAINT discord_message_queue_event_type_check
  CHECK (event_type IN (
    'orders', 'order_new', 'order_fulfilled', 'order_cancelled',
    'support', 'admin',
    'market_wtb_new', 'market_wts_new', 'market_accepted', 'market_cancelled', 'market_coalesced',
    'my_order_accepted', 'my_order_in_progress', 'my_order_ready', 'my_order_completed',
    'my_order_cancelled', 'my_order_released', 'my_order_timeout', 'my_order_noshow', 'my_order_dispute',
    'my_support_reply', 'my_support_resolved'
  ));

CREATE OR REPLACE FUNCTION public.discord_build_market_coalesce_title(p_meta jsonb, p_handle text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  parts text[] := ARRAY[]::text[];
  n int;
BEGIN
  n := COALESCE((p_meta->>'wtb_new')::int, 0);
  IF n > 0 THEN
    parts := array_append(parts, n || ' new WTB');
  END IF;

  n := COALESCE((p_meta->>'wts_new')::int, 0);
  IF n > 0 THEN
    parts := array_append(parts, n || ' new WTS');
  END IF;

  n := COALESCE((p_meta->>'cancelled')::int, 0);
  IF n > 0 THEN
    parts := array_append(parts, n || ' cancelled');
  END IF;

  IF COALESCE(array_length(parts, 1), 0) = 0 THEN
    RETURN 'Marketplace: ' || p_handle;
  END IF;

  RETURN 'Marketplace: ' || p_handle || ' — ' || array_to_string(parts, ', ');
END;
$$;

CREATE OR REPLACE FUNCTION public.discord_event_enabled(p_event_type text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.discord_settings%ROWTYPE;
BEGIN
  SELECT * INTO v_settings FROM public.discord_settings WHERE id = 1;
  IF NOT FOUND OR NOT v_settings.enabled THEN
    RETURN false;
  END IF;

  RETURN CASE
    WHEN p_event_type IN ('market_wtb_new', 'market_wts_new', 'order_new', 'orders') THEN v_settings.order_new_enabled
    WHEN p_event_type IN ('market_accepted', 'order_fulfilled') THEN v_settings.order_fulfilled_enabled
    WHEN p_event_type IN ('market_cancelled', 'order_cancelled') THEN v_settings.order_cancelled_enabled
    WHEN p_event_type = 'market_coalesced' THEN
      v_settings.orders_enabled
      AND (v_settings.order_new_enabled OR v_settings.order_cancelled_enabled)
    WHEN p_event_type LIKE 'my_order_%' OR p_event_type LIKE 'my_support_%' THEN v_settings.personal_discord_enabled
    WHEN p_event_type = 'support' THEN v_settings.support_enabled
    WHEN p_event_type = 'admin' THEN v_settings.admin_enabled
    ELSE true
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_market_listing_churn(
  p_action text,
  p_requester_id uuid,
  p_order_id uuid,
  p_title text,
  p_listing_type text,
  p_total_dfp bigint
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.discord_settings%ROWTYPE;
  v_dedupe_key text;
  v_existing_id uuid;
  v_meta jsonb;
  v_minutes int;
  v_handle text;
  v_coalesce_title text;
  v_description text;
  v_fields jsonb;
  v_held_until timestamptz;
BEGIN
  IF p_action NOT IN ('wtb_new', 'wts_new', 'cancelled') THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_settings FROM public.discord_settings WHERE id = 1;
  IF NOT FOUND OR NOT v_settings.enabled OR NOT v_settings.orders_enabled THEN
    RETURN NULL;
  END IF;

  IF p_action IN ('wtb_new', 'wts_new') AND NOT v_settings.order_new_enabled THEN
    RETURN NULL;
  END IF;

  IF p_action = 'cancelled' AND NOT v_settings.order_cancelled_enabled THEN
    RETURN NULL;
  END IF;

  IF NOT COALESCE(v_settings.market_coalesce_enabled, true)
     OR COALESCE(v_settings.market_coalesce_minutes, 15) <= 0 THEN
    CASE p_action
      WHEN 'wts_new' THEN
        RETURN public.queue_discord_message(
          'market_wts_new',
          'New WTS Listing: ' || p_title,
          public.discord_listing_badge(p_listing_type) || ' · ' || public.format_dfp_auec(p_total_dfp),
          5814783,
          public.discord_order_embed_fields(p_order_id),
          NULL,
          p_requester_id
        );
      WHEN 'wtb_new' THEN
        RETURN public.queue_discord_message(
          'market_wtb_new',
          'New WTB Listing: ' || p_title,
          public.discord_listing_badge(p_listing_type) || ' · ' || public.format_dfp_auec(p_total_dfp),
          5814783,
          public.discord_order_embed_fields(p_order_id),
          NULL,
          p_requester_id
        );
      WHEN 'cancelled' THEN
        RETURN public.queue_discord_message(
          'market_cancelled',
          'Listing Cancelled: ' || p_title,
          public.discord_listing_badge(p_listing_type) || ' · ' || public.format_dfp_auec(p_total_dfp),
          15548997,
          public.discord_order_embed_fields(p_order_id),
          NULL,
          p_requester_id
        );
    END CASE;
  END IF;

  IF NOT public.discord_event_enabled('market_coalesced') THEN
    RETURN NULL;
  END IF;

  v_dedupe_key := 'market:churn:' || p_requester_id::text;
  v_minutes := GREATEST(COALESCE(v_settings.market_coalesce_minutes, 15), 1);
  v_handle := public.discord_profile_label(p_requester_id);
  v_held_until := now() + (v_minutes || ' minutes')::interval;
  v_description := public.discord_listing_badge(p_listing_type) || ' · ' || public.format_dfp_auec(p_total_dfp);
  v_fields := public.discord_order_embed_fields(p_order_id);

  PERFORM pg_advisory_xact_lock(hashtext(v_dedupe_key));

  SELECT id, coalesce_meta
  INTO v_existing_id, v_meta
  FROM public.discord_message_queue
  WHERE dedupe_key = v_dedupe_key
    AND processed_at IS NULL;

  IF v_meta IS NULL THEN
    v_meta := jsonb_build_object(
      'wtb_new', 0,
      'wts_new', 0,
      'cancelled', 0,
      'requester_id', p_requester_id
    );
  END IF;

  v_meta := jsonb_set(
    v_meta,
    ARRAY[p_action],
    to_jsonb(COALESCE((v_meta->>p_action)::int, 0) + 1)
  );

  v_meta := v_meta || jsonb_build_object(
    'last_order_id', p_order_id,
    'last_listing_type', p_listing_type,
    'last_total_dfp', p_total_dfp,
    'last_title', p_title
  );

  v_coalesce_title := public.discord_build_market_coalesce_title(v_meta, v_handle);

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.discord_message_queue
    SET
      title = v_coalesce_title,
      description = v_description,
      fields = v_fields,
      coalesce_meta = v_meta,
      held_until = v_held_until,
      actor_user_id = p_requester_id
    WHERE id = v_existing_id;

    RETURN v_existing_id;
  END IF;

  INSERT INTO public.discord_message_queue (
    event_type,
    title,
    description,
    color,
    fields,
    dedupe_key,
    held_until,
    coalesce_meta,
    actor_user_id
  )
  VALUES (
    'market_coalesced',
    v_coalesce_title,
    v_description,
    16096779,
    v_fields,
    v_dedupe_key,
    v_held_until,
    v_meta,
    p_requester_id
  )
  RETURNING id INTO v_existing_id;

  RETURN v_existing_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.queue_market_listing_churn(text, uuid, uuid, text, text, bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_discord_new_custom_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  IF NEW.listing_type = 'wts' THEN
    v_action := 'wts_new';
  ELSE
    v_action := 'wtb_new';
  END IF;

  PERFORM public.queue_market_listing_churn(
    v_action,
    NEW.requester_id,
    NEW.id,
    NEW.title,
    NEW.listing_type,
    NEW.total_dfp_auec
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_discord_delete_custom_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'pending' AND OLD.assignee_id IS NULL THEN
    PERFORM public.queue_market_listing_churn(
      'cancelled',
      OLD.requester_id,
      OLD.id,
      OLD.title,
      OLD.listing_type,
      OLD.total_dfp_auec
    );
  END IF;

  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_discord_webhooks_for_market_event(
  p_event_type text,
  p_exclude_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  webhook_url text,
  webhook_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT dw.id, dw.webhook_url, dw.webhook_name
  FROM public.discord_webhooks dw
  WHERE dw.active = true
    AND (
      (
        p_event_type = 'market_coalesced'
        AND dw.subscribed_events && ARRAY['market_wtb_new', 'market_wts_new', 'market_cancelled']::text[]
      )
      OR (
        p_event_type <> 'market_coalesced'
        AND p_event_type = ANY(dw.subscribed_events)
      )
    )
    AND (p_exclude_user_id IS NULL OR dw.registered_by_user_id IS DISTINCT FROM p_exclude_user_id);
END;
$$;

DROP FUNCTION IF EXISTS public.get_pending_discord_messages(integer);

CREATE OR REPLACE FUNCTION public.get_pending_discord_messages(p_limit int DEFAULT 50)
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
    AND (dmq.held_until IS NULL OR dmq.held_until <= now())
  ORDER BY dmq.created_at ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_discord_messages(int) TO service_role;

DROP FUNCTION IF EXISTS public.update_discord_settings(boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, text, text, boolean);

CREATE OR REPLACE FUNCTION public.update_discord_settings(
  p_enabled boolean DEFAULT NULL,
  p_orders_enabled boolean DEFAULT NULL,
  p_order_new_enabled boolean DEFAULT NULL,
  p_order_fulfilled_enabled boolean DEFAULT NULL,
  p_order_cancelled_enabled boolean DEFAULT NULL,
  p_blueprints_enabled boolean DEFAULT NULL,
  p_support_enabled boolean DEFAULT NULL,
  p_admin_enabled boolean DEFAULT NULL,
  p_official_webhook_url text DEFAULT NULL,
  p_official_webhook_name text DEFAULT NULL,
  p_personal_discord_enabled boolean DEFAULT NULL,
  p_market_coalesce_enabled boolean DEFAULT NULL,
  p_market_coalesce_minutes int DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super-admin access required';
  END IF;

  UPDATE public.discord_settings
  SET
    enabled = COALESCE(p_enabled, enabled),
    orders_enabled = COALESCE(p_orders_enabled, orders_enabled),
    order_new_enabled = COALESCE(p_order_new_enabled, order_new_enabled),
    order_fulfilled_enabled = COALESCE(p_order_fulfilled_enabled, order_fulfilled_enabled),
    order_cancelled_enabled = COALESCE(p_order_cancelled_enabled, order_cancelled_enabled),
    blueprints_enabled = COALESCE(p_blueprints_enabled, blueprints_enabled),
    support_enabled = COALESCE(p_support_enabled, support_enabled),
    admin_enabled = COALESCE(p_admin_enabled, admin_enabled),
    personal_discord_enabled = COALESCE(p_personal_discord_enabled, personal_discord_enabled),
    market_coalesce_enabled = COALESCE(p_market_coalesce_enabled, market_coalesce_enabled),
    market_coalesce_minutes = COALESCE(
      CASE
        WHEN p_market_coalesce_minutes IS NULL THEN NULL
        ELSE GREATEST(p_market_coalesce_minutes, 1)
      END,
      market_coalesce_minutes
    ),
    official_webhook_url = COALESCE(p_official_webhook_url, official_webhook_url),
    official_webhook_name = COALESCE(p_official_webhook_name, official_webhook_name),
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_discord_settings(boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, text, text, boolean, boolean, int) TO authenticated;

DROP FUNCTION IF EXISTS public.get_discord_settings();

CREATE OR REPLACE FUNCTION public.get_discord_settings()
RETURNS TABLE (
  enabled boolean,
  orders_enabled boolean,
  order_new_enabled boolean,
  order_fulfilled_enabled boolean,
  order_cancelled_enabled boolean,
  blueprints_enabled boolean,
  support_enabled boolean,
  admin_enabled boolean,
  personal_discord_enabled boolean,
  market_coalesce_enabled boolean,
  market_coalesce_minutes int,
  official_webhook_url text,
  official_webhook_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ds.enabled,
    ds.orders_enabled,
    ds.order_new_enabled,
    ds.order_fulfilled_enabled,
    ds.order_cancelled_enabled,
    ds.blueprints_enabled,
    ds.support_enabled,
    ds.admin_enabled,
    ds.personal_discord_enabled,
    ds.market_coalesce_enabled,
    ds.market_coalesce_minutes,
    ds.official_webhook_url,
    ds.official_webhook_name
  FROM public.discord_settings ds
  WHERE ds.id = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_discord_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_discord_settings() TO service_role;
