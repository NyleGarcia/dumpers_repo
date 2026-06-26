-- Notify crew with site accounts when paid so far increases (partial or full settlement).

-- Stored cumulative paid amount from ledger crew JSON.
CREATE OR REPLACE FUNCTION public.mining_ledger_crew_paid_auec(p_elem jsonb)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v numeric;
BEGIN
  IF p_elem IS NULL THEN
    RETURN 0;
  END IF;

  IF NOT (p_elem ? 'paidPayoutAuec') OR p_elem->>'paidPayoutAuec' IS NULL THEN
    RETURN 0;
  END IF;

  BEGIN
    v := (p_elem->>'paidPayoutAuec')::numeric;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN 0;
  END;

  IF v IS NULL OR v < 0 OR v <> v THEN
    RETURN 0;
  END IF;

  RETURN ROUND(v)::bigint;
END;
$$;

-- Resolve site user from linkedUserId or verified RSI handle on playerName.
CREATE OR REPLACE FUNCTION public.mining_ledger_crew_linked_user_id(p_elem jsonb)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_linked uuid;
  v_handle text;
BEGIN
  IF p_elem IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_elem->>'linkedUserId' IS NOT NULL AND length(trim(p_elem->>'linkedUserId')) > 0 THEN
    BEGIN
      RETURN (p_elem->>'linkedUserId')::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        NULL;
    END;
  END IF;

  v_handle := trim(COALESCE(p_elem->>'playerName', ''));
  IF length(v_handle) < 2 THEN
    RETURN NULL;
  END IF;

  SELECT p.id
  INTO v_linked
  FROM public.profiles p
  WHERE p.rsi_handle_verified = true
    AND p.rsi_handle IS NOT NULL
    AND lower(trim(p.rsi_handle)) = lower(v_handle)
  LIMIT 1;

  RETURN v_linked;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mining_ledger_crew_paid_auec(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mining_ledger_crew_linked_user_id(jsonb) TO authenticated;

-- Match app: pool splits only among crew with shares > 0.
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
  v_splitting_shares numeric := 0;
  v_member_shares numeric := 0;
BEGIN
  IF p_data IS NULL OR p_crew_id IS NULL OR length(trim(p_crew_id)) < 1 THEN
    RETURN 0;
  END IF;

  v_total_payout := public.mining_ledger_total_payout(p_data);

  SELECT COALESCE(SUM((elem->>'shares')::numeric), 0)
  INTO v_splitting_shares
  FROM jsonb_array_elements(COALESCE(p_data->'crew', '[]'::jsonb)) AS elem
  WHERE COALESCE((elem->>'shares')::numeric, 0) > 0;

  IF v_splitting_shares <= 0 THEN
    RETURN 0;
  END IF;

  SELECT COALESCE((elem->>'shares')::numeric, 0)
  INTO v_member_shares
  FROM jsonb_array_elements(COALESCE(p_data->'crew', '[]'::jsonb)) AS elem
  WHERE elem->>'id' = p_crew_id
  LIMIT 1;

  IF v_member_shares <= 0 THEN
    RETURN 0;
  END IF;

  RETURN ROUND((v_total_payout / v_splitting_shares) * v_member_shares)::bigint;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mining_ledger_crew_payout_auec(jsonb, text) TO authenticated;

-- Notify when paid so far increases for crew linked to a site account.
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
  v_old_paid bigint;
  v_new_paid bigint;
  v_delta bigint;
  v_payout_act bigint;
  v_remaining bigint;
  v_fully_settled boolean;
  v_title text;
  v_body text;
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
    IF COALESCE((v_new_elem->>'shares')::numeric, 0) <= 0 THEN
      CONTINUE;
    END IF;

    SELECT elem INTO v_old_elem
    FROM jsonb_array_elements(COALESCE(p_old_data->'crew', '[]'::jsonb)) AS elem
    WHERE elem->>'id' = v_new_elem->>'id'
    LIMIT 1;

    IF v_old_elem IS NULL THEN
      v_old_paid := 0;
    ELSE
      v_old_paid := public.mining_ledger_crew_paid_auec(v_old_elem);
    END IF;

    v_new_paid := public.mining_ledger_crew_paid_auec(v_new_elem);

    -- Legacy: marked paid without a stored paid so far amount.
    IF v_new_paid = 0
      AND COALESCE((v_new_elem->>'isPaid')::boolean, false)
      AND NOT COALESCE((v_old_elem->>'isPaid')::boolean, false) THEN
      v_new_paid := public.mining_ledger_crew_payout_auec(p_new_data, v_new_elem->>'id');
    END IF;

    v_delta := v_new_paid - v_old_paid;
    IF v_delta <= 0 THEN
      CONTINUE;
    END IF;

    v_linked := public.mining_ledger_crew_linked_user_id(v_new_elem);
    IF v_linked IS NULL OR v_linked = auth.uid() THEN
      CONTINUE;
    END IF;

    v_payout_act := public.mining_ledger_crew_payout_auec(p_new_data, v_new_elem->>'id');
    v_fully_settled := v_payout_act > 0 AND v_new_paid >= v_payout_act;
    v_remaining := GREATEST(v_payout_act - v_new_paid, 0);

    IF v_fully_settled THEN
      v_title := 'Mining payout settled';
      v_body := v_actor_name || ' recorded ' || public.format_dfp_auec(v_delta)
        || ' — your share is fully paid · ' || p_ledger_name;
    ELSE
      v_title := 'Mining payout recorded';
      v_body := v_actor_name || ' recorded ' || public.format_dfp_auec(v_delta)
        || ' toward your mining payout';
      IF v_remaining > 0 THEN
        v_body := v_body || ' (' || public.format_dfp_auec(v_remaining) || ' remaining)';
      END IF;
      v_body := v_body || ' · ' || p_ledger_name;
    END IF;

    PERFORM public.create_user_notification(
      v_linked,
      'mining_ledger_payout',
      v_title,
      v_body,
      jsonb_build_object(
        'ledger_id', p_ledger_id,
        'ledger_name', p_ledger_name,
        'payout_auec', v_delta,
        'paid_total_auec', v_new_paid,
        'payout_due_auec', v_payout_act,
        'fully_settled', v_fully_settled,
        'partial', NOT v_fully_settled,
        'paid_by', auth.uid(),
        'paid_by_name', v_actor_name
      )
    );
  END LOOP;
END;
$$;
