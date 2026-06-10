-- StarStrings Data Tables
-- Stores extracted data from MrKraken's StarStrings for easy sync

-- Metadata table for tracking sync status
CREATE TABLE IF NOT EXISTS public.starstrings_sync_meta (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- singleton row
  last_synced_at TIMESTAMPTZ,
  source_url TEXT,
  source_version TEXT,
  sync_status TEXT DEFAULT 'idle', -- 'idle', 'syncing', 'success', 'error'
  sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mining locations data
CREATE TABLE IF NOT EXISTS public.starstrings_mining (
  id SERIAL PRIMARY KEY,
  ore_name TEXT NOT NULL UNIQUE,
  rarity TEXT NOT NULL, -- 'legendary', 'epic', 'rare', 'uncommon', 'common', 'handMineable'
  locations TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Component types data
CREATE TABLE IF NOT EXISTS public.starstrings_components (
  id SERIAL PRIMARY KEY,
  internal_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  component_type TEXT NOT NULL, -- 'Cooler', 'Power Plant', etc.
  type_code TEXT NOT NULL,      -- 'COOL', 'POWR', etc.
  manufacturer TEXT NOT NULL,
  manufacturer_code TEXT NOT NULL,
  size INTEGER NOT NULL,
  class TEXT NOT NULL,          -- 'Military', 'Civilian', etc.
  class_code TEXT NOT NULL,     -- 'Mil', 'Civ', etc.
  grade CHAR(1) NOT NULL,       -- 'A', 'B', 'C', 'D'
  grade_rank INTEGER NOT NULL,  -- 1-4
  full_label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ordnance data (missiles/torpedoes)
CREATE TABLE IF NOT EXISTS public.starstrings_ordnance (
  id SERIAL PRIMARY KEY,
  internal_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  guidance TEXT NOT NULL,       -- 'Cross-Section', 'Electromagnetic', 'Infrared'
  guidance_code TEXT NOT NULL,  -- 'CS', 'EM', 'IR'
  size INTEGER NOT NULL,
  is_gimbal BOOLEAN NOT NULL DEFAULT FALSE,
  is_torpedo BOOLEAN NOT NULL DEFAULT FALSE,
  ordnance_type TEXT NOT NULL,  -- 'Missile', 'Torpedo'
  manufacturer TEXT,
  full_label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contract blueprint pools
CREATE TABLE IF NOT EXISTS public.starstrings_blueprint_pools (
  id SERIAL PRIMARY KEY,
  contract_key TEXT NOT NULL UNIQUE,
  blueprints TEXT[] NOT NULL DEFAULT '{}',
  standing_tier TEXT NOT NULL,  -- 'neutral', 'friendly', 'trusted', 'jr_contractor', 'sr_contractor', 'master', 'unknown'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blueprint to standing mapping (derived from pools)
CREATE TABLE IF NOT EXISTS public.starstrings_blueprint_standings (
  id SERIAL PRIMARY KEY,
  blueprint_name TEXT NOT NULL UNIQUE,
  min_standing TEXT NOT NULL,
  contract_keys TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_mining_rarity ON public.starstrings_mining(rarity);
CREATE INDEX IF NOT EXISTS idx_components_type ON public.starstrings_components(component_type);
CREATE INDEX IF NOT EXISTS idx_components_manufacturer ON public.starstrings_components(manufacturer);
CREATE INDEX IF NOT EXISTS idx_components_size ON public.starstrings_components(size);
CREATE INDEX IF NOT EXISTS idx_ordnance_guidance ON public.starstrings_ordnance(guidance);
CREATE INDEX IF NOT EXISTS idx_ordnance_size ON public.starstrings_ordnance(size);
CREATE INDEX IF NOT EXISTS idx_blueprint_pools_standing ON public.starstrings_blueprint_pools(standing_tier);

-- Enable RLS
ALTER TABLE public.starstrings_sync_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.starstrings_mining ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.starstrings_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.starstrings_ordnance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.starstrings_blueprint_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.starstrings_blueprint_standings ENABLE ROW LEVEL SECURITY;

-- Everyone can read the data (it's game data, not user-specific)
CREATE POLICY "Anyone can read starstrings_sync_meta" ON public.starstrings_sync_meta
  FOR SELECT USING (true);
CREATE POLICY "Anyone can read starstrings_mining" ON public.starstrings_mining
  FOR SELECT USING (true);
CREATE POLICY "Anyone can read starstrings_components" ON public.starstrings_components
  FOR SELECT USING (true);
CREATE POLICY "Anyone can read starstrings_ordnance" ON public.starstrings_ordnance
  FOR SELECT USING (true);
CREATE POLICY "Anyone can read starstrings_blueprint_pools" ON public.starstrings_blueprint_pools
  FOR SELECT USING (true);
CREATE POLICY "Anyone can read starstrings_blueprint_standings" ON public.starstrings_blueprint_standings
  FOR SELECT USING (true);

-- Only super-admins can modify (via Edge Function with service role)
-- The Edge Function uses service_role key which bypasses RLS

-- Insert initial sync meta row
INSERT INTO public.starstrings_sync_meta (id, sync_status) 
VALUES (1, 'idle')
ON CONFLICT (id) DO NOTHING;

-- RPC function to get sync status (for UI)
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
  RETURN QUERY
  SELECT 
    m.last_synced_at,
    m.source_version,
    m.sync_status,
    m.sync_error,
    (SELECT COUNT(*) FROM public.starstrings_mining),
    (SELECT COUNT(*) FROM public.starstrings_components),
    (SELECT COUNT(*) FROM public.starstrings_ordnance),
    (SELECT COUNT(*) FROM public.starstrings_blueprint_pools)
  FROM public.starstrings_sync_meta m
  WHERE m.id = 1;
END;
$$;
