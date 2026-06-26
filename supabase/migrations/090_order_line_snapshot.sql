-- Persist blueprint line display snapshot (materials + stats) for fulfillment and Discord embeds.

ALTER TABLE public.custom_order_blueprints
  ADD COLUMN IF NOT EXISTS line_snapshot jsonb;

COMMENT ON COLUMN public.custom_order_blueprints.line_snapshot IS
  'Client-computed { slotSummary, stats[] } for itemized order display and Discord notifications.';

CREATE OR REPLACE FUNCTION public.discord_format_line_snapshot(p_snapshot jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_text text := '';
  v_stat jsonb;
  v_pct text;
BEGIN
  IF p_snapshot IS NULL THEN
    RETURN '';
  END IF;

  IF p_snapshot ? 'slotSummary' AND COALESCE(p_snapshot->>'slotSummary', '') <> '' THEN
    v_text := '**Materials:** ' || (p_snapshot->>'slotSummary');
  END IF;

  IF p_snapshot ? 'stats' AND jsonb_typeof(p_snapshot->'stats') = 'array'
     AND jsonb_array_length(p_snapshot->'stats') > 0 THEN
    IF v_text <> '' THEN
      v_text := v_text || E'\n';
    END IF;
    v_text := v_text || '**Stats:**';
    FOR v_stat IN SELECT * FROM jsonb_array_elements(p_snapshot->'stats')
    LOOP
      IF (v_stat->>'percentChange')::numeric >= 0 THEN
        v_pct := '+' || round((v_stat->>'percentChange')::numeric, 1)::text || '%';
      ELSE
        v_pct := round((v_stat->>'percentChange')::numeric, 1)::text || '%';
      END IF;

      IF v_stat ? 'baseValue' AND v_stat ? 'finalValue' THEN
        v_text := v_text || E'\n• ' || (v_stat->>'propertyLabel')
          || ': ' || (v_stat->>'baseValue') || '→' || (v_stat->>'finalValue')
          || ' (' || v_pct || ')';
      ELSE
        v_text := v_text || E'\n• ' || (v_stat->>'propertyLabel') || ': ' || v_pct;
      END IF;
    END LOOP;
  END IF;

  RETURN left(v_text, 1024);
END;
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
  v_bp record;
  v_res record;
  v_line_text text;
  v_field_name text;
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

  FOR v_bp IN
    SELECT *
    FROM public.custom_order_blueprints
    WHERE order_id = p_order_id
    ORDER BY sort_order
  LOOP
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
  END LOOP;

  FOR v_res IN
    SELECT *
    FROM public.custom_order_resource_lines
    WHERE order_id = p_order_id
    ORDER BY sort_order
  LOOP
    v_field_name := left(COALESCE(v_res.resource_label, v_res.resource_key), 256);
    v_line_text := 'Q' || v_res.min_quality::text
      || ' · ' || v_res.quantity_scu::text || ' SCU'
      || E'\n' || public.format_dfp_auec(v_res.line_dfp_auec);

    v_fields := v_fields || jsonb_build_array(
      jsonb_build_object('name', v_field_name, 'value', left(v_line_text, 1024), 'inline', false)
    );
  END LOOP;

  RETURN v_fields;
END;
$$;

-- create_custom_order: persist line_snapshot on blueprint rows
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

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'listing_type', v_listing_type);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_custom_order(text, text, bigint, int, jsonb, jsonb, jsonb, text) TO authenticated;

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

  FOR bp IN SELECT * FROM jsonb_array_elements(p_blueprints)
  LOOP
    INSERT INTO public.custom_order_blueprints (
      order_id,
      blueprint_id,
      blueprint_title,
      min_quality,
      slot_qualities,
      line_snapshot,
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
      bp->'line_snapshot',
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

GRANT EXECUTE ON FUNCTION public.update_custom_order_requester(
  uuid, text, text, bigint, int, text, int, int, jsonb, jsonb, jsonb
) TO authenticated;
