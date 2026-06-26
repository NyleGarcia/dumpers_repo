-- Total payout = ore profit actual − deductibles + other profits (matches app computeMiningLedger).

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
