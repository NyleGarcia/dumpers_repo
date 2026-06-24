-- Mining Tracker: deposit type + location-aware profiles (surface/asteroid dual cards)

ALTER TABLE public.mining_tracker_entries
  ADD COLUMN IF NOT EXISTS deposit_type text NOT NULL DEFAULT 'surface',
  ADD COLUMN IF NOT EXISTS profile_mode text NOT NULL DEFAULT 'overall',
  ADD COLUMN IF NOT EXISTS location_name text NULL;

ALTER TABLE public.mining_tracker_entries
  DROP CONSTRAINT IF EXISTS mining_tracker_entries_user_id_ore_name_key;

ALTER TABLE public.mining_tracker_entries
  ADD CONSTRAINT mining_tracker_entries_user_ore_deposit_key
  UNIQUE (user_id, ore_name, deposit_type);

ALTER TABLE public.mining_tracker_entries
  DROP CONSTRAINT IF EXISTS mining_tracker_entries_deposit_type_check;

ALTER TABLE public.mining_tracker_entries
  ADD CONSTRAINT mining_tracker_entries_deposit_type_check
  CHECK (deposit_type IN ('surface', 'asteroid'));

ALTER TABLE public.mining_tracker_entries
  DROP CONSTRAINT IF EXISTS mining_tracker_entries_profile_mode_check;

ALTER TABLE public.mining_tracker_entries
  ADD CONSTRAINT mining_tracker_entries_profile_mode_check
  CHECK (profile_mode IN ('overall', 'location'));

-- ─────────────────────────────────────────────────────────────────────────────
-- Get user's mining tracker entries
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_mining_tracker_entries();

CREATE OR REPLACE FUNCTION public.get_mining_tracker_entries()
RETURNS TABLE (
  id uuid,
  ore_name text,
  rarity text,
  deposit_type text,
  profile_mode text,
  location_name text,
  added_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, ore_name, rarity, deposit_type, profile_mode, location_name, added_at
  FROM public.mining_tracker_entries
  WHERE user_id = auth.uid()
  ORDER BY added_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_mining_tracker_entries() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Add or update ore in mining tracker (upsert by ore + deposit type)
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.add_mining_tracker_entry(text, text);
DROP FUNCTION IF EXISTS public.add_mining_tracker_entry(text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.add_mining_tracker_entry(
  p_ore_name text,
  p_rarity text,
  p_deposit_type text DEFAULT 'surface',
  p_profile_mode text DEFAULT 'overall',
  p_location_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_id uuid;
  v_was_insert boolean := false;
BEGIN
  IF p_deposit_type NOT IN ('surface', 'asteroid') THEN
    RAISE EXCEPTION 'Invalid deposit_type: %', p_deposit_type;
  END IF;
  IF p_profile_mode NOT IN ('overall', 'location') THEN
    RAISE EXCEPTION 'Invalid profile_mode: %', p_profile_mode;
  END IF;

  INSERT INTO public.mining_tracker_entries (
    user_id, ore_name, rarity, deposit_type, profile_mode, location_name
  )
  VALUES (
    auth.uid(),
    p_ore_name,
    p_rarity,
    p_deposit_type,
    p_profile_mode,
    CASE WHEN p_profile_mode = 'location' THEN p_location_name ELSE NULL END
  )
  ON CONFLICT (user_id, ore_name, deposit_type)
  DO UPDATE SET
    rarity = EXCLUDED.rarity,
    profile_mode = EXCLUDED.profile_mode,
    location_name = EXCLUDED.location_name,
    added_at = now()
  RETURNING id INTO v_entry_id;

  GET DIAGNOSTICS v_was_insert = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_entry_id,
    'updated', NOT v_was_insert
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_mining_tracker_entry(text, text, text, text, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Remove ore from mining tracker by composite id (ore:deposit) or ore + deposit
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.remove_mining_tracker_entry(text);
DROP FUNCTION IF EXISTS public.remove_mining_tracker_entry(text, text, text);

CREATE OR REPLACE FUNCTION public.remove_mining_tracker_entry(
  p_entry_id text DEFAULT NULL,
  p_ore_name text DEFAULT NULL,
  p_deposit_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ore text;
  v_deposit text;
BEGIN
  IF p_entry_id IS NOT NULL AND p_entry_id LIKE '%:%' THEN
    v_ore := split_part(p_entry_id, ':', 1);
    v_deposit := split_part(p_entry_id, ':', 2);
  ELSE
    v_ore := COALESCE(p_ore_name, p_entry_id);
    v_deposit := COALESCE(p_deposit_type, 'surface');
  END IF;

  DELETE FROM public.mining_tracker_entries
  WHERE user_id = auth.uid()
    AND ore_name = v_ore
    AND deposit_type = v_deposit;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_mining_tracker_entry(text, text, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Batch import mining tracker entries (for migration from localStorage)
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.import_mining_tracker_entries(jsonb);

CREATE OR REPLACE FUNCTION public.import_mining_tracker_entries(
  p_entries jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry jsonb;
  v_imported int := 0;
  v_deposit text;
  v_mode text;
BEGIN
  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    v_deposit := COALESCE(NULLIF(v_entry->>'depositType', ''), 'surface');
    v_mode := COALESCE(NULLIF(v_entry->>'profileMode', ''), 'overall');

    INSERT INTO public.mining_tracker_entries (
      user_id,
      ore_name,
      rarity,
      deposit_type,
      profile_mode,
      location_name
    )
    VALUES (
      auth.uid(),
      v_entry->>'oreName',
      v_entry->>'rarity',
      v_deposit,
      v_mode,
      CASE WHEN v_mode = 'location' THEN v_entry->>'locationName' ELSE NULL END
    )
    ON CONFLICT (user_id, ore_name, deposit_type) DO UPDATE SET
      rarity = EXCLUDED.rarity,
      profile_mode = EXCLUDED.profile_mode,
      location_name = EXCLUDED.location_name;

    v_imported := v_imported + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'imported', v_imported);
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_mining_tracker_entries(jsonb) TO authenticated;
