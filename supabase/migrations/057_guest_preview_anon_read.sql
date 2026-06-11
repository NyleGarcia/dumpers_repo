-- 057 Guest preview: allow anonymous read of public reference data

GRANT SELECT ON public.starstrings_sync_meta TO anon;
GRANT SELECT ON public.starstrings_mining TO anon;
GRANT SELECT ON public.starstrings_components TO anon;
GRANT SELECT ON public.starstrings_ordnance TO anon;
GRANT SELECT ON public.starstrings_blueprint_pools TO anon;
GRANT SELECT ON public.starstrings_blueprint_standings TO anon;

GRANT EXECUTE ON FUNCTION public.get_starstrings_sync_status() TO anon;
