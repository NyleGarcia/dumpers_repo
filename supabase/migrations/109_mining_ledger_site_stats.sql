-- Lifetime stats for closed (archived) mining crew ledgers — McDonald's-style site totals.

CREATE TABLE IF NOT EXISTS public.mining_ledger_site_stats (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  archived_ledger_count bigint NOT NULL DEFAULT 0,
  crew_member_count bigint NOT NULL DEFAULT 0,
  total_payout_auec bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.mining_ledger_site_stats (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.mining_ledger_site_stats ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.mining_ledger_crew_listed_count(p_data jsonb)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(jsonb_array_length(COALESCE(p_data->'crew', '[]'::jsonb)), 0)::bigint;
$$;

CREATE OR REPLACE FUNCTION public.record_mining_ledger_archive_stats(p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_crew_count bigint;
  v_total_payout bigint;
BEGIN
  v_crew_count := public.mining_ledger_crew_listed_count(p_data);
  v_total_payout := GREATEST(0, ROUND(COALESCE(public.mining_ledger_total_payout(p_data), 0)))::bigint;

  UPDATE public.mining_ledger_site_stats
  SET
    archived_ledger_count = archived_ledger_count + 1,
    crew_member_count = crew_member_count + v_crew_count,
    total_payout_auec = total_payout_auec + v_total_payout,
    updated_at = now()
  WHERE id = 1;

  IF NOT FOUND THEN
    INSERT INTO public.mining_ledger_site_stats (
      id, archived_ledger_count, crew_member_count, total_payout_auec
    )
    VALUES (1, 1, v_crew_count, v_total_payout);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_mining_ledger_site_stats()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'archived_ledger_count', COALESCE(
      (SELECT archived_ledger_count FROM public.mining_ledger_site_stats WHERE id = 1),
      0
    ),
    'crew_member_count', COALESCE(
      (SELECT crew_member_count FROM public.mining_ledger_site_stats WHERE id = 1),
      0
    ),
    'total_payout_auec', COALESCE(
      (SELECT total_payout_auec FROM public.mining_ledger_site_stats WHERE id = 1),
      0
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_mining_ledger_site_stats() TO authenticated;

DROP FUNCTION IF EXISTS public.close_mining_ledger(uuid);

CREATE OR REPLACE FUNCTION public.close_mining_ledger(
  p_ledger_id uuid,
  p_record_archive_stats boolean DEFAULT false
)
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

  IF p_record_archive_stats THEN
    PERFORM public.record_mining_ledger_archive_stats(v_ledger.data);
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

GRANT EXECUTE ON FUNCTION public.close_mining_ledger(uuid, boolean) TO authenticated;
