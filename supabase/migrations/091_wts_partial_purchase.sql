-- Partial WTS purchases: listing stays open; each purchase is a full child order
-- through the normal lifecycle (handoff, pickup, archive, ratings).

ALTER TABLE public.custom_orders
  ADD COLUMN IF NOT EXISTS sell_entire_listing boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_listing_id uuid REFERENCES public.custom_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS custom_orders_source_listing_idx
  ON public.custom_orders (source_listing_id)
  WHERE source_listing_id IS NOT NULL;

COMMENT ON COLUMN public.custom_orders.sell_entire_listing IS
  'WTS listings only. When true, buyer must purchase all lines at listed quantities.';
COMMENT ON COLUMN public.custom_orders.source_listing_id IS
  'WTS partial purchase orders reference the parent listing they were split from.';

ALTER TABLE public.custom_order_blueprints
  ADD COLUMN IF NOT EXISTS source_line_id uuid REFERENCES public.custom_order_blueprints(id) ON DELETE SET NULL;

ALTER TABLE public.custom_order_resource_lines
  ADD COLUMN IF NOT EXISTS source_line_id uuid REFERENCES public.custom_order_resource_lines(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.recalculate_custom_order_total(p_order_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint := 0;
BEGIN
  SELECT COALESCE(SUM(line_dfp_auec), 0)::bigint INTO v_total
  FROM public.custom_order_blueprints
  WHERE order_id = p_order_id;

  SELECT v_total + COALESCE(SUM(line_dfp_auec), 0)::bigint INTO v_total
  FROM public.custom_order_resource_lines
  WHERE order_id = p_order_id;

  UPDATE public.custom_orders
  SET total_dfp_auec = v_total, updated_at = now()
  WHERE id = p_order_id;

  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_wts_purchase_to_listing(p_purchase_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase public.custom_orders%ROWTYPE;
  v_listing public.custom_orders%ROWTYPE;
  v_bp record;
  v_res record;
BEGIN
  SELECT * INTO v_purchase FROM public.custom_orders WHERE id = p_purchase_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase order not found'; END IF;
  IF v_purchase.source_listing_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_listing FROM public.custom_orders WHERE id = v_purchase.source_listing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source listing not found'; END IF;

  FOR v_bp IN
    SELECT * FROM public.custom_order_blueprints WHERE order_id = p_purchase_order_id
  LOOP
    IF v_bp.source_line_id IS NOT NULL THEN
      UPDATE public.custom_order_blueprints
      SET
        quantity = quantity + v_bp.quantity,
        line_dfp_auec = unit_dfp_auec * (quantity + v_bp.quantity)
      WHERE id = v_bp.source_line_id;
    ELSE
      INSERT INTO public.custom_order_blueprints (
        order_id, blueprint_id, blueprint_title, min_quality, slot_qualities,
        line_snapshot, quantity, unit_dfp_auec, line_dfp_auec, sort_order
      )
      VALUES (
        v_listing.id, v_bp.blueprint_id, v_bp.blueprint_title, v_bp.min_quality,
        v_bp.slot_qualities, v_bp.line_snapshot, v_bp.quantity,
        v_bp.unit_dfp_auec, v_bp.line_dfp_auec,
        COALESCE((SELECT MAX(sort_order) + 1 FROM public.custom_order_blueprints WHERE order_id = v_listing.id), 0)
      );
    END IF;
  END LOOP;

  FOR v_res IN
    SELECT * FROM public.custom_order_resource_lines WHERE order_id = p_purchase_order_id
  LOOP
    IF v_res.source_line_id IS NOT NULL THEN
      UPDATE public.custom_order_resource_lines
      SET
        quantity_scu = quantity_scu + v_res.quantity_scu,
        line_dfp_auec = unit_dfp_auec * (quantity_scu + v_res.quantity_scu)
      WHERE id = v_res.source_line_id;
    ELSE
      INSERT INTO public.custom_order_resource_lines (
        order_id, resource_key, resource_label, min_quality, quantity_scu,
        unit_dfp_auec, line_dfp_auec, sort_order
      )
      VALUES (
        v_listing.id, v_res.resource_key, v_res.resource_label, v_res.min_quality,
        v_res.quantity_scu, v_res.unit_dfp_auec, v_res.line_dfp_auec,
        COALESCE((SELECT MAX(sort_order) + 1 FROM public.custom_order_resource_lines WHERE order_id = v_listing.id), 0)
      );
    END IF;
  END LOOP;

  PERFORM public.recalculate_custom_order_total(v_listing.id);

  IF v_listing.status = 'cancelled' THEN
    UPDATE public.custom_orders
    SET status = 'pending', updated_at = now()
    WHERE id = v_listing.id;
  END IF;
END;
$$;

-- Partial WTS accept: creates a child order (accepted) and reduces the listing.
CREATE OR REPLACE FUNCTION public.accept_wts_partial(
  p_listing_id uuid,
  p_selections jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing public.custom_orders%ROWTYPE;
  v_sel jsonb;
  v_line_id uuid;
  v_kind text;
  v_qty numeric;
  v_purchase_total bigint := 0;
  v_purchase_id uuid;
  v_bp public.custom_order_blueprints%ROWTYPE;
  v_res public.custom_order_resource_lines%ROWTYPE;
  v_line_dfp bigint;
  v_buyer_rep int;
  v_buyer_completed int;
  v_has_pending_rep boolean;
  v_active_count int;
  v_active_total bigint;
  v_unrated_count int;
  v_rsi_verified boolean;
  v_assignee_name text;
  v_price_label text;
  v_sel_count int := 0;
  v_bp_idx int := 0;
  v_res_idx int := 0;
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

  IF p_selections IS NULL OR jsonb_typeof(p_selections) <> 'array' OR jsonb_array_length(p_selections) = 0 THEN
    RAISE EXCEPTION 'Select at least one item to purchase';
  END IF;

  SELECT * INTO v_listing FROM public.custom_orders WHERE id = p_listing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF v_listing.listing_type <> 'wts' THEN RAISE EXCEPTION 'Not a sell listing'; END IF;
  IF v_listing.status <> 'pending' THEN RAISE EXCEPTION 'Listing is no longer available'; END IF;
  IF COALESCE(v_listing.sell_entire_listing, true) THEN
    RAISE EXCEPTION 'This listing must be purchased in full';
  END IF;
  IF v_listing.requester_id = auth.uid() THEN RAISE EXCEPTION 'You cannot buy your own listing'; END IF;
  IF v_listing.source_listing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot purchase from a purchase order';
  END IF;

  -- Validate selections and compute total (lock lines implicitly via listing lock)
  FOR v_sel IN SELECT * FROM jsonb_array_elements(p_selections)
  LOOP
    v_line_id := (v_sel->>'line_id')::uuid;
    v_kind := COALESCE(v_sel->>'kind', 'blueprint');
    v_qty := (v_sel->>'quantity')::numeric;

    IF v_line_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    IF v_kind = 'resource' THEN
      SELECT * INTO v_res
      FROM public.custom_order_resource_lines
      WHERE id = v_line_id AND order_id = p_listing_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Invalid resource line %', v_line_id; END IF;
      IF v_qty > v_res.quantity_scu THEN
        RAISE EXCEPTION 'Requested quantity exceeds available % for %', v_res.quantity_scu, v_res.resource_label;
      END IF;
      v_line_dfp := round(v_res.unit_dfp_auec * v_qty)::bigint;
    ELSE
      SELECT * INTO v_bp
      FROM public.custom_order_blueprints
      WHERE id = v_line_id AND order_id = p_listing_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Invalid blueprint line %', v_line_id; END IF;
      IF v_qty > v_bp.quantity THEN
        RAISE EXCEPTION 'Requested quantity exceeds available % for %', v_bp.quantity, v_bp.blueprint_title;
      END IF;
      IF v_qty <> trunc(v_qty) THEN
        RAISE EXCEPTION 'Blueprint quantity must be a whole number';
      END IF;
      v_line_dfp := v_bp.unit_dfp_auec * trunc(v_qty)::int;
    END IF;

    v_purchase_total := v_purchase_total + v_line_dfp;
    v_sel_count := v_sel_count + 1;
  END LOOP;

  IF v_sel_count = 0 THEN
    RAISE EXCEPTION 'Select at least one item with quantity greater than zero';
  END IF;

  IF v_purchase_total <= 0 THEN
    RAISE EXCEPTION 'Purchase total must be greater than zero';
  END IF;

  v_has_pending_rep := public.has_pending_buyer_rep(auth.uid());
  IF v_has_pending_rep THEN
    v_active_count := public.get_active_buyer_order_count(auth.uid());
    IF v_active_count >= 2 THEN
      RAISE EXCEPTION 'Order limit reached: max 2 active purchases while reputation is pending';
    END IF;
    v_active_total := public.get_active_buyer_order_total(auth.uid());
    IF (v_active_total + v_purchase_total) > 1000000 THEN
      RAISE EXCEPTION 'Order limit reached: max 1,000,000 aUEC total while reputation is pending';
    END IF;
  END IF;

  IF v_listing.min_fulfiller_reputation IS NOT NULL THEN
    SELECT COUNT(*)::int INTO v_buyer_completed
    FROM public.custom_orders
    WHERE assignee_id = auth.uid() AND listing_type = 'wts'
      AND status IN ('completed', 'archived');
    IF v_buyer_completed >= 5 THEN
      v_buyer_rep := public.user_buyer_reputation(auth.uid());
      IF v_buyer_rep IS NOT NULL AND v_buyer_rep < v_listing.min_fulfiller_reputation THEN
        RAISE EXCEPTION 'Your buyer reputation (%) is below the required %', v_buyer_rep, v_listing.min_fulfiller_reputation;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.custom_orders (
    requester_id, title, notes, total_dfp_auec, min_fulfiller_reputation,
    blueprint_id, min_quality, quantity, status, listing_type,
    assignee_id, accepted_at, sell_entire_listing, source_listing_id
  )
  VALUES (
    v_listing.requester_id,
    v_listing.title || ' (partial purchase)',
    v_listing.notes,
    v_purchase_total,
    v_listing.min_fulfiller_reputation,
    NULL, 500, 1,
    'accepted', 'wts',
    auth.uid(), now(), true, p_listing_id
  )
  RETURNING id INTO v_purchase_id;

  FOR v_sel IN SELECT * FROM jsonb_array_elements(p_selections)
  LOOP
    v_line_id := (v_sel->>'line_id')::uuid;
    v_kind := COALESCE(v_sel->>'kind', 'blueprint');
    v_qty := (v_sel->>'quantity')::numeric;
    IF v_line_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

    IF v_kind = 'resource' THEN
      SELECT * INTO v_res FROM public.custom_order_resource_lines WHERE id = v_line_id;
      v_line_dfp := round(v_res.unit_dfp_auec * v_qty)::bigint;

      INSERT INTO public.custom_order_resource_lines (
        order_id, resource_key, resource_label, min_quality, quantity_scu,
        unit_dfp_auec, line_dfp_auec, sort_order, source_line_id
      )
      VALUES (
        v_purchase_id, v_res.resource_key, v_res.resource_label, v_res.min_quality,
        v_qty, v_res.unit_dfp_auec, v_line_dfp, v_res_idx, v_line_id
      );
      v_res_idx := v_res_idx + 1;

      UPDATE public.custom_order_resource_lines
      SET
        quantity_scu = quantity_scu - v_qty,
        line_dfp_auec = unit_dfp_auec * GREATEST(quantity_scu - v_qty, 0)
      WHERE id = v_line_id;

      DELETE FROM public.custom_order_resource_lines
      WHERE id = v_line_id AND quantity_scu <= 0;
    ELSE
      SELECT * INTO v_bp FROM public.custom_order_blueprints WHERE id = v_line_id;
      v_line_dfp := v_bp.unit_dfp_auec * trunc(v_qty)::int;

      INSERT INTO public.custom_order_blueprints (
        order_id, blueprint_id, blueprint_title, min_quality, slot_qualities,
        line_snapshot, quantity, unit_dfp_auec, line_dfp_auec, sort_order, source_line_id
      )
      VALUES (
        v_purchase_id, v_bp.blueprint_id, v_bp.blueprint_title, v_bp.min_quality,
        v_bp.slot_qualities, v_bp.line_snapshot, trunc(v_qty)::int,
        v_bp.unit_dfp_auec, v_line_dfp, v_bp_idx, v_line_id
      );
      v_bp_idx := v_bp_idx + 1;

      UPDATE public.custom_order_blueprints
      SET
        quantity = quantity - trunc(v_qty)::int,
        line_dfp_auec = unit_dfp_auec * GREATEST(quantity - trunc(v_qty)::int, 0)
      WHERE id = v_line_id;

      DELETE FROM public.custom_order_blueprints
      WHERE id = v_line_id AND quantity <= 0;
    END IF;
  END LOOP;

  PERFORM public.recalculate_custom_order_total(v_purchase_id);
  PERFORM public.recalculate_custom_order_total(p_listing_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.custom_order_blueprints WHERE order_id = p_listing_id
    UNION ALL
    SELECT 1 FROM public.custom_order_resource_lines WHERE order_id = p_listing_id
  ) THEN
    UPDATE public.custom_orders
    SET status = 'cancelled', updated_at = now()
    WHERE id = p_listing_id;

    INSERT INTO public.order_events (order_id, actor_id, event_type, details)
    VALUES (
      p_listing_id, auth.uid(), 'listing_depleted',
      jsonb_build_object('purchase_order_id', v_purchase_id)
    );
  END IF;

  SELECT COALESCE(rsi_handle, display_name, email, 'A member') INTO v_assignee_name
  FROM public.profiles WHERE id = auth.uid();
  v_price_label := public.format_dfp_auec(v_purchase_total);

  INSERT INTO public.order_events (order_id, actor_id, event_type, details)
  VALUES (
    v_purchase_id, auth.uid(), 'accepted',
    jsonb_build_object(
      'assignee_id', auth.uid(),
      'listing_type', 'wts',
      'partial', true,
      'source_listing_id', p_listing_id
    )
  );

  INSERT INTO public.order_events (order_id, actor_id, event_type, details)
  VALUES (
    p_listing_id, auth.uid(), 'partial_sold',
    jsonb_build_object('purchase_order_id', v_purchase_id, 'total_dfp_auec', v_purchase_total)
  );

  PERFORM public.create_user_notification(
    v_listing.requester_id, 'order_accepted', 'Partial sale',
    v_assignee_name || ' purchased part of your listing: ' || v_listing.title || ' · ' || v_price_label,
    jsonb_build_object('order_id', v_purchase_id, 'listing_id', p_listing_id, 'listing_type', 'wts', 'partial', true)
  );

  PERFORM public.create_user_notification(
    auth.uid(), 'order_accepted_price', 'Purchase started',
    'You purchased ' || v_price_label || ' from: ' || v_listing.title,
    jsonb_build_object('order_id', v_purchase_id, 'listing_id', p_listing_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'purchase_order_id', v_purchase_id,
    'listing_id', p_listing_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_wts_partial(uuid, jsonb) TO authenticated;

-- Whole-listing accept: reject partial-enabled listings.
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
  IF order_row.source_listing_id IS NOT NULL THEN
    RAISE EXCEPTION 'This is a purchase order, not an open listing';
  END IF;

  IF order_row.listing_type = 'wts' THEN
    IF NOT COALESCE(order_row.sell_entire_listing, true) THEN
      RAISE EXCEPTION 'This listing allows partial purchases — select items and quantities to buy';
    END IF;

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

-- Abandon: restore partial purchases to listing; whole listings return to pool.
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
        'restored_to_listing', true
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

-- create_custom_order: accept sell_entire_listing for WTS
DROP FUNCTION IF EXISTS public.create_custom_order(text, text, bigint, int, jsonb, jsonb, jsonb, text);

CREATE OR REPLACE FUNCTION public.create_custom_order(
  p_title text,
  p_notes text DEFAULT NULL,
  p_total_dfp_auec bigint DEFAULT 0,
  p_min_fulfiller_reputation int DEFAULT NULL,
  p_blueprints jsonb DEFAULT '[]'::jsonb,
  p_resources jsonb DEFAULT '[]'::jsonb,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_listing_type text DEFAULT 'wtb',
  p_sell_entire_listing boolean DEFAULT true
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
  v_sell_entire boolean;
BEGIN
  v_user_id := auth.uid();
  v_listing_type := COALESCE(NULLIF(trim(p_listing_type), ''), 'wtb');
  v_sell_entire := CASE WHEN v_listing_type = 'wts' THEN COALESCE(p_sell_entire_listing, true) ELSE true END;

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
    blueprint_id, min_quality, quantity, status, listing_type, sell_entire_listing
  )
  VALUES (
    v_user_id, trim(p_title), nullif(trim(p_notes), ''), COALESCE(p_total_dfp_auec, 0),
    p_min_fulfiller_reputation, v_first_bp_id,
    COALESCE((p_blueprints->0->>'min_quality')::int, 500),
    COALESCE((p_blueprints->0->>'quantity')::int, 1),
    'pending', v_listing_type, v_sell_entire
  )
  RETURNING id INTO v_order_id;

  FOR v_bp IN SELECT * FROM jsonb_array_elements(p_blueprints) LOOP
    INSERT INTO public.custom_order_blueprints (
      order_id, blueprint_id, blueprint_title, min_quality, slot_qualities,
      line_snapshot, quantity, unit_dfp_auec, line_dfp_auec, sort_order
    ) VALUES (
      v_order_id, v_bp->>'blueprint_id', v_bp->>'blueprint_title',
      COALESCE((v_bp->>'min_quality')::int, 500), v_bp->'slot_qualities',
      v_bp->'line_snapshot',
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

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'listing_type', v_listing_type,
    'sell_entire_listing', v_sell_entire
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_custom_order(text, text, bigint, int, jsonb, jsonb, jsonb, text, boolean) TO authenticated;

-- update_custom_order_requester: persist sell_entire_listing on WTS edits
DROP FUNCTION IF EXISTS public.update_custom_order_requester(uuid, text, text, bigint, int, text, int, int, jsonb, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.update_custom_order_requester(
  p_order_id uuid,
  p_title text,
  p_notes text,
  p_total_dfp_auec bigint,
  p_min_fulfiller_reputation int,
  p_blueprint_id text,
  p_min_quality int,
  p_quantity int,
  p_blueprints jsonb DEFAULT '[]'::jsonb,
  p_resources jsonb DEFAULT '[]'::jsonb,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_sell_entire_listing boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_row public.custom_orders%ROWTYPE;
  bp jsonb;
  res jsonb;
  item jsonb;
  bp_idx int := 0;
  res_idx int := 0;
BEGIN
  IF NOT public.can_access_preview_features() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT * INTO order_row
  FROM public.custom_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF order_row.requester_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the requester can edit this order';
  END IF;

  IF order_row.status <> 'pending' OR order_row.assignee_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only unaccepted pending orders can be edited';
  END IF;

  IF order_row.source_listing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Partial purchase orders cannot be edited';
  END IF;

  IF jsonb_array_length(p_blueprints) = 0 AND jsonb_array_length(p_resources) = 0 THEN
    RAISE EXCEPTION 'Order must include at least one blueprint or resource line';
  END IF;

  UPDATE public.custom_orders
  SET
    title = trim(p_title),
    notes = nullif(trim(p_notes), ''),
    total_dfp_auec = p_total_dfp_auec,
    min_fulfiller_reputation = p_min_fulfiller_reputation,
    blueprint_id = p_blueprint_id,
    min_quality = p_min_quality,
    quantity = p_quantity,
    sell_entire_listing = CASE
      WHEN order_row.listing_type = 'wts' THEN COALESCE(p_sell_entire_listing, true)
      ELSE true
    END,
    updated_at = now()
  WHERE id = p_order_id;

  DELETE FROM public.custom_order_blueprints WHERE order_id = p_order_id;
  DELETE FROM public.custom_order_resource_lines WHERE order_id = p_order_id;
  DELETE FROM public.custom_order_items WHERE order_id = p_order_id;

  FOR bp IN SELECT * FROM jsonb_array_elements(p_blueprints)
  LOOP
    INSERT INTO public.custom_order_blueprints (
      order_id, blueprint_id, blueprint_title, min_quality, slot_qualities,
      line_snapshot, quantity, unit_dfp_auec, line_dfp_auec, sort_order
    )
    VALUES (
      p_order_id, bp->>'blueprint_id', bp->>'blueprint_title',
      (bp->>'min_quality')::int, bp->'slot_qualities', bp->'line_snapshot',
      (bp->>'quantity')::int, (bp->>'unit_dfp_auec')::bigint,
      (bp->>'line_dfp_auec')::bigint, bp_idx
    );
    bp_idx := bp_idx + 1;
  END LOOP;

  FOR res IN SELECT * FROM jsonb_array_elements(p_resources)
  LOOP
    INSERT INTO public.custom_order_resource_lines (
      order_id, resource_key, resource_label, min_quality, quantity_scu,
      unit_dfp_auec, line_dfp_auec, sort_order
    )
    VALUES (
      p_order_id, res->>'resource_key', res->>'resource_label',
      (res->>'min_quality')::int, (res->>'quantity_scu')::numeric,
      (res->>'unit_dfp_auec')::bigint, (res->>'line_dfp_auec')::bigint, res_idx
    );
    res_idx := res_idx + 1;
  END LOOP;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.custom_order_items (order_id, resource_key, quantity)
    VALUES (p_order_id, item->>'resource_key', (item->>'quantity')::numeric);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_custom_order_requester(
  uuid, text, text, bigint, int, text, int, int, jsonb, jsonb, jsonb, boolean
) TO authenticated;
