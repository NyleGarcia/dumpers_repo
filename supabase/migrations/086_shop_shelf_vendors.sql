-- Shelf vs kiosk shop classification (Whammers, Ellroys, etc.)

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS shop_interaction TEXT DEFAULT 'kiosk',
  ADD COLUMN IF NOT EXISTS inventory_expected BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_shops_interaction ON public.shops(shop_interaction);

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
  game_build TEXT,
  shop_interaction TEXT,
  inventory_expected BOOLEAN
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
    game_build,
    shop_interaction,
    inventory_expected
  FROM public.shops
  WHERE id = p_shop_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_shop_by_id(INTEGER) TO authenticated, anon;
