-- =============================================================================
-- Migration 077: Guest-safe pending order count for Fulfillment teaser
-- Returns aggregate count only (no order details) for Offline Mode preview
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_pending_custom_order_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint
  FROM public.custom_orders
  WHERE status = 'pending';
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_custom_order_count() TO anon;
GRANT EXECUTE ON FUNCTION public.get_pending_custom_order_count() TO authenticated;

COMMENT ON FUNCTION public.get_pending_custom_order_count() IS
  'Public pending-order count for Offline Mode Fulfillment teaser (no row data exposed)';
