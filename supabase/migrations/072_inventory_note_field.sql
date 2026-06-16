-- =============================================================================
-- Migration 072: Add note field to personal resource inventory
-- Allows users to add a short note (64 chars) about where they left items, etc.
-- =============================================================================

ALTER TABLE public.personal_resource_inventory
ADD COLUMN IF NOT EXISTS note varchar(64) DEFAULT NULL;

COMMENT ON COLUMN public.personal_resource_inventory.note IS
  'Optional short note (up to 64 chars) for user reference, e.g. location or purpose';

-- Function to update note on an inventory line
CREATE OR REPLACE FUNCTION public.update_inventory_note(
  p_resource_key text,
  p_quality int,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_trimmed_note text;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Trim and limit to 64 chars
  v_trimmed_note := LEFT(TRIM(COALESCE(p_note, '')), 64);
  IF v_trimmed_note = '' THEN
    v_trimmed_note := NULL;
  END IF;

  UPDATE public.personal_resource_inventory
  SET 
    note = v_trimmed_note,
    updated_at = now()
  WHERE user_id = v_user_id
    AND resource_key = p_resource_key
    AND quality = p_quality;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory line not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_inventory_note(text, int, text) TO authenticated;
