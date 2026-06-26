-- Mining crew payout ledgers (Mining Tracker → Ledger tab)

CREATE TABLE IF NOT EXISTS public.mining_ledgers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mining_ledger_collaborators (
  ledger_id uuid NOT NULL REFERENCES public.mining_ledgers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ledger_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mining_ledgers_created_by ON public.mining_ledgers(created_by);
CREATE INDEX IF NOT EXISTS idx_mining_ledgers_updated_at ON public.mining_ledgers(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mining_ledger_collaborators_user ON public.mining_ledger_collaborators(user_id);

ALTER TABLE public.mining_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mining_ledger_collaborators ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- Access helper
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mining_ledger_can_access(p_ledger_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mining_ledgers l
    WHERE l.id = p_ledger_id
      AND (
        l.created_by = p_user_id
        OR EXISTS (
          SELECT 1 FROM public.mining_ledger_collaborators c
          WHERE c.ledger_id = l.id AND c.user_id = p_user_id
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.mining_ledger_can_access(uuid, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- List ledgers visible to current user
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_mining_ledgers()
RETURNS TABLE (
  id uuid,
  name text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  creator_display text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.list_mining_ledgers() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Get single ledger with collaborators
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_mining_ledger(p_ledger_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ledger public.mining_ledgers%ROWTYPE;
  v_collaborators jsonb;
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

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'user_id', c.user_id,
      'rsi_handle', p.rsi_handle,
      'display_name', p.display_name,
      'added_at', c.created_at
    ) ORDER BY c.created_at
  ), '[]'::jsonb)
  INTO v_collaborators
  FROM public.mining_ledger_collaborators c
  JOIN public.profiles p ON p.id = c.user_id
  WHERE c.ledger_id = p_ledger_id;

  RETURN jsonb_build_object(
    'success', true,
    'ledger', jsonb_build_object(
      'id', v_ledger.id,
      'name', v_ledger.name,
      'created_by', v_ledger.created_by,
      'created_at', v_ledger.created_at,
      'updated_at', v_ledger.updated_at,
      'creator_display', (
        SELECT COALESCE(rsi_handle, display_name)
        FROM public.profiles WHERE id = v_ledger.created_by
      ),
      'data', v_ledger.data,
      'collaborators', v_collaborators
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mining_ledger(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Create ledger
-- ─────────────────────────────────────────────────────────────────────────────
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

GRANT EXECUTE ON FUNCTION public.create_mining_ledger(text, jsonb) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Update ledger
-- ─────────────────────────────────────────────────────────────────────────────
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
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT public.mining_ledger_can_access(p_ledger_id, auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  IF p_name IS NOT NULL THEN
    v_name := trim(p_name);
    IF length(v_name) < 1 OR length(v_name) > 120 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ledger name must be 1–120 characters');
    END IF;
  END IF;

  UPDATE public.mining_ledgers
  SET
    name = COALESCE(v_name, name),
    data = COALESCE(p_data, data),
    updated_at = now()
  WHERE id = p_ledger_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ledger not found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_mining_ledger(uuid, text, jsonb) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Close (delete) ledger and all collaborator rows
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.close_mining_ledger(p_ledger_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT public.mining_ledger_can_access(p_ledger_id, auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  DELETE FROM public.mining_ledgers WHERE id = p_ledger_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ledger not found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_mining_ledger(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Collaborator management (RSI verified only)
-- ─────────────────────────────────────────────────────────────────────────────
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

  INSERT INTO public.mining_ledger_collaborators (ledger_id, user_id, added_by)
  VALUES (p_ledger_id, p_user_id, auth.uid())
  ON CONFLICT (ledger_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_mining_ledger_collaborator(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_mining_ledger_collaborator(
  p_ledger_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT public.mining_ledger_can_access(p_ledger_id, auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  DELETE FROM public.mining_ledger_collaborators
  WHERE ledger_id = p_ledger_id AND user_id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_mining_ledger_collaborator(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_verified_members_for_ledger(p_query text)
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
    AND p.id <> auth.uid()
    AND length(trim(p_query)) >= 2
    AND (
      p.rsi_handle ILIKE '%' || trim(p_query) || '%'
      OR p.display_name ILIKE '%' || trim(p_query) || '%'
    )
  ORDER BY p.rsi_handle NULLS LAST, p.display_name
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.search_verified_members_for_ledger(text) TO authenticated;
