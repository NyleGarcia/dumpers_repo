-- Per-user wipe of collected blueprints and tracked resources (Settings → My Data)

CREATE OR REPLACE FUNCTION public.wipe_my_acquired_blueprints()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid;
  deleted_count bigint;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF EXISTS (SELECT 1 FROM public.banned_users WHERE id = caller_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Banned accounts cannot modify data');
  END IF;

  DELETE FROM public.acquired_blueprints
  WHERE user_id = caller_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'deleted', deleted_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.wipe_my_resource_inventory()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid;
  deleted_count bigint;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF EXISTS (SELECT 1 FROM public.banned_users WHERE id = caller_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Banned accounts cannot modify data');
  END IF;

  DELETE FROM public.personal_resource_inventory
  WHERE user_id = caller_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'deleted', deleted_count);
END;
$$;

REVOKE ALL ON FUNCTION public.wipe_my_acquired_blueprints() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.wipe_my_resource_inventory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wipe_my_acquired_blueprints() TO authenticated;
GRANT EXECUTE ON FUNCTION public.wipe_my_resource_inventory() TO authenticated;

COMMENT ON FUNCTION public.wipe_my_acquired_blueprints() IS
  'Deletes all acquired_blueprints rows for the current user. Starter blueprints may be re-seeded on next app load.';

COMMENT ON FUNCTION public.wipe_my_resource_inventory() IS
  'Deletes all personal_resource_inventory rows for the current user.';
