-- =============================================================================
-- Migration 069: Add slot_qualities to custom_order_blueprints
-- Enables per-slot quality tracking for mixed-quality orders
-- =============================================================================

ALTER TABLE public.custom_order_blueprints 
  ADD COLUMN IF NOT EXISTS slot_qualities jsonb DEFAULT NULL;

COMMENT ON COLUMN public.custom_order_blueprints.slot_qualities IS 
  'Per-slot quality settings as JSON object {"0": 800, "1": 700, ...}. NULL means uniform quality at min_quality.';
