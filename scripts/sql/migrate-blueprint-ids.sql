-- ============================================================================
-- Blueprint ID Migration: Convert file paths to internalName format
-- ============================================================================
-- 
-- This migration converts blueprint_id values from long file paths like:
--   LIVEFiles\libs\foundry\records\crafting\blueprints\...\bp_craft_behr_lmg_ballistic_01_mag.json
-- 
-- To short, lowercase internalName format like:
--   behr_lmg_ballistic_01_mag
--
-- RUN THIS IN YOUR SUPABASE SQL EDITOR
-- ============================================================================

-- First, let's see what we're working with (preview - run this first to check)
-- SELECT 
--   blueprint_id,
--   LOWER(regexp_replace(regexp_replace(blueprint_id, '.*[/\\]bp_craft_', '', 'i'), '\.json$', '', 'i')) as new_id
-- FROM acquired_blueprints
-- LIMIT 20;

-- ============================================================================
-- MIGRATION STEP 1: Update acquired_blueprints table
-- ============================================================================

UPDATE acquired_blueprints 
SET blueprint_id = LOWER(
  regexp_replace(
    regexp_replace(blueprint_id, '.*[/\\\\]bp_craft_', '', 'i'),
    '\.json$', '', 'i'
  )
)
WHERE blueprint_id LIKE '%bp_craft_%';

-- ============================================================================
-- MIGRATION STEP 2: Update target_list_blueprints table
-- ============================================================================

UPDATE target_list_blueprints 
SET blueprint_id = LOWER(
  regexp_replace(
    regexp_replace(blueprint_id, '.*[/\\\\]bp_craft_', '', 'i'),
    '\.json$', '', 'i'
  )
)
WHERE blueprint_id LIKE '%bp_craft_%';

-- ============================================================================
-- MIGRATION STEP 3: Update blueprint_order_overrides table
-- ============================================================================

UPDATE blueprint_order_overrides 
SET blueprint_id = LOWER(
  regexp_replace(
    regexp_replace(blueprint_id, '.*[/\\\\]bp_craft_', '', 'i'),
    '\.json$', '', 'i'
  )
)
WHERE blueprint_id LIKE '%bp_craft_%';

-- ============================================================================
-- VERIFICATION: Check the results
-- ============================================================================

-- Check acquired_blueprints
SELECT 'acquired_blueprints' as table_name, COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE blueprint_id LIKE '%bp_craft_%') as old_format,
  COUNT(*) FILTER (WHERE blueprint_id NOT LIKE '%\%' AND blueprint_id NOT LIKE '%/%') as new_format
FROM acquired_blueprints;

-- Check target_list_blueprints  
SELECT 'target_list_blueprints' as table_name, COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE blueprint_id LIKE '%bp_craft_%') as old_format,
  COUNT(*) FILTER (WHERE blueprint_id NOT LIKE '%\%' AND blueprint_id NOT LIKE '%/%') as new_format
FROM target_list_blueprints;

-- Sample of migrated IDs
SELECT DISTINCT blueprint_id FROM acquired_blueprints ORDER BY blueprint_id LIMIT 20;
