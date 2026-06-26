-- In-app notifications for Mining Ledger access, close, and crew payouts.

-- Sum of mining run profit actual from ledger JSON (yield × price per row).
CREATE OR REPLACE FUNCTION public.mining_ledger_ore_profit_actual_total(p_data jsonb)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  elem jsonb;
  v_yield numeric;
  v_price numeric;
  v_total numeric := 0;
BEGIN
  IF p_data IS NULL THEN
    RETURN 0;
  END IF;

  FOR elem IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_data->'miningRows', '[]'::jsonb)) AS value
  LOOP
    BEGIN
      IF elem->>'resourceKey' IN (
        'aphorite', 'beradom', 'carinite', 'dolivine', 'feynmaline',
        'glacosite', 'hadanite', 'janalite', 'sadaryx'
      ) THEN
        v_yield := trunc(COALESCE((elem->>'unrefinedCscu')::numeric, 0));
      ELSE
        v_yield := COALESCE(
          NULLIF(trim(elem->>'yieldActual'), '')::numeric,
          ROUND(COALESCE((elem->>'unrefinedCscu')::numeric, 0) * 0.45)
        );
      END IF;
    EXCEPTION
      WHEN invalid_text_representation THEN
        v_yield := 0;
    END;

    v_price := NULL;
    SELECT (po->>'pricePer100')::numeric
    INTO v_price
    FROM jsonb_array_elements(COALESCE(p_data->'priceOverrides', '[]'::jsonb)) AS po
    WHERE po->>'resourceKey' = elem->>'resourceKey'
      AND po->>'pricePer100' IS NOT NULL
      AND length(trim(po->>'pricePer100')) > 0
    LIMIT 1;

    IF elem->>'resourceKey' IN (
      'aphorite', 'beradom', 'carinite', 'dolivine', 'feynmaline',
      'glacosite', 'hadanite', 'janalite', 'sadaryx'
    ) THEN
      v_total := v_total + trunc(COALESCE(v_yield, 0)) * COALESCE(v_price, 0);
    ELSE
      v_total := v_total + (v_yield / 100.0) * COALESCE(v_price, 0);
    END IF;
  END LOOP;

  RETURN v_total;
END;
$$;

-- Share-weighted payout from total payout pool (÷ total shares × member shares).
CREATE OR REPLACE FUNCTION public.mining_ledger_total_payout(p_data jsonb)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    public.mining_ledger_ore_profit_actual_total(p_data)
    - COALESCE((
        SELECT SUM(COALESCE((elem->>'cost')::numeric, 0))
        FROM jsonb_array_elements(COALESCE(p_data->'deductibles', '[]'::jsonb)) AS elem
      ), 0)
    + COALESCE((
        SELECT SUM(COALESCE((elem->>'profit')::numeric, 0))
        FROM jsonb_array_elements(COALESCE(p_data->'otherProfits', '[]'::jsonb)) AS elem
      ), 0);
$$;

CREATE OR REPLACE FUNCTION public.mining_ledger_crew_payout_auec(
  p_data jsonb,
  p_crew_id text
)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_total_payout numeric;
  v_total_shares numeric := 0;
  v_member_shares numeric := 0;
BEGIN
  IF p_data IS NULL OR p_crew_id IS NULL OR length(trim(p_crew_id)) < 1 THEN
    RETURN 0;
  END IF;

  v_total_payout := public.mining_ledger_total_payout(p_data);

  SELECT COALESCE(SUM((elem->>'shares')::numeric), 0)
  INTO v_total_shares
  FROM jsonb_array_elements(COALESCE(p_data->'crew', '[]'::jsonb)) AS elem;

  IF v_total_shares <= 0 THEN
    RETURN 0;
  END IF;

  SELECT COALESCE((elem->>'shares')::numeric, 0)
  INTO v_member_shares
  FROM jsonb_array_elements(COALESCE(p_data->'crew', '[]'::jsonb)) AS elem
  WHERE elem->>'id' = p_crew_id
  LIMIT 1;

  RETURN ROUND((v_total_payout / v_total_shares) * v_member_shares)::bigint;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mining_ledger_total_payout(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mining_ledger_crew_payout_auec(jsonb, text) TO authenticated;

-- Notify crew members newly marked paid (linked site accounts only).
CREATE OR REPLACE FUNCTION public.notify_mining_ledger_crew_paid(
  p_ledger_id uuid,
  p_ledger_name text,
  p_old_data jsonb,
  p_new_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_name text;
  v_new_elem jsonb;
  v_old_elem jsonb;
  v_linked uuid;
  v_payout bigint;
BEGIN
  IF p_new_data IS NULL OR p_old_data IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(rsi_handle, display_name, email, 'Someone')
  INTO v_actor_name
  FROM public.profiles
  WHERE id = auth.uid();

  FOR v_new_elem IN
    SELECT elem FROM jsonb_array_elements(COALESCE(p_new_data->'crew', '[]'::jsonb)) AS elem
  LOOP
    SELECT elem INTO v_old_elem
    FROM jsonb_array_elements(COALESCE(p_old_data->'crew', '[]'::jsonb)) AS elem
    WHERE elem->>'id' = v_new_elem->>'id'
    LIMIT 1;

    IF v_old_elem IS NULL THEN
      CONTINUE;
    END IF;

    IF COALESCE((v_old_elem->>'isPaid')::boolean, false) THEN
      CONTINUE;
    END IF;

    IF NOT COALESCE((v_new_elem->>'isPaid')::boolean, false) THEN
      CONTINUE;
    END IF;

    IF v_new_elem->>'linkedUserId' IS NULL OR length(trim(v_new_elem->>'linkedUserId')) < 1 THEN
      CONTINUE;
    END IF;

    BEGIN
      v_linked := (v_new_elem->>'linkedUserId')::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        CONTINUE;
    END;

    IF v_linked = auth.uid() THEN
      CONTINUE;
    END IF;

    v_payout := NULL;
    IF v_new_elem ? 'paidPayoutAuec' AND v_new_elem->>'paidPayoutAuec' IS NOT NULL THEN
      BEGIN
        v_payout := (v_new_elem->>'paidPayoutAuec')::bigint;
      EXCEPTION
        WHEN invalid_text_representation THEN
          v_payout := NULL;
      END;
    END IF;

    IF v_payout IS NULL THEN
      v_payout := public.mining_ledger_crew_payout_auec(p_new_data, v_new_elem->>'id');
    END IF;

    PERFORM public.create_user_notification(
      v_linked,
      'mining_ledger_payout',
      'Mining payout recorded',
      v_actor_name || ' marked you paid ' || public.format_dfp_auec(v_payout) || ' · ' || p_ledger_name,
      jsonb_build_object(
        'ledger_id', p_ledger_id,
        'ledger_name', p_ledger_name,
        'payout_auec', v_payout,
        'paid_by', auth.uid(),
        'paid_by_name', v_actor_name
      )
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_mining_ledger(
  p_ledger_id uuid,
  p_name text DEFAULT NULL,
  p_data jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_old_data jsonb;
  v_ledger_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT public.mining_ledger_can_access(p_ledger_id, auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  SELECT data, name INTO v_old_data, v_ledger_name
  FROM public.mining_ledgers
  WHERE id = p_ledger_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ledger not found');
  END IF;

  IF p_name IS NOT NULL THEN
    v_name := trim(p_name);
    IF length(v_name) < 1 OR length(v_name) > 120 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ledger name must be 1–120 characters');
    END IF;
    v_ledger_name := v_name;
  END IF;

  IF p_data IS NOT NULL THEN
    PERFORM public.notify_mining_ledger_crew_paid(p_ledger_id, v_ledger_name, v_old_data, p_data);
  END IF;

  UPDATE public.mining_ledgers
  SET
    name = COALESCE(v_name, name),
    data = COALESCE(p_data, data),
    updated_at = now()
  WHERE id = p_ledger_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.close_mining_ledger(p_ledger_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ledger public.mining_ledgers%ROWTYPE;
  v_actor_name text;
  v_collab_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT public.mining_ledger_can_access(p_ledger_id, auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  SELECT * INTO v_ledger FROM public.mining_ledgers WHERE id = p_ledger_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ledger not found');
  END IF;

  SELECT COALESCE(rsi_handle, display_name, email, 'Someone')
  INTO v_actor_name
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_ledger.created_by IS DISTINCT FROM auth.uid() THEN
    PERFORM public.create_user_notification(
      v_ledger.created_by,
      'mining_ledger_closed',
      'Mining ledger closed',
      v_actor_name || ' closed the ledger "' || v_ledger.name || '"',
      jsonb_build_object('ledger_id', p_ledger_id, 'ledger_name', v_ledger.name, 'closed_by', auth.uid())
    );
  END IF;

  FOR v_collab_id IN
    SELECT c.user_id
    FROM public.mining_ledger_collaborators c
    WHERE c.ledger_id = p_ledger_id
      AND c.user_id IS DISTINCT FROM auth.uid()
  LOOP
    PERFORM public.create_user_notification(
      v_collab_id,
      'mining_ledger_closed',
      'Mining ledger closed',
      v_actor_name || ' closed the ledger "' || v_ledger.name || '"',
      jsonb_build_object('ledger_id', p_ledger_id, 'ledger_name', v_ledger.name, 'closed_by', auth.uid())
    );
  END LOOP;

  DELETE FROM public.mining_ledgers WHERE id = p_ledger_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.add_mining_ledger_collaborator(
  p_ledger_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_verified boolean;
  v_ledger_name text;
  v_actor_name text;
  v_row_count bigint := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT public.mining_ledger_can_access(p_ledger_id, auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  SELECT COALESCE(rsi_handle_verified, false) INTO v_verified
  FROM public.profiles WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Member not found');
  END IF;

  IF NOT v_verified THEN
    RETURN jsonb_build_object('success', false, 'error', 'Collaborator must have a verified RSI Handle');
  END IF;

  SELECT name INTO v_ledger_name FROM public.mining_ledgers WHERE id = p_ledger_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ledger not found');
  END IF;

  INSERT INTO public.mining_ledger_collaborators (ledger_id, user_id, added_by)
  VALUES (p_ledger_id, p_user_id, auth.uid())
  ON CONFLICT (ledger_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count > 0 AND p_user_id IS DISTINCT FROM auth.uid() THEN
    SELECT COALESCE(rsi_handle, display_name, email, 'Someone')
    INTO v_actor_name
    FROM public.profiles
    WHERE id = auth.uid();

    PERFORM public.create_user_notification(
      p_user_id,
      'mining_ledger_access_added',
      'Mining ledger access granted',
      v_actor_name || ' added you to manage "' || v_ledger_name || '"',
      jsonb_build_object(
        'ledger_id', p_ledger_id,
        'ledger_name', v_ledger_name,
        'added_by', auth.uid()
      )
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_mining_ledger_collaborator(
  p_ledger_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ledger_name text;
  v_actor_name text;
  v_row_count bigint := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT public.mining_ledger_can_access(p_ledger_id, auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  SELECT name INTO v_ledger_name FROM public.mining_ledgers WHERE id = p_ledger_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ledger not found');
  END IF;

  DELETE FROM public.mining_ledger_collaborators
  WHERE ledger_id = p_ledger_id AND user_id = p_user_id;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  IF v_row_count > 0 AND p_user_id IS DISTINCT FROM auth.uid() THEN
    SELECT COALESCE(rsi_handle, display_name, email, 'Someone')
    INTO v_actor_name
    FROM public.profiles
    WHERE id = auth.uid();

    PERFORM public.create_user_notification(
      p_user_id,
      'mining_ledger_access_removed',
      'Mining ledger access removed',
      v_actor_name || ' removed your access to "' || v_ledger_name || '"',
      jsonb_build_object(
        'ledger_id', p_ledger_id,
        'ledger_name', v_ledger_name,
        'removed_by', auth.uid()
      )
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;
