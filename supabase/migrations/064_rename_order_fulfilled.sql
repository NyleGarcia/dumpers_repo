-- Rename "Order Fulfilled" to "Order Accepted" to better reflect the trigger point
-- (notification fires when fulfiller accepts, not when order is complete)

-- Update the get_discord_public_event_types function to return new label
DROP FUNCTION IF EXISTS public.get_discord_public_event_types();

CREATE OR REPLACE FUNCTION public.get_discord_public_event_types()
RETURNS TABLE (
  event_type text,
  enabled boolean,
  display_name text,
  description text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 'order_new'::text, ds.order_new_enabled, 'New Orders'::text, 'When new crafting orders are placed'::text
  FROM discord_settings ds WHERE ds.id = 1
  UNION ALL
  SELECT 'order_fulfilled'::text, ds.order_fulfilled_enabled, 'Order Accepted'::text, 'When a crafter accepts an order to fulfill'::text
  FROM discord_settings ds WHERE ds.id = 1
  UNION ALL
  SELECT 'order_cancelled'::text, ds.order_cancelled_enabled, 'Order Cancelled'::text, 'When orders are cancelled'::text
  FROM discord_settings ds WHERE ds.id = 1
  UNION ALL
  SELECT 'blueprints'::text, ds.blueprints_enabled, 'Blueprint Syncs'::text, 'When blueprint data is updated from game files'::text
  FROM discord_settings ds WHERE ds.id = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_discord_public_event_types() TO anon;
GRANT EXECUTE ON FUNCTION public.get_discord_public_event_types() TO authenticated;
