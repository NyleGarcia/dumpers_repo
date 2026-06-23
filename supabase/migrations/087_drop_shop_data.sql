-- Remove Shops feature tables and RPCs (extracted to separate project).
-- Game file extraction (socpaks, ShopInventories) is unchanged — only app DB integration removed.

DROP FUNCTION IF EXISTS public.get_shop_browse_tree();
DROP FUNCTION IF EXISTS public.search_shops_by_item(TEXT);
DROP FUNCTION IF EXISTS public.get_shop_by_id(INTEGER);
DROP FUNCTION IF EXISTS public.get_shop_sites(TEXT);
DROP FUNCTION IF EXISTS public.get_shop_locations_v2(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_shops_at_location_v2(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_shop_data_sync_status();
DROP FUNCTION IF EXISTS public.get_shop_systems();
DROP FUNCTION IF EXISTS public.get_shop_locations(TEXT);
DROP FUNCTION IF EXISTS public.get_shops_at_location(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_shop_inventory(INTEGER, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.get_shop_inventory_types();
DROP FUNCTION IF EXISTS public.get_shops_selling_component(TEXT);
DROP FUNCTION IF EXISTS public.get_component_price_summaries();

DROP TABLE IF EXISTS public.shop_inventory CASCADE;
DROP TABLE IF EXISTS public.component_price_summary CASCADE;
DROP TABLE IF EXISTS public.shops CASCADE;
DROP TABLE IF EXISTS public.shop_data_sync_status CASCADE;
