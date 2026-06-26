-- Drop "(DFP required)" suffix from formatted order prices in notifications and Discord.
CREATE OR REPLACE FUNCTION public.format_dfp_auec(p_amount bigint)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_amount IS NULL OR p_amount <= 0 THEN '—'
    ELSE to_char(p_amount, 'FM999,999,999,999') || ' aUEC'
  END;
$$;
