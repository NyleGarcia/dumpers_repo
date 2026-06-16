-- =============================================================================
-- Migration 073: Blueprint owner counts
-- Returns count of members who own each blueprint (excluding ghost/banned users)
-- =============================================================================

-- Get owner counts for multiple blueprints at once
CREATE OR REPLACE FUNCTION public.get_blueprint_owner_counts(p_blueprint_ids text[])
RETURNS TABLE (
  blueprint_id text,
  owner_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ab.blueprint_id,
    COUNT(DISTINCT ab.user_id) AS owner_count
  FROM public.acquired_blueprints ab
  INNER JOIN public.profiles p ON p.id = ab.user_id
  WHERE ab.blueprint_id = ANY(p_blueprint_ids)
    AND COALESCE(p.role, 'pending') <> 'pending'
    AND COALESCE(p.ghost_mode, false) = false
    AND NOT EXISTS (
      SELECT 1 FROM public.banned_users b WHERE b.id = p.id
    )
  GROUP BY ab.blueprint_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_blueprint_owner_counts(text[]) TO authenticated;

COMMENT ON FUNCTION public.get_blueprint_owner_counts(text[]) IS
  'Returns owner counts for blueprints, excluding ghost mode, pending, and banned users';

-- Get owner count for a single blueprint (convenience)
CREATE OR REPLACE FUNCTION public.get_blueprint_owner_count(p_blueprint_id text)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT ab.user_id)
  FROM public.acquired_blueprints ab
  INNER JOIN public.profiles p ON p.id = ab.user_id
  WHERE ab.blueprint_id = p_blueprint_id
    AND COALESCE(p.role, 'pending') <> 'pending'
    AND COALESCE(p.ghost_mode, false) = false
    AND NOT EXISTS (
      SELECT 1 FROM public.banned_users b WHERE b.id = p.id
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_blueprint_owner_count(text) TO authenticated;
