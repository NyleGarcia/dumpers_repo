-- Game Data Tables Migration
-- Renames starstrings_* tables to game_* to reflect that data now comes
-- directly from game files instead of third-party StarStrings repo.

-- Step 1: Rename tables
ALTER TABLE IF EXISTS public.starstrings_sync_meta RENAME TO game_sync_meta;
ALTER TABLE IF EXISTS public.starstrings_mining RENAME TO game_mining;
ALTER TABLE IF EXISTS public.starstrings_components RENAME TO game_components;
ALTER TABLE IF EXISTS public.starstrings_ordnance RENAME TO game_ordnance;
ALTER TABLE IF EXISTS public.starstrings_blueprint_pools RENAME TO game_blueprint_pools;
ALTER TABLE IF EXISTS public.starstrings_blueprint_standings RENAME TO game_blueprint_standings;

-- Step 2: Rename indexes
ALTER INDEX IF EXISTS idx_mining_rarity RENAME TO idx_game_mining_rarity;
ALTER INDEX IF EXISTS idx_components_type RENAME TO idx_game_components_type;
ALTER INDEX IF EXISTS idx_components_manufacturer RENAME TO idx_game_components_manufacturer;
ALTER INDEX IF EXISTS idx_components_size RENAME TO idx_game_components_size;
ALTER INDEX IF EXISTS idx_ordnance_guidance RENAME TO idx_game_ordnance_guidance;
ALTER INDEX IF EXISTS idx_ordnance_size RENAME TO idx_game_ordnance_size;
ALTER INDEX IF EXISTS idx_blueprint_pools_standing RENAME TO idx_game_blueprint_pools_standing;

-- Step 3: Update RLS policies (need to drop and recreate with new table names)
-- Note: Policies are automatically renamed when tables are renamed in PostgreSQL 15+
-- For older versions, we might need to recreate them manually

-- Drop old policies (they may have been auto-renamed, but let's ensure cleanup)
DROP POLICY IF EXISTS "Anyone can read starstrings_sync_meta" ON public.game_sync_meta;
DROP POLICY IF EXISTS "Anyone can read starstrings_mining" ON public.game_mining;
DROP POLICY IF EXISTS "Anyone can read starstrings_components" ON public.game_components;
DROP POLICY IF EXISTS "Anyone can read starstrings_ordnance" ON public.game_ordnance;
DROP POLICY IF EXISTS "Anyone can read starstrings_blueprint_pools" ON public.game_blueprint_pools;
DROP POLICY IF EXISTS "Anyone can read starstrings_blueprint_standings" ON public.game_blueprint_standings;

-- Create new policies with updated names
CREATE POLICY IF NOT EXISTS "Anyone can read game_sync_meta" ON public.game_sync_meta
  FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Anyone can read game_mining" ON public.game_mining
  FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Anyone can read game_components" ON public.game_components
  FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Anyone can read game_ordnance" ON public.game_ordnance
  FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Anyone can read game_blueprint_pools" ON public.game_blueprint_pools
  FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Anyone can read game_blueprint_standings" ON public.game_blueprint_standings
  FOR SELECT USING (true);

-- Step 4: Update the RPC function
CREATE OR REPLACE FUNCTION public.get_game_data_sync_status()
RETURNS TABLE (
  last_synced_at TIMESTAMPTZ,
  source_version TEXT,
  sync_status TEXT,
  sync_error TEXT,
  mining_count BIGINT,
  components_count BIGINT,
  ordnance_count BIGINT,
  blueprint_pools_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.last_synced_at,
    m.source_version,
    m.sync_status,
    m.sync_error,
    (SELECT COUNT(*) FROM public.game_mining),
    (SELECT COUNT(*) FROM public.game_components),
    (SELECT COUNT(*) FROM public.game_ordnance),
    (SELECT COUNT(*) FROM public.game_blueprint_pools)
  FROM public.game_sync_meta m
  WHERE m.id = 1;
END;
$$;

-- Keep the old function as an alias for backward compatibility
CREATE OR REPLACE FUNCTION public.get_starstrings_sync_status()
RETURNS TABLE (
  last_synced_at TIMESTAMPTZ,
  source_version TEXT,
  sync_status TEXT,
  sync_error TEXT,
  mining_count BIGINT,
  components_count BIGINT,
  ordnance_count BIGINT,
  blueprint_pools_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.get_game_data_sync_status();
END;
$$;

-- Add comment explaining the migration
COMMENT ON TABLE public.game_sync_meta IS 'Metadata for game data synchronization (renamed from starstrings_sync_meta)';
COMMENT ON TABLE public.game_mining IS 'Mining locations and ore data extracted from game files';
COMMENT ON TABLE public.game_components IS 'Ship components data extracted from game files';
COMMENT ON TABLE public.game_ordnance IS 'Missiles and torpedoes data extracted from game files';
COMMENT ON TABLE public.game_blueprint_pools IS 'Mission-to-blueprint mappings extracted from game files';
COMMENT ON TABLE public.game_blueprint_standings IS 'Blueprint standing requirements extracted from game files';
