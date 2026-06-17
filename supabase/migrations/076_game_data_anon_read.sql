-- 076 Game data: allow anonymous read of public reference data
-- (Replaces grants from 057 for the renamed game_* tables)

GRANT SELECT ON public.game_sync_meta TO anon;
GRANT SELECT ON public.game_mining TO anon;
GRANT SELECT ON public.game_components TO anon;
GRANT SELECT ON public.game_ordnance TO anon;
GRANT SELECT ON public.game_blueprint_pools TO anon;
GRANT SELECT ON public.game_blueprint_standings TO anon;

GRANT EXECUTE ON FUNCTION public.get_game_data_sync_status() TO anon;
