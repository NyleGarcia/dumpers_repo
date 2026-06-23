-- Discord personal routing, marketplace feed, remove blueprints
-- Server-side queue via triggers on custom_orders / order_events

ALTER TABLE public.discord_message_queue
  ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actor_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_discord_queue_target_user
  ON public.discord_message_queue (target_user_id)
  WHERE target_user_id IS NOT NULL AND processed_at IS NULL;

ALTER TABLE public.discord_settings
  ADD COLUMN IF NOT EXISTS personal_discord_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.discord_message_queue
  DROP CONSTRAINT IF EXISTS discord_message_queue_event_type_check;

ALTER TABLE public.discord_message_queue
  ADD CONSTRAINT discord_message_queue_event_type_check
  CHECK (event_type IN (
    'orders', 'order_new', 'order_fulfilled', 'order_cancelled',
    'support', 'admin',
    'market_wtb_new', 'market_wts_new', 'market_accepted', 'market_cancelled',
    'my_order_accepted', 'my_order_in_progress', 'my_order_ready', 'my_order_completed',
    'my_order_cancelled', 'my_order_released', 'my_order_timeout', 'my_order_noshow', 'my_order_dispute',
    'my_support_reply', 'my_support_resolved'
  ));

DELETE FROM public.discord_message_queue
WHERE event_type = 'blueprints' AND processed_at IS NULL;

CREATE OR REPLACE FUNCTION public.discord_profile_label(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(rsi_handle, display_name, email, 'Member')
  FROM public.profiles
  WHERE id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.discord_listing_badge(p_listing_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN p_listing_type = 'wts' THEN 'WTS' ELSE 'WTB' END;
$$;

CREATE OR REPLACE FUNCTION public.discord_order_embed_fields(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.custom_orders%ROWTYPE;
  v_fields jsonb := '[]'::jsonb;
  v_poster text;
BEGIN
  SELECT * INTO v_order FROM public.custom_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  v_poster := public.discord_profile_label(v_order.requester_id);

  v_fields := v_fields || jsonb_build_array(
    jsonb_build_object('name', 'Type', 'value', public.discord_listing_badge(v_order.listing_type), 'inline', true),
    jsonb_build_object('name', 'DFP Total', 'value', public.format_dfp_auec(v_order.total_dfp_auec), 'inline', true),
    jsonb_build_object('name', 'Posted by', 'value', v_poster, 'inline', true)
  );

  RETURN v_fields;
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
    WHEN p_event_type LIKE 'my_order_%' OR p_event_type LIKE 'my_support_%' THEN v_settings.personal_discord_enabled
    WHEN p_event_type = 'support' THEN v_settings.support_enabled
    WHEN p_event_type = 'admin' THEN v_settings.admin_enabled
    ELSE true
  END;
END;
$$;

DROP FUNCTION IF EXISTS public.queue_discord_message(text, text, text, int, jsonb);

CREATE OR REPLACE FUNCTION public.queue_discord_message(
  p_event_type text,
  p_title text,
  p_description text DEFAULT NULL,
  p_color int DEFAULT 5814783,
  p_fields jsonb DEFAULT '[]'::jsonb,
  p_target_user_id uuid DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message_id uuid;
BEGIN
  IF NOT public.discord_event_enabled(p_event_type) THEN
    RETURN NULL;
  END IF;

  IF p_target_user_id IS NOT NULL
     AND p_actor_user_id IS NOT NULL
     AND p_target_user_id = p_actor_user_id THEN
    RETURN NULL;
  END IF;

  IF p_event_type LIKE 'my_%' AND p_target_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.discord_message_queue (
    event_type, title, description, color, fields, target_user_id, actor_user_id
  )
  VALUES (
    p_event_type, p_title, p_description, p_color, p_fields, p_target_user_id, p_actor_user_id
  )
  RETURNING id INTO v_message_id;

  RETURN v_message_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.queue_discord_message(text, text, text, int, jsonb, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.queue_discord_message(text, text, text, int, jsonb, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_discord_webhooks_for_personal_event(
  p_event_type text,
  p_target_user_id uuid
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
    AND dw.registered_by_user_id = p_target_user_id
    AND p_event_type = ANY(dw.subscribed_events);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_discord_webhooks_for_personal_event(text, uuid) TO service_role;

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
    AND p_event_type = ANY(dw.subscribed_events)
    AND (p_exclude_user_id IS NULL OR dw.registered_by_user_id IS DISTINCT FROM p_exclude_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_discord_webhooks_for_market_event(text, uuid) TO service_role;

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
  ORDER BY dmq.created_at ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_discord_messages(int) TO service_role;

DROP FUNCTION IF EXISTS public.update_discord_settings(boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, text, text);

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
  p_personal_discord_enabled boolean DEFAULT NULL
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
    official_webhook_url = COALESCE(p_official_webhook_url, official_webhook_url),
    official_webhook_name = COALESCE(p_official_webhook_name, official_webhook_name),
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_discord_settings(boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean, text, text, boolean) TO authenticated;

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
    ds.official_webhook_url,
    ds.official_webhook_name
  FROM public.discord_settings ds
  WHERE ds.id = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_discord_settings() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_discord_settings() TO authenticated;

CREATE OR REPLACE FUNCTION public.discord_user_valid_events()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'market_wtb_new', 'market_wts_new', 'market_accepted', 'market_cancelled',
    'my_order_accepted', 'my_order_in_progress', 'my_order_ready', 'my_order_completed',
    'my_order_cancelled', 'my_order_released', 'my_order_timeout', 'my_order_noshow', 'my_order_dispute',
    'my_support_reply', 'my_support_resolved'
  ]::text[];
$$;

CREATE OR REPLACE FUNCTION public.discord_default_user_events()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'my_order_accepted', 'my_order_ready', 'my_order_completed',
    'my_order_cancelled', 'my_order_released', 'my_order_timeout', 'my_order_noshow', 'my_order_dispute',
    'my_support_reply', 'my_support_resolved'
  ]::text[];
$$;

CREATE OR REPLACE FUNCTION public.discord_migrate_webhook_events(p_events text[])
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_result text[] := ARRAY[]::text[];
  v_event text;
BEGIN
  FOREACH v_event IN ARRAY COALESCE(p_events, ARRAY[]::text[]) LOOP
    IF v_event = 'order_new' OR v_event = 'orders' THEN
      v_result := v_result || ARRAY['market_wtb_new', 'market_wts_new'];
    ELSIF v_event = 'order_fulfilled' THEN
      v_result := v_result || ARRAY['my_order_accepted', 'market_accepted'];
    ELSIF v_event = 'order_cancelled' THEN
      v_result := v_result || ARRAY['my_order_cancelled', 'market_cancelled'];
    ELSIF v_event = ANY(public.discord_user_valid_events()) THEN
      v_result := array_append(v_result, v_event);
    END IF;
  END LOOP;

  SELECT ARRAY_AGG(DISTINCT e ORDER BY e)
  INTO v_result
  FROM unnest(v_result) AS e;

  RETURN COALESCE(v_result, public.discord_default_user_events());
END;
$$;

UPDATE public.discord_webhooks
SET subscribed_events = public.discord_migrate_webhook_events(subscribed_events);

DROP FUNCTION IF EXISTS public.register_discord_webhook(text, text, text[], text);

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
  v_existing_count int;
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

  IF EXISTS (SELECT 1 FROM public.discord_webhooks WHERE webhook_url = p_webhook_url) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This Discord channel is already registered');
  END IF;

  SELECT COUNT(*) INTO v_existing_count
  FROM public.discord_webhooks
  WHERE registered_by_user_id = v_user_id;

  IF v_existing_count >= 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have reached the maximum of 4 registered webhooks. Please delete one to add another.');
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

GRANT EXECUTE ON FUNCTION public.register_discord_webhook(text, text, text[], text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_my_discord_webhook(
  p_webhook_id uuid,
  p_webhook_name text DEFAULT NULL,
  p_subscribed_events text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valid_events text[] := public.discord_user_valid_events();
  v_filtered_events text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.discord_webhooks
    WHERE id = p_webhook_id AND registered_by_user_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Webhook not found or not owned by you');
  END IF;

  IF p_subscribed_events IS NOT NULL THEN
    SELECT ARRAY_AGG(e)
    INTO v_filtered_events
    FROM unnest(p_subscribed_events) e
    WHERE e = ANY(v_valid_events);

    IF v_filtered_events IS NULL OR array_length(v_filtered_events, 1) = 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'At least one valid event type required');
    END IF;
  END IF;

  UPDATE public.discord_webhooks
  SET
    webhook_name = COALESCE(p_webhook_name, webhook_name),
    subscribed_events = COALESCE(v_filtered_events, subscribed_events)
  WHERE id = p_webhook_id
    AND registered_by_user_id = auth.uid();

  RETURN jsonb_build_object('success', true);
END;
$$;

DROP FUNCTION IF EXISTS public.get_discord_public_event_types();

CREATE OR REPLACE FUNCTION public.get_discord_public_event_types()
RETURNS TABLE (
  event_type text,
  enabled boolean,
  display_name text,
  description text,
  event_category text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM (
    SELECT 'my_order_accepted'::text, ds.personal_discord_enabled, 'Someone accepted my listing'::text,
      'When a counterparty accepts your WTB or WTS'::text, 'personal'::text FROM public.discord_settings ds WHERE ds.id = 1
    UNION ALL
    SELECT 'my_order_in_progress', ds.personal_discord_enabled, 'Work started on my order',
      'When craft or sale work begins on your deal'::text, 'personal' FROM public.discord_settings ds WHERE ds.id = 1
    UNION ALL
    SELECT 'my_order_ready', ds.personal_discord_enabled, 'Ready for pickup',
      'When the seller marks your order ready'::text, 'personal' FROM public.discord_settings ds WHERE ds.id = 1
    UNION ALL
    SELECT 'my_order_completed', ds.personal_discord_enabled, 'Pickup confirmed',
      'When the buyer confirms pickup on your sale'::text, 'personal' FROM public.discord_settings ds WHERE ds.id = 1
    UNION ALL
    SELECT 'my_order_cancelled', ds.personal_discord_enabled, 'Counterparty cancelled',
      'When the other party cancels before completion'::text, 'personal' FROM public.discord_settings ds WHERE ds.id = 1
    UNION ALL
    SELECT 'my_order_released', ds.personal_discord_enabled, 'Counterparty released order',
      'When your deal is released back to the marketplace pool'::text, 'personal' FROM public.discord_settings ds WHERE ds.id = 1
    UNION ALL
    SELECT 'my_order_timeout', ds.personal_discord_enabled, 'Timeout / auto-released',
      'When a deal times out and returns to the pool'::text, 'personal' FROM public.discord_settings ds WHERE ds.id = 1
    UNION ALL
    SELECT 'my_order_noshow', ds.personal_discord_enabled, 'No-show',
      'When pickup deadline is missed'::text, 'personal' FROM public.discord_settings ds WHERE ds.id = 1
    UNION ALL
    SELECT 'my_order_dispute', ds.personal_discord_enabled, 'Dispute opened',
      'When a dispute is opened on your order'::text, 'personal' FROM public.discord_settings ds WHERE ds.id = 1
    UNION ALL
    SELECT 'my_support_reply', ds.personal_discord_enabled, 'Support ticket reply',
      'When staff responds on your support ticket'::text, 'support' FROM public.discord_settings ds WHERE ds.id = 1
    UNION ALL
    SELECT 'my_support_resolved', ds.personal_discord_enabled, 'Support ticket resolved',
      'When staff closes your support ticket'::text, 'support' FROM public.discord_settings ds WHERE ds.id = 1
    UNION ALL
    SELECT 'market_wtb_new', ds.order_new_enabled, 'New WTB listings',
      'When anyone posts a new want-to-buy listing'::text, 'marketplace' FROM public.discord_settings ds WHERE ds.id = 1
    UNION ALL
    SELECT 'market_wts_new', ds.order_new_enabled, 'New WTS listings',
      'When anyone posts a new want-to-sell listing'::text, 'marketplace' FROM public.discord_settings ds WHERE ds.id = 1
    UNION ALL
    SELECT 'market_accepted', ds.order_fulfilled_enabled, 'Listing accepted',
      'When any marketplace listing is accepted'::text, 'marketplace' FROM public.discord_settings ds WHERE ds.id = 1
    UNION ALL
    SELECT 'market_cancelled', ds.order_cancelled_enabled, 'Listing cancelled',
      'When any pending listing is cancelled'::text, 'marketplace' FROM public.discord_settings ds WHERE ds.id = 1
  ) t;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_discord_public_event_types() TO anon;
GRANT EXECUTE ON FUNCTION public.get_discord_public_event_types() TO authenticated;

-- Triggers + patched RPCs (continued in same migration)

CREATE OR REPLACE FUNCTION public.trg_discord_new_custom_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event text;
  v_title text;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  IF NEW.listing_type = 'wts' THEN
    v_event := 'market_wts_new';
    v_title := 'New WTS Listing';
  ELSE
    v_event := 'market_wtb_new';
    v_title := 'New WTB Listing';
  END IF;

  PERFORM public.queue_discord_message(
    v_event,
    v_title || ': ' || NEW.title,
    public.discord_listing_badge(NEW.listing_type) || ' · ' || public.format_dfp_auec(NEW.total_dfp_auec),
    5814783,
    public.discord_order_embed_fields(NEW.id),
    NULL,
    NEW.requester_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_discord_new_custom_order ON public.custom_orders;
CREATE TRIGGER trigger_discord_new_custom_order
  AFTER INSERT ON public.custom_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_discord_new_custom_order();

CREATE OR REPLACE FUNCTION public.trg_discord_delete_custom_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'pending' AND OLD.assignee_id IS NULL THEN
    PERFORM public.queue_discord_message(
      'market_cancelled',
      'Listing Cancelled: ' || OLD.title,
      public.discord_listing_badge(OLD.listing_type) || ' · ' || public.format_dfp_auec(OLD.total_dfp_auec),
      15548997,
      public.discord_order_embed_fields(OLD.id),
      NULL,
      OLD.requester_id
    );
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_discord_delete_custom_order ON public.custom_orders;
CREATE TRIGGER trigger_discord_delete_custom_order
  BEFORE DELETE ON public.custom_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_discord_delete_custom_order();

CREATE OR REPLACE FUNCTION public.trg_discord_order_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.custom_orders%ROWTYPE;
  v_notify uuid;
  v_actor uuid;
  v_actor_name text;
  v_price text;
BEGIN
  SELECT * INTO v_order FROM public.custom_orders WHERE id = NEW.order_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_actor := NEW.actor_id;
  v_price := public.format_dfp_auec(v_order.total_dfp_auec);

  CASE NEW.event_type
    WHEN 'accepted' THEN
      PERFORM public.queue_discord_message(
        'my_order_accepted',
        'Your listing was accepted: ' || v_order.title,
        public.discord_profile_label(v_actor) || ' accepted · ' || v_price,
        5793266,
        public.discord_order_embed_fields(v_order.id),
        v_order.requester_id,
        v_actor
      );
      PERFORM public.queue_discord_message(
        'market_accepted',
        'Listing Accepted: ' || v_order.title,
        public.discord_profile_label(v_actor) || ' accepted · ' || v_price,
        5793266,
        public.discord_order_embed_fields(v_order.id),
        NULL,
        v_actor
      );

    WHEN 'in_progress' THEN
      IF v_order.listing_type = 'wts' THEN
        v_notify := v_order.assignee_id;
      ELSE
        v_notify := v_order.requester_id;
      END IF;
      PERFORM public.queue_discord_message(
        'my_order_in_progress',
        'Work started: ' || v_order.title,
        public.discord_profile_label(v_actor) || ' started work',
        3447003,
        public.discord_order_embed_fields(v_order.id),
        v_notify,
        v_actor
      );

    WHEN 'craft_completed', 'resources_deducted' THEN
      IF v_order.listing_type = 'wts' THEN
        v_notify := v_order.assignee_id;
      ELSE
        v_notify := v_order.requester_id;
      END IF;
      PERFORM public.queue_discord_message(
        'my_order_ready',
        'Ready for pickup: ' || v_order.title,
        public.discord_profile_label(v_actor) || ' marked ready · ' || v_price,
        15844367,
        public.discord_order_embed_fields(v_order.id),
        v_notify,
        v_actor
      );

    WHEN 'completed' THEN
      IF v_order.listing_type = 'wts' THEN
        v_notify := v_order.requester_id;
      ELSE
        v_notify := v_order.assignee_id;
      END IF;
      v_actor_name := public.discord_profile_label(v_actor);
      PERFORM public.queue_discord_message(
        'my_order_completed',
        'Pickup confirmed: ' || v_order.title,
        v_actor_name || ' confirmed pickup',
        5763719,
        public.discord_order_embed_fields(v_order.id),
        v_notify,
        v_actor
      );

    WHEN 'abandoned' THEN
      v_notify := NULLIF(NEW.details->>'notify_user_id', '')::uuid;
      v_actor_name := public.discord_profile_label(v_actor);
      PERFORM public.queue_discord_message(
        'my_order_released',
        'Order released: ' || v_order.title,
        v_actor_name || ' released the deal back to the pool',
        15105570,
        public.discord_order_embed_fields(v_order.id),
        v_notify,
        v_actor
      );

    WHEN 'fulfiller_timeout' THEN
      PERFORM public.queue_discord_message(
        'my_order_timeout',
        'Order released (timeout): ' || v_order.title,
        'Fulfiller timed out — listing returned to the pool',
        15105570,
        public.discord_order_embed_fields(v_order.id),
        v_order.requester_id,
        NULL
      );

    WHEN 'buyer_noshow' THEN
      PERFORM public.queue_discord_message(
        'my_order_noshow',
        'Pickup deadline missed: ' || v_order.title,
        'Order auto-completed due to missed pickup',
        15105570,
        public.discord_order_embed_fields(v_order.id),
        v_order.requester_id,
        NULL
      );
      IF v_order.assignee_id IS NOT NULL THEN
        PERFORM public.queue_discord_message(
          'my_order_noshow',
          'Buyer no-show: ' || v_order.title,
          'Buyer did not confirm pickup in time',
          15105570,
          public.discord_order_embed_fields(v_order.id),
          v_order.assignee_id,
          NULL
        );
      END IF;

    ELSE
      NULL;
  END CASE;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_discord_order_event ON public.order_events;
CREATE TRIGGER trigger_discord_order_event
  AFTER INSERT ON public.order_events
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_discord_order_event();

CREATE OR REPLACE FUNCTION public.abandon_custom_order_fulfillment(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  order_row public.custom_orders%ROWTYPE;
  actor_name text;
  notify_user uuid;
BEGIN
  IF NOT public.can_fulfill_orders() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  SELECT * INTO order_row FROM public.custom_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF order_row.status NOT IN ('accepted', 'in_progress') THEN
    RAISE EXCEPTION 'Only accepted or in-progress orders can be abandoned';
  END IF;

  IF order_row.listing_type = 'wts' THEN
    IF auth.uid() NOT IN (order_row.requester_id, order_row.assignee_id) THEN
      RAISE EXCEPTION 'Only the seller or buyer can abandon this listing';
    END IF;
    notify_user := CASE WHEN auth.uid() = order_row.requester_id THEN order_row.assignee_id ELSE order_row.requester_id END;
  ELSE
    IF order_row.assignee_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Only the assigned fulfiller can abandon this order';
    END IF;
    notify_user := order_row.requester_id;
  END IF;

  SELECT COALESCE(rsi_handle, display_name, email, 'A member') INTO actor_name FROM public.profiles WHERE id = auth.uid();

  UPDATE public.custom_orders
  SET status = 'pending', assignee_id = NULL, accepted_at = NULL, updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.order_events (order_id, actor_id, event_type, details)
  VALUES (
    p_order_id, auth.uid(), 'abandoned',
    jsonb_build_object('listing_type', order_row.listing_type, 'notify_user_id', notify_user)
  );

  IF notify_user IS NOT NULL THEN
    PERFORM public.create_user_notification(
      notify_user, 'order_abandoned', 'Order released',
      actor_name || ' released the order back to the pool: ' || order_row.title,
      jsonb_build_object('order_id', p_order_id)
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_ticket_message(p_ticket_id uuid, p_content text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_staff boolean;
  v_user_role text;
  v_ticket record;
  v_officer_id uuid;
BEGIN
  SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
  v_is_staff := v_user_role IN ('officer', 'super-admin');

  SELECT * INTO v_ticket
  FROM public.support_tickets
  WHERE id = p_ticket_id
  AND (requester_id = auth.uid() OR v_is_staff);

  IF v_ticket IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket not found or access denied');
  END IF;

  INSERT INTO public.ticket_messages (ticket_id, author_id, content, is_staff)
  VALUES (p_ticket_id, auth.uid(), p_content, v_is_staff);

  UPDATE public.support_tickets SET updated_at = now() WHERE id = p_ticket_id;

  IF v_is_staff THEN
    PERFORM public.create_user_notification(
      v_ticket.requester_id,
      'support_ticket_update',
      'Support Ticket Updated',
      'Staff responded to: ' || v_ticket.subject,
      jsonb_build_object('ticket_id', p_ticket_id)
    );

    PERFORM public.queue_discord_message(
      'my_support_reply',
      'Support reply: ' || v_ticket.subject,
      left(trim(p_content), 500),
      10181046,
      jsonb_build_array(
        jsonb_build_object('name', 'Ticket', 'value', left(v_ticket.subject, 256), 'inline', false)
      ),
      v_ticket.requester_id,
      auth.uid()
    );
  ELSE
    IF v_ticket.assignee_id IS NOT NULL THEN
      PERFORM public.create_user_notification(
        v_ticket.assignee_id,
        'support_ticket_update',
        'Ticket Response',
        'Member responded to: ' || v_ticket.subject,
        jsonb_build_object('ticket_id', p_ticket_id)
      );
    ELSE
      FOR v_officer_id IN
        SELECT id FROM public.profiles
        WHERE role IN ('officer', 'super-admin')
        AND id != auth.uid()
      LOOP
        PERFORM public.create_user_notification(
          v_officer_id,
          'support_ticket_update',
          'Ticket Response',
          'Member responded to: ' || v_ticket.subject,
          jsonb_build_object('ticket_id', p_ticket_id)
        );
      END LOOP;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_discord_support_resolved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved' THEN
    PERFORM public.queue_discord_message(
      'my_support_resolved',
      'Support ticket resolved: ' || NEW.subject,
      'Your ticket has been closed. Please rate your support experience when you can.',
      5763719,
      jsonb_build_array(
        jsonb_build_object('name', 'Category', 'value', NEW.category, 'inline', true)
      ),
      NEW.requester_id,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_discord_support_resolved ON public.support_tickets;
CREATE TRIGGER trigger_discord_support_resolved
  AFTER UPDATE OF status ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_discord_support_resolved();

CREATE OR REPLACE FUNCTION public.report_order_dispute(
  p_order_id uuid,
  p_description text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_row public.custom_orders%ROWTYPE;
  v_ticket_id uuid;
  v_body text;
  v_buyer_name text;
  v_fulfiller_name text;
  v_officer_id uuid;
BEGIN
  IF NULLIF(trim(p_description), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Description required');
  END IF;

  SELECT * INTO order_row FROM public.custom_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF order_row.requester_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the buyer can report a problem');
  END IF;

  IF order_row.status <> 'ready_for_pickup' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order is not ready for pickup');
  END IF;

  IF order_row.dispute_opened_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'A dispute is already open for this order');
  END IF;

  IF order_row.assignee_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order has no fulfiller assigned');
  END IF;

  SELECT COALESCE(rsi_handle, display_name, email, 'Buyer') INTO v_buyer_name
  FROM public.profiles WHERE id = order_row.requester_id;

  SELECT COALESCE(rsi_handle, display_name, email, 'Fulfiller') INTO v_fulfiller_name
  FROM public.profiles WHERE id = order_row.assignee_id;

  v_body := 'Order dispute report:' || E'\n\n';
  v_body := v_body || 'Order: ' || order_row.title || E'\n';
  v_body := v_body || 'Order ID: ' || p_order_id || E'\n';
  v_body := v_body || 'Buyer: ' || v_buyer_name || E'\n';
  v_body := v_body || 'Fulfiller: ' || v_fulfiller_name || E'\n';
  v_body := v_body || E'\nBuyer description:' || E'\n' || trim(p_description);
  v_body := v_body || E'\n\nEvidence is not uploaded on-site. Officers may request screenshots via email or cloud storage links.';

  INSERT INTO public.support_tickets (
    requester_id, category, subject, reported_user_id, status
  )
  VALUES (
    auth.uid(),
    'member_report',
    'Order dispute: ' || order_row.title,
    order_row.assignee_id,
    'open'
  )
  RETURNING id INTO v_ticket_id;

  INSERT INTO public.ticket_messages (ticket_id, author_id, content, is_staff)
  VALUES (v_ticket_id, auth.uid(), v_body, false);

  UPDATE public.custom_orders
  SET dispute_opened_at = now(), dispute_ticket_id = v_ticket_id, updated_at = now()
  WHERE id = p_order_id;

  FOR v_officer_id IN
    SELECT id FROM public.profiles
    WHERE role IN ('officer', 'super-admin') AND id != auth.uid()
  LOOP
    PERFORM public.create_user_notification(
      v_officer_id,
      'support_ticket_new',
      'Order Dispute',
      'Order dispute: ' || order_row.title,
      jsonb_build_object('ticket_id', v_ticket_id, 'order_id', p_order_id)
    );
  END LOOP;

  PERFORM public.create_user_notification(
    order_row.assignee_id,
    'order_dispute',
    'Order dispute opened',
    v_buyer_name || ' reported a problem with: ' || order_row.title,
    jsonb_build_object('order_id', p_order_id, 'ticket_id', v_ticket_id)
  );

  PERFORM public.queue_discord_message(
    'my_order_dispute',
    'Dispute opened: ' || order_row.title,
    v_buyer_name || ' reported a problem · ' || public.format_dfp_auec(order_row.total_dfp_auec),
    15548997,
    public.discord_order_embed_fields(p_order_id),
    order_row.assignee_id,
    auth.uid()
  );

  RETURN jsonb_build_object('success', true, 'ticket_id', v_ticket_id);
END;
$$;
