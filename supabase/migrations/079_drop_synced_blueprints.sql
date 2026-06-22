-- =============================================================================
-- Migration 079: Drop legacy sccrafter synced_blueprints table
-- Blueprint catalog now ships from game-blueprints.json (game file extraction).
-- sync-blueprints Edge Function removed from repo.
-- =============================================================================

DROP TABLE IF EXISTS public.synced_blueprints;
