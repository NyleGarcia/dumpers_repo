-- Per-blueprint orderable overrides (super-admin). Catalog isReward lives in game-blueprints.json.

CREATE TABLE IF NOT EXISTS public.blueprint_order_overrides (
  blueprint_id text PRIMARY KEY,
  is_orderable boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS blueprint_order_overrides_orderable_idx
  ON public.blueprint_order_overrides (is_orderable);

ALTER TABLE public.blueprint_order_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blueprint_order_overrides_select_authenticated" ON public.blueprint_order_overrides;
CREATE POLICY "blueprint_order_overrides_select_authenticated"
  ON public.blueprint_order_overrides FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "blueprint_order_overrides_super_admin_all" ON public.blueprint_order_overrides;
CREATE POLICY "blueprint_order_overrides_super_admin_all"
  ON public.blueprint_order_overrides FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.set_blueprint_orderable(
  p_blueprint_id text,
  p_is_orderable boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super-admin access required';
  END IF;

  IF p_blueprint_id IS NULL OR trim(p_blueprint_id) = '' THEN
    RAISE EXCEPTION 'blueprint_id is required';
  END IF;

  INSERT INTO public.blueprint_order_overrides (blueprint_id, is_orderable, updated_at, updated_by)
  VALUES (trim(p_blueprint_id), p_is_orderable, now(), auth.uid())
  ON CONFLICT (blueprint_id) DO UPDATE
  SET is_orderable = EXCLUDED.is_orderable,
      updated_at = now(),
      updated_by = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_blueprint_order_override(p_blueprint_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super-admin access required';
  END IF;

  DELETE FROM public.blueprint_order_overrides
  WHERE blueprint_id = trim(p_blueprint_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_blueprint_orderable(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_blueprint_order_override(text) TO authenticated;
