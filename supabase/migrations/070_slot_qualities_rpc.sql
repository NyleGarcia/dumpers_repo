-- =============================================================================
-- Migration 070: Update RPC functions to handle slot_qualities
-- Fixes create_custom_order and update_custom_order_requester to store per-slot quality
-- =============================================================================

-- Update create_custom_order to include slot_qualities
CREATE OR REPLACE FUNCTION public.create_custom_order(
  p_title text,
  p_notes text DEFAULT NULL,
  p_total_dfp_auec bigint DEFAULT 0,
  p_min_fulfiller_reputation int DEFAULT NULL,
  p_blueprints jsonb DEFAULT '[]'::jsonb,
  p_resources jsonb DEFAULT '[]'::jsonb,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Check preview features access
  IF NOT public.can_access_preview_features() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Feature access required');
  END IF;

  -- Check RSI verification
  SELECT rsi_handle_verified INTO v_rsi_verified
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT COALESCE(v_rsi_verified, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'RSI Handle verification required');
  END IF;

  -- Check for unrated completed orders
  v_unrated_count := public.get_unrated_order_count(v_user_id);
  IF v_unrated_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Rate your completed orders first',
      'error_type', 'unrated',
      'unrated_count', v_unrated_count
    );
  END IF;

  -- Validate order has content
  IF jsonb_array_length(p_blueprints) = 0 AND jsonb_array_length(p_resources) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Add at least one blueprint or resource');
  END IF;

  -- Check if this is a single-blueprint order
  v_is_single_bp := jsonb_array_length(p_blueprints) = 1 AND jsonb_array_length(p_resources) = 0;
  
  IF v_is_single_bp THEN
    v_first_bp_id := p_blueprints->0->>'blueprint_id';
  END IF;

  -- Check pending buyer rep limits
  v_has_pending_rep := public.has_pending_buyer_rep(v_user_id);
  
  IF v_has_pending_rep THEN
    -- MINIMUM ORDER VALUE: 10,000 aUEC for pending rep
    IF COALESCE(p_total_dfp_auec, 0) < 10000 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Minimum order value is 10,000 aUEC while reputation is pending',
        'error_type', 'min_value',
        'min_value', 10000
      );
    END IF;

    -- DUPLICATE SINGLE-BP DETECTION
    IF v_is_single_bp THEN
      v_dupe_check := public.check_duplicate_single_bp_order(v_user_id, v_first_bp_id);
      
      IF (v_dupe_check->>'has_duplicate')::boolean THEN
        IF v_dupe_check->>'duplicate_type' = 'pending' THEN
          -- Force redirect to edit existing pending order
          RETURN jsonb_build_object(
            'success', false,
            'error', 'Pending order found with same Blueprint. Pulling your existing order back for editing.',
            'error_type', 'duplicate_pending',
            'existing_order_id', v_dupe_check->>'existing_order_id'
          );
        ELSE
          -- Block: active order exists, track attempt
          v_abuse_track := public.track_abuse_attempt(v_user_id, v_first_bp_id);
          
          -- Create auto-report if 3+ attempts today
          IF (v_abuse_track->>'should_report')::boolean THEN
            PERFORM public.create_abuse_report(
              v_user_id,
              v_first_bp_id,
              (v_abuse_track->>'attempt_count')::int
            );
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

    -- Check order count limit
    v_active_count := public.get_active_buyer_order_count(v_user_id);
    IF v_active_count >= 2 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Order limit reached',
        'error_type', 'order_limit',
        'detail', 'Max 2 active orders while reputation is pending'
      );
    END IF;

    -- Check total aUEC limit
    v_active_total := public.get_active_buyer_order_total(v_user_id);
    IF (v_active_total + COALESCE(p_total_dfp_auec, 0)) > 1000000 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Order limit reached',
        'error_type', 'auec_limit',
        'detail', 'Max 1,000,000 aUEC total while reputation is pending'
      );
    END IF;
  END IF;

  -- Create the order
  INSERT INTO public.custom_orders (
    requester_id,
    title,
    notes,
    total_dfp_auec,
    min_fulfiller_reputation,
    blueprint_id,
    min_quality,
    quantity,
    status
  )
  VALUES (
    v_user_id,
    trim(p_title),
    nullif(trim(p_notes), ''),
    COALESCE(p_total_dfp_auec, 0),
    p_min_fulfiller_reputation,
    v_first_bp_id,
    COALESCE((p_blueprints->0->>'min_quality')::int, 500),
    COALESCE((p_blueprints->0->>'quantity')::int, 1),
    'pending'
  )
  RETURNING id INTO v_order_id;

  -- Insert blueprint lines (now includes slot_qualities)
  FOR v_bp IN SELECT * FROM jsonb_array_elements(p_blueprints)
  LOOP
    INSERT INTO public.custom_order_blueprints (
      order_id,
      blueprint_id,
      blueprint_title,
      min_quality,
      slot_qualities,
      quantity,
      unit_dfp_auec,
      line_dfp_auec,
      sort_order
    )
    VALUES (
      v_order_id,
      v_bp->>'blueprint_id',
      v_bp->>'blueprint_title',
      COALESCE((v_bp->>'min_quality')::int, 500),
      v_bp->'slot_qualities',
      COALESCE((v_bp->>'quantity')::int, 1),
      COALESCE((v_bp->>'unit_dfp_auec')::bigint, 0),
      COALESCE((v_bp->>'line_dfp_auec')::bigint, 0),
      v_bp_idx
    );
    v_bp_idx := v_bp_idx + 1;
  END LOOP;

  -- Insert resource lines
  FOR v_res IN SELECT * FROM jsonb_array_elements(p_resources)
  LOOP
    INSERT INTO public.custom_order_resource_lines (
      order_id,
      resource_key,
      resource_label,
      min_quality,
      quantity_scu,
      unit_dfp_auec,
      line_dfp_auec,
      sort_order
    )
    VALUES (
      v_order_id,
      v_res->>'resource_key',
      v_res->>'resource_label',
      COALESCE((v_res->>'min_quality')::int, 500),
      COALESCE((v_res->>'quantity_scu')::numeric, 1),
      COALESCE((v_res->>'unit_dfp_auec')::bigint, 0),
      COALESCE((v_res->>'line_dfp_auec')::bigint, 0),
      v_res_idx
    );
    v_res_idx := v_res_idx + 1;
  END LOOP;

  -- Insert order items (resource requirements)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.custom_order_items (order_id, resource_key, quantity)
    VALUES (
      v_order_id,
      v_item->>'resource_key',
      COALESCE((v_item->>'quantity')::numeric, 1)
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id);
END;
$$;

-- Update update_custom_order_requester to include slot_qualities
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
  p_items jsonb DEFAULT '[]'::jsonb
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
    updated_at = now()
  WHERE id = p_order_id;

  DELETE FROM public.custom_order_blueprints WHERE order_id = p_order_id;
  DELETE FROM public.custom_order_resource_lines WHERE order_id = p_order_id;
  DELETE FROM public.custom_order_items WHERE order_id = p_order_id;

  -- Insert blueprint lines (now includes slot_qualities)
  FOR bp IN SELECT * FROM jsonb_array_elements(p_blueprints)
  LOOP
    INSERT INTO public.custom_order_blueprints (
      order_id,
      blueprint_id,
      blueprint_title,
      min_quality,
      slot_qualities,
      quantity,
      unit_dfp_auec,
      line_dfp_auec,
      sort_order
    )
    VALUES (
      p_order_id,
      bp->>'blueprint_id',
      bp->>'blueprint_title',
      (bp->>'min_quality')::int,
      bp->'slot_qualities',
      (bp->>'quantity')::int,
      (bp->>'unit_dfp_auec')::bigint,
      (bp->>'line_dfp_auec')::bigint,
      bp_idx
    );
    bp_idx := bp_idx + 1;
  END LOOP;

  FOR res IN SELECT * FROM jsonb_array_elements(p_resources)
  LOOP
    INSERT INTO public.custom_order_resource_lines (
      order_id,
      resource_key,
      resource_label,
      min_quality,
      quantity_scu,
      unit_dfp_auec,
      line_dfp_auec,
      sort_order
    )
    VALUES (
      p_order_id,
      res->>'resource_key',
      res->>'resource_label',
      (res->>'min_quality')::int,
      (res->>'quantity_scu')::numeric,
      (res->>'unit_dfp_auec')::bigint,
      (res->>'line_dfp_auec')::bigint,
      res_idx
    );
    res_idx := res_idx + 1;
  END LOOP;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.custom_order_items (order_id, resource_key, quantity)
    VALUES (
      p_order_id,
      item->>'resource_key',
      (item->>'quantity')::numeric
    );
  END LOOP;
END;
$$;
