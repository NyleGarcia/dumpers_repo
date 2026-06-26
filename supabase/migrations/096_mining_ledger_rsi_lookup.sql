-- Mining ledger: RSI handle lookup + verified-member-only access

CREATE OR REPLACE FUNCTION public.mining_ledger_caller_is_verified()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT rsi_handle_verified FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.mining_ledger_caller_is_verified() TO authenticated;

-- Exact RSI handle lookup for crew validation (verified members only)
CREATE OR REPLACE FUNCTION public.lookup_rsi_verified_member_by_handle(p_handle text)
RETURNS TABLE (
  id uuid,
  rsi_handle text,
  display_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.rsi_handle, p.display_name
  FROM public.profiles p
  WHERE p.rsi_handle_verified = true
    AND p.rsi_handle IS NOT NULL
    AND lower(trim(p.rsi_handle)) = lower(trim(p_handle))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_rsi_verified_member_by_handle(text) TO authenticated;

-- Require RSI-verified caller for create
CREATE OR REPLACE FUNCTION public.create_mining_ledger(
  p_name text,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT public.mining_ledger_caller_is_verified() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'A verified RSI Handle is required to use Mining Ledgers'
    );
  END IF;

  v_name := trim(p_name);
  IF length(v_name) < 1 OR length(v_name) > 120 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ledger name must be 1–120 characters');
  END IF;

  INSERT INTO public.mining_ledgers (name, created_by, data)
  VALUES (v_name, auth.uid(), COALESCE(p_data, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

-- Require RSI-verified caller for list
CREATE OR REPLACE FUNCTION public.list_mining_ledgers()
RETURNS TABLE (
  id uuid,
  name text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  creator_display text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.mining_ledger_caller_is_verified() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.name,
    l.created_by,
    l.created_at,
    l.updated_at,
    COALESCE(p.rsi_handle, p.display_name) AS creator_display
  FROM public.mining_ledgers l
  JOIN public.profiles p ON p.id = l.created_by
  WHERE l.created_by = auth.uid()
     OR EXISTS (
       SELECT 1 FROM public.mining_ledger_collaborators c
       WHERE c.ledger_id = l.id AND c.user_id = auth.uid()
     )
  ORDER BY l.updated_at DESC;
END;
$$;
