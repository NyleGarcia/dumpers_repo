-- Shop socpak hierarchy fields + search RPCs
-- Extends 060_shop_data.sql for game-file shop pipeline

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS site TEXT,
  ADD COLUMN IF NOT EXISTS shop_category TEXT,
  ADD COLUMN IF NOT EXISTS franchise TEXT,
  ADD COLUMN IF NOT EXISTS shop_kind TEXT DEFAULT 'item',
  ADD COLUMN IF NOT EXISTS socpak_path TEXT,
  ADD COLUMN IF NOT EXISTS entity_guid TEXT,
  ADD COLUMN IF NOT EXISTS game_build TEXT;

CREATE INDEX IF NOT EXISTS idx_shops_site ON public.shops(system, site);
CREATE INDEX IF NOT EXISTS idx_shops_hierarchy ON public.shops(system, site, location);
CREATE INDEX IF NOT EXISTS idx_shops_franchise ON public.shops(franchise);
CREATE INDEX IF NOT EXISTS idx_shop_inventory_item_search ON public.shop_inventory(display_name);

-- Allow unknown prices until pricing extraction is complete
ALTER TABLE public.shop_inventory
  ALTER COLUMN base_price DROP NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RPC: Sites within a system
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_shop_sites(p_system TEXT)
RETURNS TABLE (site TEXT, shop_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(site, 'Unknown') AS site, COUNT(*) AS shop_count
  FROM public.shops
  WHERE system = p_system
  GROUP BY COALESCE(site, 'Unknown')
  ORDER BY site;
$$;

GRANT EXECUTE ON FUNCTION public.get_shop_sites(TEXT) TO authenticated, anon;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RPC: Locations within a system + site
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_shop_locations_v2(p_system TEXT, p_site TEXT)
RETURNS TABLE (location TEXT, location_type TEXT, shop_count BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT location, location_type, COUNT(*) AS shop_count
  FROM public.shops
  WHERE system = p_system
    AND COALESCE(site, 'Unknown') = p_site
    AND location IS NOT NULL
  GROUP BY location, location_type
  ORDER BY location;
$$;

GRANT EXECUTE ON FUNCTION public.get_shop_locations_v2(TEXT, TEXT) TO authenticated, anon;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RPC: Shops at system + site + location
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_shops_at_location_v2(
  p_system TEXT,
  p_site TEXT,
  p_location TEXT
)
RETURNS TABLE (
  id INTEGER,
  shop_reference TEXT,
  name TEXT,
  location_type TEXT,
  accepts_stolen_goods BOOLEAN,
  profit_margin NUMERIC,
  site TEXT,
  inventory_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.shop_reference,
    s.name,
    s.location_type,
    s.accepts_stolen_goods,
    s.profit_margin,
    s.site,
    COUNT(i.id) AS inventory_count
  FROM public.shops s
  LEFT JOIN public.shop_inventory i ON i.shop_id = s.id
  WHERE s.system = p_system
    AND COALESCE(s.site, 'Unknown') = p_site
    AND s.location = p_location
  GROUP BY s.id
  ORDER BY s.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_shops_at_location_v2(TEXT, TEXT, TEXT) TO authenticated, anon;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RPC: Search shops by item name (min 3 chars enforced client-side)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.search_shops_by_item(p_query TEXT)
RETURNS TABLE (
  shop_id INTEGER,
  shop_name TEXT,
  system TEXT,
  site TEXT,
  location TEXT,
  location_type TEXT,
  matching_items BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id AS shop_id,
    s.name AS shop_name,
    s.system,
    s.site,
    s.location,
    s.location_type,
    COUNT(i.id) AS matching_items
  FROM public.shops s
  JOIN public.shop_inventory i ON i.shop_id = s.id
  WHERE length(trim(p_query)) >= 3
    AND i.display_name ILIKE '%' || trim(p_query) || '%'
  GROUP BY s.id, s.name, s.system, s.site, s.location, s.location_type
  ORDER BY matching_items DESC, s.name;
$$;

GRANT EXECUTE ON FUNCTION public.search_shops_by_item(TEXT) TO authenticated, anon;

-- Return type changed from 060 — must drop before recreate
DROP FUNCTION IF EXISTS public.get_shop_by_id(INTEGER);

CREATE OR REPLACE FUNCTION public.get_shop_by_id(p_shop_id INTEGER)
RETURNS TABLE (
  id INTEGER,
  shop_reference TEXT,
  name TEXT,
  container_path TEXT,
  system TEXT,
  site TEXT,
  location TEXT,
  location_type TEXT,
  accepts_stolen_goods BOOLEAN,
  profit_margin NUMERIC,
  shop_category TEXT,
  franchise TEXT,
  game_build TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id,
    shop_reference,
    name,
    container_path,
    system,
    site,
    location,
    location_type,
    accepts_stolen_goods,
    profit_margin,
    shop_category,
    franchise,
    game_build
  FROM public.shops
  WHERE id = p_shop_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_shop_by_id(INTEGER) TO authenticated, anon;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RPC: Full browse tree (systems → sites → locations → shops)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_shop_browse_tree()
RETURNS TABLE (
  id INTEGER,
  name TEXT,
  system TEXT,
  site TEXT,
  location TEXT,
  location_type TEXT,
  inventory_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.name,
    s.system,
    COALESCE(s.site, 'Unknown') AS site,
    s.location,
    s.location_type,
    COUNT(i.id) AS inventory_count
  FROM public.shops s
  LEFT JOIN public.shop_inventory i ON i.shop_id = s.id
  GROUP BY s.id, s.name, s.system, s.site, s.location, s.location_type
  ORDER BY s.system, s.site, s.location, s.name;
$$;

GRANT EXECUTE ON FUNCTION public.get_shop_browse_tree() TO authenticated, anon;
