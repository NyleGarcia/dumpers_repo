-- Gems: whole-unit count × price per gem (no cSCU ÷ 100).

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
  v_is_gem boolean;
BEGIN
  IF p_data IS NULL THEN
    RETURN 0;
  END IF;

  FOR elem IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_data->'miningRows', '[]'::jsonb)) AS value
  LOOP
    v_is_gem := elem->>'resourceKey' IN (
      'aphorite', 'beradom', 'carinite', 'dolivine', 'feynmaline',
      'glacosite', 'hadanite', 'janalite', 'sadaryx'
    );

    BEGIN
      IF v_is_gem THEN
        v_yield := COALESCE(
          NULLIF(trim(elem->>'yieldActual'), '')::numeric,
          trunc(COALESCE((elem->>'unrefinedCscu')::numeric, 0))
        );
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

    IF v_is_gem THEN
      v_total := v_total + trunc(COALESCE(v_yield, 0)) * COALESCE(v_price, 0);
    ELSE
      v_total := v_total + (v_yield / 100.0) * COALESCE(v_price, 0);
    END IF;
  END LOOP;

  RETURN v_total;
END;
$$;
