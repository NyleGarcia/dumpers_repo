-- Fix Discord delivery failures from oversized itemized embeds and partial-abandon routing.

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
  v_bp record;
  v_res record;
  v_line_text text;
  v_field_name text;
  v_line_count int := 0;
  v_total_lines int := 0;
  v_overflow int := 0;
  -- Discord embed hard limit is 25 fields; reserve 3 for header + 1 for overflow note.
  v_max_line_fields int := 21;
BEGIN
  SELECT * INTO v_order FROM public.custom_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  v_poster := public.discord_profile_label(v_order.requester_id);

  v_fields := v_fields || jsonb_build_array(
    jsonb_build_object('name', 'Type', 'value', public.discord_listing_badge(v_order.listing_type), 'inline', true),
    jsonb_build_object('name', 'DFP Total', 'value', public.format_dfp_auec(v_order.total_dfp_auec), 'inline', true),
    jsonb_build_object('name', 'Posted by', 'value', left(v_poster, 256), 'inline', true)
  );

  SELECT
    (SELECT COUNT(*)::int FROM public.custom_order_blueprints WHERE order_id = p_order_id)
    + (SELECT COUNT(*)::int FROM public.custom_order_resource_lines WHERE order_id = p_order_id)
  INTO v_total_lines;

  FOR v_bp IN
    SELECT *
    FROM public.custom_order_blueprints
    WHERE order_id = p_order_id
    ORDER BY sort_order
  LOOP
    IF v_line_count >= v_max_line_fields THEN
      CONTINUE;
    END IF;

    v_field_name := left(
      COALESCE(v_bp.blueprint_title, v_bp.blueprint_id) || ' ×' || v_bp.quantity::text,
      256
    );

    v_line_text := public.discord_format_line_snapshot(v_bp.line_snapshot);

    IF v_line_text = '' OR v_line_text IS NULL THEN
      v_line_text := 'Q' || v_bp.min_quality::text;
      IF v_bp.slot_qualities IS NOT NULL AND v_bp.slot_qualities <> '{}'::jsonb THEN
        v_line_text := v_line_text || ' (custom slot mix)';
      END IF;
      v_line_text := v_line_text || E'\n' || public.format_dfp_auec(v_bp.line_dfp_auec);
    END IF;

    v_fields := v_fields || jsonb_build_array(
      jsonb_build_object('name', v_field_name, 'value', left(v_line_text, 1024), 'inline', false)
    );
    v_line_count := v_line_count + 1;
  END LOOP;

  FOR v_res IN
    SELECT *
    FROM public.custom_order_resource_lines
    WHERE order_id = p_order_id
    ORDER BY sort_order
  LOOP
    IF v_line_count >= v_max_line_fields THEN
      CONTINUE;
    END IF;

    v_field_name := left(COALESCE(v_res.resource_label, v_res.resource_key), 256);
    v_line_text := 'Q' || v_res.min_quality::text
      || ' · ' || v_res.quantity_scu::text || ' SCU'
      || E'\n' || public.format_dfp_auec(v_res.line_dfp_auec);

    v_fields := v_fields || jsonb_build_array(
      jsonb_build_object('name', v_field_name, 'value', left(v_line_text, 1024), 'inline', false)
    );
    v_line_count := v_line_count + 1;
  END LOOP;

  v_overflow := v_total_lines - v_line_count;
  IF v_overflow > 0 THEN
    v_fields := v_fields || jsonb_build_array(
      jsonb_build_object(
        'name', '+' || v_overflow::text || ' more item(s)',
        'value', 'Open the order on the site for the full line list.',
        'inline', false
      )
    );
  END IF;

  RETURN v_fields;
END;
$$;

-- Partial purchase abandon: include notify_user_id so personal Discord events queue.
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

  IF order_row.source_listing_id IS NOT NULL THEN
    PERFORM public.restore_wts_purchase_to_listing(p_order_id);

    UPDATE public.custom_orders
    SET status = 'cancelled', updated_at = now()
    WHERE id = p_order_id;

    INSERT INTO public.order_events (order_id, actor_id, event_type, details)
    VALUES (
      p_order_id, auth.uid(), 'abandoned',
      jsonb_build_object(
        'listing_type', order_row.listing_type,
        'partial', true,
        'source_listing_id', order_row.source_listing_id,
        'restored_to_listing', true,
        'notify_user_id', notify_user
      )
    );

    INSERT INTO public.order_events (order_id, actor_id, event_type, details)
    VALUES (
      order_row.source_listing_id, auth.uid(), 'partial_restored',
      jsonb_build_object('purchase_order_id', p_order_id)
    );
  ELSE
    UPDATE public.custom_orders
    SET status = 'pending', assignee_id = NULL, accepted_at = NULL, updated_at = now()
    WHERE id = p_order_id;

    INSERT INTO public.order_events (order_id, actor_id, event_type, details)
    VALUES (
      p_order_id, auth.uid(), 'abandoned',
      jsonb_build_object('listing_type', order_row.listing_type, 'notify_user_id', notify_user)
    );
  END IF;

  IF notify_user IS NOT NULL THEN
    PERFORM public.create_user_notification(
      notify_user, 'order_abandoned',
      CASE WHEN order_row.source_listing_id IS NOT NULL THEN 'Partial purchase cancelled' ELSE 'Order released' END,
      actor_name || CASE
        WHEN order_row.source_listing_id IS NOT NULL THEN ' cancelled the partial purchase — items returned to the listing: '
        ELSE ' released the order back to the pool: '
      END || order_row.title,
      jsonb_build_object('order_id', p_order_id, 'source_listing_id', order_row.source_listing_id)
    );
  END IF;
END;
$$;

-- Clearer copy for partial purchase releases in personal Discord lane.
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
  v_release_desc text;
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
      IF COALESCE((NEW.details->>'partial')::boolean, false) THEN
        v_release_desc := v_actor_name || ' cancelled the partial purchase — items returned to the listing';
      ELSE
        v_release_desc := v_actor_name || ' released the deal back to the pool';
      END IF;
      PERFORM public.queue_discord_message(
        'my_order_released',
        'Order released: ' || v_order.title,
        v_release_desc,
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
