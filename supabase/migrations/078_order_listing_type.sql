-- =============================================================================
-- Migration 078: WTB/WTS listing_type on custom_orders
-- Unified order form posts buy (wtb) or sell (wts) listings; semantic rep roles
-- =============================================================================

ALTER TABLE public.custom_orders
  ADD COLUMN IF NOT EXISTS listing_type text NOT NULL DEFAULT 'wtb'
  CHECK (listing_type IN ('wtb', 'wts'));

CREATE INDEX IF NOT EXISTS custom_orders_listing_pending_idx
  ON public.custom_orders (listing_type, status, created_at DESC)
  WHERE status = 'pending';

-- Semantic buyer active orders (WTB as requester, WTS as assignee after accept)
CREATE OR REPLACE FUNCTION public.get_active_buyer_order_count(p_user_id uuid)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.custom_orders
  WHERE status IN ('pending', 'accepted', 'in_progress', 'ready_for_pickup')
    AND (
      (listing_type = 'wtb' AND requester_id = p_user_id)
      OR (listing_type = 'wts' AND assignee_id = p_user_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.get_active_buyer_order_total(p_user_id uuid)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(SUM(total_dfp_auec), 0)::bigint
  FROM public.custom_orders
  WHERE status IN ('pending', 'accepted', 'in_progress', 'ready_for_pickup')
    AND (
      (listing_type = 'wtb' AND requester_id = p_user_id)
      OR (listing_type = 'wts' AND assignee_id = p_user_id)
    );
$$;

-- Semantic seller active fulfillments
CREATE OR REPLACE FUNCTION public.get_active_fulfiller_order_count(p_user_id uuid)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.custom_orders
  WHERE status IN ('accepted', 'in_progress', 'ready_for_pickup')
    AND (
      (listing_type = 'wtb' AND assignee_id = p_user_id)
      OR (listing_type = 'wts' AND requester_id = p_user_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.get_active_fulfiller_count(p_user_id uuid)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.get_active_fulfiller_order_count(p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.has_pending_buyer_rep(p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (
    SELECT COUNT(*)::int
    FROM public.custom_orders
    WHERE status IN ('completed', 'archived')
      AND (
        (listing_type = 'wtb' AND requester_id = p_user_id)
        OR (listing_type = 'wts' AND assignee_id = p_user_id)
      )
  ) < 5;
$$;

CREATE OR REPLACE FUNCTION public.has_pending_fulfiller_rep(p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT (
    SELECT COUNT(*)::int
    FROM public.custom_orders
    WHERE status IN ('completed', 'archived')
      AND (
        (listing_type = 'wtb' AND assignee_id = p_user_id)
        OR (listing_type = 'wts' AND requester_id = p_user_id)
      )
  ) < 5;
$$;

CREATE OR REPLACE FUNCTION public.user_buyer_reputation(p_user_id uuid)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN (
      SELECT COUNT(*)::int
      FROM public.custom_orders
      WHERE status IN ('completed', 'archived')
        AND (
          (listing_type = 'wtb' AND requester_id = p_user_id)
          OR (listing_type = 'wts' AND assignee_id = p_user_id)
        )
    ) < 5 THEN NULL
    ELSE (
      SELECT ROUND(AVG(r.stars))::int
      FROM public.custom_order_ratings r
      WHERE r.ratee_id = p_user_id AND r.rater_role = 'fulfiller'
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.user_fulfiller_reputation(p_user_id uuid)
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN (
      SELECT COUNT(*)::int
      FROM public.custom_orders
      WHERE status IN ('completed', 'archived')
        AND (
          (listing_type = 'wtb' AND assignee_id = p_user_id)
          OR (listing_type = 'wts' AND requester_id = p_user_id)
        )
    ) < 5 THEN NULL
    ELSE (
      SELECT ROUND(AVG(r.stars))::int
      FROM public.custom_order_ratings r
      WHERE r.ratee_id = p_user_id AND r.rater_role = 'requester'
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_member_reputations(p_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  buyer_completed_count int,
  buyer_rating_count int,
  buyer_reputation int,
  buyer_is_pending boolean,
  fulfiller_completed_count int,
  fulfiller_rating_count int,
  fulfiller_reputation int,
  fulfiller_is_pending boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH users AS (
    SELECT DISTINCT uid FROM unnest(COALESCE(p_user_ids, ARRAY[]::uuid[])) AS uid WHERE uid IS NOT NULL
  ),
  buyer_completed AS (
    SELECT o.requester_id AS user_id, COUNT(*)::int AS cnt
    FROM public.custom_orders o
    INNER JOIN users u ON u.uid = o.requester_id
    WHERE o.status IN ('completed', 'archived') AND o.listing_type = 'wtb'
    GROUP BY o.requester_id
    UNION ALL
    SELECT o.assignee_id AS user_id, COUNT(*)::int AS cnt
    FROM public.custom_orders o
    INNER JOIN users u ON u.uid = o.assignee_id
    WHERE o.status IN ('completed', 'archived') AND o.listing_type = 'wts' AND o.assignee_id IS NOT NULL
    GROUP BY o.assignee_id
  ),
  buyer_completed_agg AS (
    SELECT user_id, SUM(cnt)::int AS cnt FROM buyer_completed GROUP BY user_id
  ),
  fulfiller_completed AS (
    SELECT o.assignee_id AS user_id, COUNT(*)::int AS cnt
    FROM public.custom_orders o
    INNER JOIN users u ON u.uid = o.assignee_id
    WHERE o.status IN ('completed', 'archived') AND o.listing_type = 'wtb' AND o.assignee_id IS NOT NULL
    GROUP BY o.assignee_id
    UNION ALL
    SELECT o.requester_id AS user_id, COUNT(*)::int AS cnt
    FROM public.custom_orders o
    INNER JOIN users u ON u.uid = o.requester_id
    WHERE o.status IN ('completed', 'archived') AND o.listing_type = 'wts'
    GROUP BY o.requester_id
  ),
  fulfiller_completed_agg AS (
    SELECT user_id, SUM(cnt)::int AS cnt FROM fulfiller_completed GROUP BY user_id
  ),
  buyer_ratings AS (
    SELECT r.ratee_id AS user_id, COUNT(*)::int AS cnt, ROUND(AVG(r.stars))::int AS avg_stars
    FROM public.custom_order_ratings r
    INNER JOIN users u ON u.uid = r.ratee_id
    WHERE r.rater_role = 'fulfiller'
    GROUP BY r.ratee_id
  ),
  fulfiller_ratings AS (
    SELECT r.ratee_id AS user_id, COUNT(*)::int AS cnt, ROUND(AVG(r.stars))::int AS avg_stars
    FROM public.custom_order_ratings r
    INNER JOIN users u ON u.uid = r.ratee_id
    WHERE r.rater_role = 'requester'
    GROUP BY r.ratee_id
  )
  SELECT
    u.uid AS user_id,
    COALESCE(bc.cnt, 0) AS buyer_completed_count,
    COALESCE(br.cnt, 0) AS buyer_rating_count,
    CASE WHEN COALESCE(bc.cnt, 0) < 5 OR COALESCE(br.cnt, 0) < 1 THEN NULL ELSE br.avg_stars END AS buyer_reputation,
    (COALESCE(bc.cnt, 0) < 5 OR COALESCE(br.cnt, 0) < 1) AS buyer_is_pending,
    COALESCE(fc.cnt, 0) AS fulfiller_completed_count,
    COALESCE(fr.cnt, 0) AS fulfiller_rating_count,
    CASE WHEN COALESCE(fc.cnt, 0) < 5 OR COALESCE(fr.cnt, 0) < 1 THEN NULL ELSE fr.avg_stars END AS fulfiller_reputation,
    (COALESCE(fc.cnt, 0) < 5 OR COALESCE(fr.cnt, 0) < 1) AS fulfiller_is_pending
  FROM users u
  LEFT JOIN buyer_completed_agg bc ON bc.user_id = u.uid
  LEFT JOIN fulfiller_completed_agg fc ON fc.user_id = u.uid
  LEFT JOIN buyer_ratings br ON br.user_id = u.uid
  LEFT JOIN fulfiller_ratings fr ON fr.user_id = u.uid;
$$;

CREATE OR REPLACE FUNCTION public.get_user_order_limits(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_unrated_count int;
  v_buyer_order_count int;
  v_buyer_order_total bigint;
  v_fulfillment_count int;
  v_has_pending_buyer_rep boolean;
  v_has_pending_fulfiller_rep boolean;
BEGIN
  v_unrated_count := public.get_unrated_order_count(p_user_id);
  v_buyer_order_count := public.get_active_buyer_order_count(p_user_id);
  v_buyer_order_total := public.get_active_buyer_order_total(p_user_id);
  v_fulfillment_count := public.get_active_fulfiller_count(p_user_id);
  v_has_pending_buyer_rep := public.has_pending_buyer_rep(p_user_id);
  v_has_pending_fulfiller_rep := public.has_pending_fulfiller_rep(p_user_id);

  RETURN jsonb_build_object(
    'unrated_count', v_unrated_count,
    'buyer_order_count', v_buyer_order_count,
    'buyer_order_total', v_buyer_order_total,
    'fulfillment_count', v_fulfillment_count,
    'has_pending_buyer_rep', v_has_pending_buyer_rep,
    'has_pending_fulfiller_rep', v_has_pending_fulfiller_rep,
    'buyer_order_limit', 2,
    'buyer_auec_limit', 1000000,
    'fulfiller_order_limit', 1,
    'can_create_order', (
      v_unrated_count = 0
      AND (NOT v_has_pending_buyer_rep OR (v_buyer_order_count < 2 AND v_buyer_order_total < 1000000))
    ),
    'can_create_sell_order', (v_unrated_count = 0),
    'can_accept_order', (
      v_unrated_count = 0
      AND (NOT v_has_pending_fulfiller_rep OR v_fulfillment_count < 1)
    ),
    'can_accept_wts_order', (
      v_unrated_count = 0
      AND (NOT v_has_pending_buyer_rep OR (v_buyer_order_count < 2 AND (v_buyer_order_total < 1000000)))
    )
  );
END;
$$;

-- create_custom_order with p_listing_type (wtb | wts)
CREATE OR REPLACE FUNCTION public.create_custom_order(
  p_title text,
  p_notes text DEFAULT NULL,
  p_total_dfp_auec bigint DEFAULT 0,
  p_min_fulfiller_reputation int DEFAULT NULL,
  p_blueprints jsonb DEFAULT '[]'::jsonb,
  p_resources jsonb DEFAULT '[]'::jsonb,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_listing_type text DEFAULT 'wtb'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_rsi_verified boolean;
  v_unrated_count int;
  v_has_pending_rep boolean;
  v_active_count int;
  v_active_total bigint;
  v_order_id uuid;
  v_bp jsonb;
  v_res jsonb;
  v_item jsonb;
  v_bp_idx int := 0;
  v_res_idx int := 0;
  v_first_bp_id text;
  v_is_single_bp boolean;
  v_dupe_check jsonb;
  v_abuse_track jsonb;
  v_listing_type text;
BEGIN
  v_user_id := auth.uid();
  v_listing_type := COALESCE(NULLIF(trim(p_listing_type), ''), 'wtb');

  IF v_listing_type NOT IN ('wtb', 'wts') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid listing type');
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  IF NOT public.can_access_preview_features() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Feature access required');
  END IF;

  SELECT rsi_handle_verified INTO v_rsi_verified FROM public.profiles WHERE id = v_user_id;
  IF NOT COALESCE(v_rsi_verified, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'RSI Handle verification required');
  END IF;

  v_unrated_count := public.get_unrated_order_count(v_user_id);
  IF v_unrated_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'Rate your completed orders first',
      'error_type', 'unrated', 'unrated_count', v_unrated_count
    );
  END IF;

  IF jsonb_array_length(p_blueprints) = 0 AND jsonb_array_length(p_resources) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Add at least one blueprint or resource');
  END IF;

  v_is_single_bp := jsonb_array_length(p_blueprints) = 1 AND jsonb_array_length(p_resources) = 0;
  IF v_is_single_bp THEN
    v_first_bp_id := p_blueprints->0->>'blueprint_id';
  END IF;

  -- Buyer pending-rep limits apply only to WTB posts
  IF v_listing_type = 'wtb' THEN
    v_has_pending_rep := public.has_pending_buyer_rep(v_user_id);
    IF v_has_pending_rep THEN
      IF COALESCE(p_total_dfp_auec, 0) < 10000 THEN
        RETURN jsonb_build_object(
          'success', false, 'error', 'Minimum order value is 10,000 aUEC while reputation is pending',
          'error_type', 'min_value', 'min_value', 10000
        );
      END IF;

      IF v_is_single_bp THEN
        v_dupe_check := public.check_duplicate_single_bp_order(v_user_id, v_first_bp_id);
        IF (v_dupe_check->>'has_duplicate')::boolean THEN
          IF v_dupe_check->>'duplicate_type' = 'pending' THEN
            RETURN jsonb_build_object(
              'success', false,
              'error', 'Pending order found with same Blueprint. Pulling your existing order back for editing.',
              'error_type', 'duplicate_pending',
              'existing_order_id', v_dupe_check->>'existing_order_id'
            );
          ELSE
            v_abuse_track := public.track_abuse_attempt(v_user_id, v_first_bp_id);
            IF (v_abuse_track->>'should_report')::boolean THEN
              PERFORM public.create_abuse_report(v_user_id, v_first_bp_id, (v_abuse_track->>'attempt_count')::int);
            END IF;
            RETURN jsonb_build_object(
              'success', false,
              'error', 'You already have an active order for this blueprint being fulfilled. Please wait for it to complete.',
              'error_type', 'duplicate_active',
              'existing_order_id', v_dupe_check->>'existing_order_id',
              'attempt_count', v_abuse_track->>'attempt_count'
            );
          END IF;
        END IF;
      END IF;

      v_active_count := public.get_active_buyer_order_count(v_user_id);
      IF v_active_count >= 2 THEN
        RETURN jsonb_build_object(
          'success', false, 'error', 'Order limit reached', 'error_type', 'order_limit',
          'detail', 'Max 2 active orders while reputation is pending'
        );
      END IF;

      v_active_total := public.get_active_buyer_order_total(v_user_id);
      IF (v_active_total + COALESCE(p_total_dfp_auec, 0)) > 1000000 THEN
        RETURN jsonb_build_object(
          'success', false, 'error', 'Order limit reached', 'error_type', 'auec_limit',
          'detail', 'Max 1,000,000 aUEC total while reputation is pending'
        );
      END IF;
    END IF;
  END IF;

  INSERT INTO public.custom_orders (
    requester_id, title, notes, total_dfp_auec, min_fulfiller_reputation,
    blueprint_id, min_quality, quantity, status, listing_type
  )
  VALUES (
    v_user_id, trim(p_title), nullif(trim(p_notes), ''), COALESCE(p_total_dfp_auec, 0),
    p_min_fulfiller_reputation, v_first_bp_id,
    COALESCE((p_blueprints->0->>'min_quality')::int, 500),
    COALESCE((p_blueprints->0->>'quantity')::int, 1),
    'pending', v_listing_type
  )
  RETURNING id INTO v_order_id;

  FOR v_bp IN SELECT * FROM jsonb_array_elements(p_blueprints) LOOP
    INSERT INTO public.custom_order_blueprints (
      order_id, blueprint_id, blueprint_title, min_quality, slot_qualities,
      quantity, unit_dfp_auec, line_dfp_auec, sort_order
    ) VALUES (
      v_order_id, v_bp->>'blueprint_id', v_bp->>'blueprint_title',
      COALESCE((v_bp->>'min_quality')::int, 500), v_bp->'slot_qualities',
      COALESCE((v_bp->>'quantity')::int, 1),
      COALESCE((v_bp->>'unit_dfp_auec')::bigint, 0),
      COALESCE((v_bp->>'line_dfp_auec')::bigint, 0), v_bp_idx
    );
    v_bp_idx := v_bp_idx + 1;
  END LOOP;

  FOR v_res IN SELECT * FROM jsonb_array_elements(p_resources) LOOP
    INSERT INTO public.custom_order_resource_lines (
      order_id, resource_key, resource_label, min_quality, quantity_scu,
      unit_dfp_auec, line_dfp_auec, sort_order
    ) VALUES (
      v_order_id, v_res->>'resource_key', v_res->>'resource_label',
      COALESCE((v_res->>'min_quality')::int, 500),
      COALESCE((v_res->>'quantity_scu')::numeric, 1),
      COALESCE((v_res->>'unit_dfp_auec')::bigint, 0),
      COALESCE((v_res->>'line_dfp_auec')::bigint, 0), v_res_idx
    );
    v_res_idx := v_res_idx + 1;
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.custom_order_items (order_id, resource_key, quantity)
    VALUES (v_order_id, v_item->>'resource_key', COALESCE((v_item->>'quantity')::numeric, 1));
  END LOOP;

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'listing_type', v_listing_type);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_custom_order(text, text, bigint, int, jsonb, jsonb, jsonb, text) TO authenticated;

-- accept_custom_order: WTB = fulfiller accepts; WTS = buyer accepts
CREATE OR REPLACE FUNCTION public.accept_custom_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  order_row public.custom_orders%ROWTYPE;
  bp_row record;
  assignee_name text;
  price_label text;
  fulfiller_rep int;
  fulfiller_completed int;
  buyer_rep int;
  buyer_completed int;
  v_rsi_verified boolean;
  v_unrated_count int;
  v_has_pending_rep boolean;
  v_active_count int;
  v_active_total bigint;
BEGIN
  IF NOT public.can_fulfill_orders() THEN
    RAISE EXCEPTION 'Permission denied: fulfillment access required';
  END IF;

  SELECT rsi_handle_verified INTO v_rsi_verified FROM public.profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_rsi_verified, false) THEN
    RAISE EXCEPTION 'RSI Handle verification required';
  END IF;

  v_unrated_count := public.get_unrated_order_count(auth.uid());
  IF v_unrated_count > 0 THEN
    RAISE EXCEPTION 'Rate your completed orders first (%) pending', v_unrated_count;
  END IF;

  SELECT * INTO order_row FROM public.custom_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF order_row.status <> 'pending' THEN RAISE EXCEPTION 'Only pending orders can be accepted'; END IF;
  IF order_row.requester_id = auth.uid() THEN RAISE EXCEPTION 'You cannot accept your own order'; END IF;

  IF order_row.listing_type = 'wts' THEN
    v_has_pending_rep := public.has_pending_buyer_rep(auth.uid());
    IF v_has_pending_rep THEN
      v_active_count := public.get_active_buyer_order_count(auth.uid());
      IF v_active_count >= 2 THEN
        RAISE EXCEPTION 'Order limit reached: max 2 active purchases while reputation is pending';
      END IF;
      v_active_total := public.get_active_buyer_order_total(auth.uid());
      IF (v_active_total + order_row.total_dfp_auec) > 1000000 THEN
        RAISE EXCEPTION 'Order limit reached: max 1,000,000 aUEC total while reputation is pending';
      END IF;
    END IF;

    IF order_row.min_fulfiller_reputation IS NOT NULL THEN
      SELECT COUNT(*)::int INTO buyer_completed
      FROM public.custom_orders
      WHERE assignee_id = auth.uid() AND listing_type = 'wts'
        AND status IN ('completed', 'archived');
      IF buyer_completed >= 5 THEN
        buyer_rep := public.user_buyer_reputation(auth.uid());
        IF buyer_rep IS NOT NULL AND buyer_rep < order_row.min_fulfiller_reputation THEN
          RAISE EXCEPTION 'Your buyer reputation (%) is below the required %', buyer_rep, order_row.min_fulfiller_reputation;
        END IF;
      END IF;
    END IF;
  ELSE
    v_has_pending_rep := public.has_pending_fulfiller_rep(auth.uid());
    IF v_has_pending_rep THEN
      v_active_count := public.get_active_fulfiller_count(auth.uid());
      IF v_active_count >= 1 THEN
        RAISE EXCEPTION 'Fulfillment limit reached: max 1 active order while reputation is pending';
      END IF;
    END IF;

    IF order_row.min_fulfiller_reputation IS NOT NULL THEN
      SELECT COUNT(*)::int INTO fulfiller_completed
      FROM public.custom_orders
      WHERE assignee_id = auth.uid() AND listing_type = 'wtb'
        AND status IN ('completed', 'archived');
      IF fulfiller_completed >= 5 THEN
        fulfiller_rep := public.user_fulfiller_reputation(auth.uid());
        IF fulfiller_rep IS NOT NULL AND fulfiller_rep < order_row.min_fulfiller_reputation THEN
          RAISE EXCEPTION 'Your fulfiller reputation (%) is below the required %', fulfiller_rep, order_row.min_fulfiller_reputation;
        END IF;
      END IF;
    END IF;

    FOR bp_row IN SELECT blueprint_id FROM public.custom_order_blueprints WHERE order_id = p_order_id LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.acquired_blueprints ab
        WHERE ab.user_id = auth.uid() AND ab.blueprint_id = bp_row.blueprint_id
      ) THEN
        RAISE EXCEPTION 'You must own blueprint % to accept this order', bp_row.blueprint_id;
      END IF;
    END LOOP;

    IF NOT EXISTS (SELECT 1 FROM public.custom_order_blueprints WHERE order_id = p_order_id)
       AND order_row.blueprint_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.acquired_blueprints ab
        WHERE ab.user_id = auth.uid() AND ab.blueprint_id = order_row.blueprint_id
      ) THEN
        RAISE EXCEPTION 'You must own this blueprint to accept the order';
      END IF;
    END IF;
  END IF;

  UPDATE public.custom_orders
  SET status = 'accepted', assignee_id = auth.uid(), accepted_at = now(), updated_at = now()
  WHERE id = p_order_id;

  SELECT COALESCE(rsi_handle, display_name, email, 'A member') INTO assignee_name FROM public.profiles WHERE id = auth.uid();
  price_label := public.format_dfp_auec(order_row.total_dfp_auec);

  INSERT INTO public.order_events (order_id, actor_id, event_type, details)
  VALUES (p_order_id, auth.uid(), 'accepted', jsonb_build_object('assignee_id', auth.uid(), 'listing_type', order_row.listing_type));

  IF order_row.listing_type = 'wts' THEN
    PERFORM public.create_user_notification(
      order_row.requester_id, 'order_accepted', 'Listing accepted',
      assignee_name || ' accepted your sell listing: ' || order_row.title || ' · ' || price_label,
      jsonb_build_object('order_id', p_order_id, 'listing_type', 'wts')
    );
  ELSE
    PERFORM public.create_user_notification(
      order_row.requester_id, 'order_accepted', 'Order accepted',
      assignee_name || ' accepted your order: ' || order_row.title || ' · ' || price_label,
      jsonb_build_object('order_id', p_order_id)
    );
    PERFORM public.create_user_notification(
      auth.uid(), 'order_accepted_price', 'You accepted an order',
      'Customer expects ' || price_label || ' for: ' || order_row.title,
      jsonb_build_object('order_id', p_order_id)
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_custom_order_with_rating(
  p_order_id uuid, p_stars smallint, p_comment text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  order_row public.custom_orders%ROWTYPE;
  ratee_id uuid;
  rater_role text;
BEGIN
  IF p_stars IS NULL OR p_stars < 1 OR p_stars > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5 stars';
  END IF;

  SELECT * INTO order_row FROM public.custom_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF order_row.status <> 'completed' THEN RAISE EXCEPTION 'Only completed orders can be archived'; END IF;

  IF auth.uid() = order_row.requester_id THEN
    IF order_row.requester_archived_at IS NOT NULL THEN RAISE EXCEPTION 'You have already archived this order'; END IF;
    ratee_id := order_row.assignee_id;
    IF ratee_id IS NULL THEN RAISE EXCEPTION 'This order has no counterparty to rate'; END IF;
    rater_role := CASE WHEN order_row.listing_type = 'wtb' THEN 'requester' ELSE 'fulfiller' END;
    INSERT INTO public.custom_order_ratings (order_id, rater_id, ratee_id, rater_role, stars, comment)
    VALUES (p_order_id, auth.uid(), ratee_id, rater_role, p_stars, NULLIF(trim(p_comment), ''));
    UPDATE public.custom_orders SET requester_archived_at = now(), updated_at = now() WHERE id = p_order_id;
  ELSIF auth.uid() = order_row.assignee_id THEN
    IF order_row.fulfiller_archived_at IS NOT NULL THEN RAISE EXCEPTION 'You have already archived this order'; END IF;
    ratee_id := order_row.requester_id;
    rater_role := CASE WHEN order_row.listing_type = 'wtb' THEN 'fulfiller' ELSE 'requester' END;
    INSERT INTO public.custom_order_ratings (order_id, rater_id, ratee_id, rater_role, stars, comment)
    VALUES (p_order_id, auth.uid(), ratee_id, rater_role, p_stars, NULLIF(trim(p_comment), ''));
    UPDATE public.custom_orders SET fulfiller_archived_at = now(), updated_at = now() WHERE id = p_order_id;
  ELSE
    RAISE EXCEPTION 'Only the requester or assignee can archive this order';
  END IF;

  SELECT * INTO order_row FROM public.custom_orders WHERE id = p_order_id;
  IF order_row.requester_archived_at IS NOT NULL AND order_row.fulfiller_archived_at IS NOT NULL THEN
    UPDATE public.custom_orders SET status = 'archived', updated_at = now() WHERE id = p_order_id;
    INSERT INTO public.order_events (order_id, actor_id, event_type, details)
    VALUES (p_order_id, auth.uid(), 'archived', jsonb_build_object('stars', p_stars));
  ELSE
    INSERT INTO public.order_events (order_id, actor_id, event_type, details)
    VALUES (p_order_id, auth.uid(), 'party_archived', jsonb_build_object('stars', p_stars, 'rater_role', rater_role));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_custom_order_work(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  order_row public.custom_orders%ROWTYPE;
  notify_user uuid;
BEGIN
  IF NOT public.can_fulfill_orders() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  SELECT * INTO order_row FROM public.custom_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF order_row.listing_type = 'wts' THEN
    IF order_row.requester_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Only the seller can start this listing';
    END IF;
    notify_user := order_row.assignee_id;
  ELSE
    IF order_row.assignee_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Only the assigned fulfiller can start this order';
    END IF;
    notify_user := order_row.requester_id;
  END IF;

  IF order_row.status <> 'accepted' THEN RAISE EXCEPTION 'Order must be accepted before starting work'; END IF;

  UPDATE public.custom_orders SET status = 'in_progress', updated_at = now() WHERE id = p_order_id;
  INSERT INTO public.order_events (order_id, actor_id, event_type, details)
  VALUES (p_order_id, auth.uid(), 'in_progress', '{}'::jsonb);

  IF notify_user IS NOT NULL THEN
    PERFORM public.create_user_notification(
      notify_user, 'order_in_progress',
      CASE WHEN order_row.listing_type = 'wts' THEN 'Sale in progress' ELSE 'Craft started' END,
      'Work has started on: ' || order_row.title,
      jsonb_build_object('order_id', p_order_id)
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_order_craft(p_order_id uuid, p_notes text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  order_row public.custom_orders%ROWTYPE;
  item_row record;
  stock_qty numeric;
  fulfillment_id uuid;
  seller_name text;
  price_label text;
  deduct_inventory boolean;
  seller_id uuid;
  notify_user uuid;
BEGIN
  IF NOT public.can_fulfill_orders() THEN RAISE EXCEPTION 'Permission denied'; END IF;

  SELECT * INTO order_row FROM public.custom_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF order_row.listing_type = 'wts' THEN
    seller_id := order_row.requester_id;
    notify_user := order_row.assignee_id;
    IF seller_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Only the seller can mark this listing ready';
    END IF;
  ELSE
    seller_id := auth.uid();
    notify_user := order_row.requester_id;
    IF order_row.assignee_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Only the assigned fulfiller can complete this order';
    END IF;
  END IF;

  IF order_row.status NOT IN ('accepted', 'in_progress') THEN
    RAISE EXCEPTION 'Order cannot be completed in status %', order_row.status;
  END IF;

  SELECT craft_deduct_inventory INTO deduct_inventory FROM public.profiles WHERE id = seller_id;
  deduct_inventory := COALESCE(deduct_inventory, false);

  IF deduct_inventory THEN
    FOR item_row IN SELECT resource_key, quantity FROM public.custom_order_items WHERE order_id = p_order_id LOOP
      stock_qty := public.personal_resource_stock_total(seller_id, item_row.resource_key);
      IF stock_qty < item_row.quantity THEN
        RAISE EXCEPTION 'Insufficient personal stock for %', item_row.resource_key;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.order_fulfillments (order_id, fulfilled_by, notes)
  VALUES (p_order_id, seller_id, p_notes)
  RETURNING id INTO fulfillment_id;

  IF deduct_inventory THEN
    FOR item_row IN SELECT resource_key, quantity FROM public.custom_order_items WHERE order_id = p_order_id LOOP
      PERFORM public.deduct_personal_resource_stock(seller_id, item_row.resource_key, item_row.quantity);
      INSERT INTO public.fulfillment_items (fulfillment_id, resource_key, quantity)
      VALUES (fulfillment_id, item_row.resource_key, item_row.quantity);
    END LOOP;
  END IF;

  UPDATE public.custom_orders SET status = 'ready_for_pickup', ready_at = now(), updated_at = now() WHERE id = p_order_id;
  INSERT INTO public.order_events (order_id, actor_id, event_type, details)
  VALUES (p_order_id, auth.uid(), CASE WHEN deduct_inventory THEN 'resources_deducted' ELSE 'craft_completed' END,
    jsonb_build_object('fulfillment_id', fulfillment_id, 'listing_type', order_row.listing_type));

  SELECT COALESCE(rsi_handle, display_name, email, 'Seller') INTO seller_name FROM public.profiles WHERE id = seller_id;
  price_label := public.format_dfp_auec(order_row.total_dfp_auec);

  IF notify_user IS NOT NULL THEN
    PERFORM public.create_user_notification(
      notify_user, 'order_ready', 'Ready for pickup',
      seller_name || ' marked ready: ' || order_row.title || ' · ' || price_label,
      jsonb_build_object('order_id', p_order_id, 'fulfillment_id', fulfillment_id)
    );
  END IF;

  RETURN fulfillment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_order_pickup(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  order_row public.custom_orders%ROWTYPE;
  buyer_name text;
  notify_user uuid;
BEGIN
  SELECT * INTO order_row FROM public.custom_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF order_row.status <> 'ready_for_pickup' THEN RAISE EXCEPTION 'Order is not ready for pickup'; END IF;

  IF order_row.listing_type = 'wts' THEN
    IF order_row.assignee_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Only the buyer can confirm pickup';
    END IF;
    notify_user := order_row.requester_id;
  ELSE
    IF order_row.requester_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Only the requester can confirm pickup';
    END IF;
    notify_user := order_row.assignee_id;
  END IF;

  UPDATE public.custom_orders SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = p_order_id;
  INSERT INTO public.order_events (order_id, actor_id, event_type, details)
  VALUES (p_order_id, auth.uid(), 'completed', '{}'::jsonb);

  SELECT COALESCE(rsi_handle, display_name, email, 'Customer') INTO buyer_name FROM public.profiles WHERE id = auth.uid();
  IF notify_user IS NOT NULL THEN
    PERFORM public.create_user_notification(
      notify_user, 'order_completed', 'Pickup confirmed',
      buyer_name || ' confirmed pickup: ' || order_row.title,
      jsonb_build_object('order_id', p_order_id)
    );
  END IF;
END;
$$;

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
  VALUES (p_order_id, auth.uid(), 'abandoned', jsonb_build_object('listing_type', order_row.listing_type));

  IF notify_user IS NOT NULL THEN
    PERFORM public.create_user_notification(
      notify_user, 'order_abandoned', 'Order released',
      actor_name || ' released the order back to the pool: ' || order_row.title,
      jsonb_build_object('order_id', p_order_id)
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  caller_id uuid;
  caller_role text;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.banned_users WHERE id = caller_id) THEN
    RAISE EXCEPTION 'Banned accounts cannot be deleted through settings';
  END IF;

  SELECT role INTO caller_role FROM public.profiles WHERE id = caller_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF caller_role = 'super-admin' THEN RAISE EXCEPTION 'Super-admin accounts cannot self-delete'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.custom_orders
    WHERE status IN ('accepted', 'in_progress', 'ready_for_pickup')
      AND (requester_id = caller_id OR assignee_id = caller_id)
  ) THEN
    RAISE EXCEPTION 'Complete or cancel active orders before deleting your account';
  END IF;

  UPDATE public.profiles SET approved_by = NULL WHERE approved_by = caller_id;
  DELETE FROM public.acquired_blueprints WHERE user_id = caller_id;
  DELETE FROM public.profiles WHERE id = caller_id;

  RETURN jsonb_build_object('success', true, 'deleted_user_id', caller_id);
END;
$$;
