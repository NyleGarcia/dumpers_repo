-- Franchise org logo (blueprint modal flip back face) — Supabase Storage + site_settings

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS org_logo_updated_at timestamptz;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('org-logo', 'org-logo', true, 524288, ARRAY['image/png']::text[])
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "org_logo_public_read" ON storage.objects;
CREATE POLICY "org_logo_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'org-logo');

DROP POLICY IF EXISTS "org_logo_super_admin_insert" ON storage.objects;
CREATE POLICY "org_logo_super_admin_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'org-logo' AND public.is_super_admin());

DROP POLICY IF EXISTS "org_logo_super_admin_update" ON storage.objects;
CREATE POLICY "org_logo_super_admin_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'org-logo' AND public.is_super_admin())
  WITH CHECK (bucket_id = 'org-logo' AND public.is_super_admin());

DROP POLICY IF EXISTS "org_logo_super_admin_delete" ON storage.objects;
CREATE POLICY "org_logo_super_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'org-logo' AND public.is_super_admin());

CREATE OR REPLACE FUNCTION public.get_org_logo_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'configured', org_logo_updated_at IS NOT NULL,
    'updated_at', org_logo_updated_at
  )
  FROM public.site_settings
  WHERE id = 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_org_logo_status() TO anon;
GRANT EXECUTE ON FUNCTION public.get_org_logo_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_org_logo_uploaded()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super-admin access required';
  END IF;

  UPDATE public.site_settings
  SET org_logo_updated_at = now(),
      updated_at = now()
  WHERE id = 1;

  IF NOT FOUND THEN
    INSERT INTO public.site_settings (id, org_logo_updated_at, updated_at)
    VALUES (1, now(), now());
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_org_logo_uploaded() TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_org_logo()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Super-admin access required';
  END IF;

  UPDATE public.site_settings
  SET org_logo_updated_at = NULL,
      updated_at = now()
  WHERE id = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_org_logo() TO authenticated;
