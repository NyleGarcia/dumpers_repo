-- Approximate visitor geography from IP (resolved server-side; raw IPs are not stored).

ALTER TABLE public.site_analytics_visitors
  ADD COLUMN IF NOT EXISTS geo_country_code text,
  ADD COLUMN IF NOT EXISTS geo_country_name text,
  ADD COLUMN IF NOT EXISTS geo_region text,
  ADD COLUMN IF NOT EXISTS geo_city text,
  ADD COLUMN IF NOT EXISTS geo_timezone text,
  ADD COLUMN IF NOT EXISTS geo_resolved_at timestamptz;

ALTER TABLE public.site_analytics_daily_visitors
  ADD COLUMN IF NOT EXISTS geo_country_code text,
  ADD COLUMN IF NOT EXISTS geo_country_name text,
  ADD COLUMN IF NOT EXISTS geo_region text,
  ADD COLUMN IF NOT EXISTS geo_city text;

CREATE INDEX IF NOT EXISTS site_analytics_daily_visitors_geo_country_idx
  ON public.site_analytics_daily_visitors (visit_date DESC, geo_country_code);

DROP FUNCTION IF EXISTS public.record_analytics_ping(uuid, text, text, integer, boolean);

CREATE OR REPLACE FUNCTION public.record_analytics_ping(
  p_visitor_id uuid,
  p_tool_id text,
  p_sub_tool_id text DEFAULT '',
  p_active_seconds integer DEFAULT 0,
  p_is_guest boolean DEFAULT true,
  p_geo_country_code text DEFAULT NULL,
  p_geo_country_name text DEFAULT NULL,
  p_geo_region text DEFAULT NULL,
  p_geo_city text DEFAULT NULL,
  p_geo_timezone text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_tool text := COALESCE(p_sub_tool_id, '');
  v_seconds integer := COALESCE(p_active_seconds, 0);
  v_is_guest boolean := COALESCE(p_is_guest, true);
  v_today date := (timezone('utc', now()))::date;
  v_country_code text := NULLIF(upper(trim(COALESCE(p_geo_country_code, ''))), '');
  v_country_name text := NULLIF(trim(COALESCE(p_geo_country_name, '')), '');
  v_region text := NULLIF(trim(COALESCE(p_geo_region, '')), '');
  v_city text := NULLIF(trim(COALESCE(p_geo_city, '')), '');
  v_timezone text := NULLIF(trim(COALESCE(p_geo_timezone, '')), '');
  v_has_geo boolean := v_country_code IS NOT NULL;
BEGIN
  IF p_visitor_id IS NULL THEN
    RETURN;
  END IF;

  IF p_tool_id IS NULL OR length(trim(p_tool_id)) = 0 OR length(p_tool_id) > 64 THEN
    RETURN;
  END IF;

  IF length(v_sub_tool) > 64 THEN
    RETURN;
  END IF;

  IF v_seconds <= 0 THEN
    RETURN;
  END IF;

  IF v_seconds > 300 THEN
    v_seconds := 300;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    v_is_guest := false;
  END IF;

  IF v_country_code IS NOT NULL AND length(v_country_code) > 8 THEN
    v_country_code := left(v_country_code, 8);
  END IF;

  IF v_country_name IS NOT NULL AND length(v_country_name) > 80 THEN
    v_country_name := left(v_country_name, 80);
  END IF;

  IF v_region IS NOT NULL AND length(v_region) > 80 THEN
    v_region := left(v_region, 80);
  END IF;

  IF v_city IS NOT NULL AND length(v_city) > 80 THEN
    v_city := left(v_city, 80);
  END IF;

  IF v_timezone IS NOT NULL AND length(v_timezone) > 64 THEN
    v_timezone := left(v_timezone, 64);
  END IF;

  INSERT INTO public.site_analytics_visitors (
    id,
    user_id,
    first_seen,
    last_seen,
    is_guest,
    geo_country_code,
    geo_country_name,
    geo_region,
    geo_city,
    geo_timezone,
    geo_resolved_at
  )
  VALUES (
    p_visitor_id,
    auth.uid(),
    now(),
    now(),
    v_is_guest,
    v_country_code,
    v_country_name,
    v_region,
    v_city,
    v_timezone,
    CASE WHEN v_has_geo THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    last_seen = now(),
    user_id = COALESCE(auth.uid(), site_analytics_visitors.user_id),
    is_guest = CASE
      WHEN auth.uid() IS NOT NULL THEN false
      ELSE site_analytics_visitors.is_guest
    END,
    geo_country_code = COALESCE(EXCLUDED.geo_country_code, site_analytics_visitors.geo_country_code),
    geo_country_name = COALESCE(EXCLUDED.geo_country_name, site_analytics_visitors.geo_country_name),
    geo_region = COALESCE(EXCLUDED.geo_region, site_analytics_visitors.geo_region),
    geo_city = COALESCE(EXCLUDED.geo_city, site_analytics_visitors.geo_city),
    geo_timezone = COALESCE(EXCLUDED.geo_timezone, site_analytics_visitors.geo_timezone),
    geo_resolved_at = CASE
      WHEN EXCLUDED.geo_country_code IS NOT NULL THEN now()
      ELSE site_analytics_visitors.geo_resolved_at
    END;

  INSERT INTO public.site_analytics_daily_visitors (
    visitor_id,
    visit_date,
    is_guest,
    user_id,
    geo_country_code,
    geo_country_name,
    geo_region,
    geo_city
  )
  VALUES (
    p_visitor_id,
    v_today,
    v_is_guest,
    auth.uid(),
    v_country_code,
    v_country_name,
    v_region,
    v_city
  )
  ON CONFLICT (visitor_id, visit_date, is_guest) DO UPDATE SET
    user_id = COALESCE(auth.uid(), site_analytics_daily_visitors.user_id),
    geo_country_code = COALESCE(EXCLUDED.geo_country_code, site_analytics_daily_visitors.geo_country_code),
    geo_country_name = COALESCE(EXCLUDED.geo_country_name, site_analytics_daily_visitors.geo_country_name),
    geo_region = COALESCE(EXCLUDED.geo_region, site_analytics_daily_visitors.geo_region),
    geo_city = COALESCE(EXCLUDED.geo_city, site_analytics_daily_visitors.geo_city);

  INSERT INTO public.site_analytics_tool_visitor_daily (
    visit_date, visitor_id, tool_id, sub_tool_id, is_guest, total_seconds
  )
  VALUES (v_today, p_visitor_id, p_tool_id, v_sub_tool, v_is_guest, v_seconds)
  ON CONFLICT (visit_date, visitor_id, tool_id, sub_tool_id, is_guest) DO UPDATE SET
    total_seconds = site_analytics_tool_visitor_daily.total_seconds + EXCLUDED.total_seconds;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_site_analytics_summary(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days integer := GREATEST(1, LEAST(COALESCE(p_days, 30), 365));
  v_today date := (timezone('utc', now()))::date;
  v_result jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_build_object(
    'period_days', v_days,
    'dau_today', (
      SELECT COUNT(DISTINCT visitor_id)
      FROM public.site_analytics_daily_visitors
      WHERE visit_date = v_today
    ),
    'dau_guest_today', (
      SELECT COUNT(DISTINCT visitor_id)
      FROM public.site_analytics_daily_visitors
      WHERE visit_date = v_today
        AND is_guest = true
    ),
    'dau_signed_in_today', (
      SELECT COUNT(DISTINCT visitor_id)
      FROM public.site_analytics_daily_visitors
      WHERE visit_date = v_today
        AND is_guest = false
    ),
    'wau', (
      SELECT COUNT(DISTINCT visitor_id)
      FROM public.site_analytics_daily_visitors
      WHERE visit_date >= v_today - 6
    ),
    'wau_guest', (
      SELECT COUNT(DISTINCT visitor_id)
      FROM public.site_analytics_daily_visitors
      WHERE visit_date >= v_today - 6
        AND is_guest = true
    ),
    'wau_signed_in', (
      SELECT COUNT(DISTINCT visitor_id)
      FROM public.site_analytics_daily_visitors
      WHERE visit_date >= v_today - 6
        AND is_guest = false
    ),
    'mau', (
      SELECT COUNT(DISTINCT visitor_id)
      FROM public.site_analytics_daily_visitors
      WHERE visit_date >= v_today - 29
    ),
    'guest_mau', (
      SELECT COUNT(DISTINCT visitor_id)
      FROM public.site_analytics_daily_visitors
      WHERE visit_date >= v_today - 29
        AND is_guest = true
    ),
    'signed_in_mau', (
      SELECT COUNT(DISTINCT visitor_id)
      FROM public.site_analytics_daily_visitors
      WHERE visit_date >= v_today - 29
        AND is_guest = false
    ),
    'geo_known_visitors', (
      SELECT COUNT(DISTINCT visitor_id)
      FROM public.site_analytics_daily_visitors
      WHERE visit_date >= v_today - (v_days - 1)
        AND geo_country_code IS NOT NULL
    ),
    'geo_known_guest_visitors', (
      SELECT COUNT(DISTINCT visitor_id)
      FROM public.site_analytics_daily_visitors
      WHERE visit_date >= v_today - (v_days - 1)
        AND geo_country_code IS NOT NULL
        AND is_guest = true
    ),
    'geo_known_signed_in_visitors', (
      SELECT COUNT(DISTINCT visitor_id)
      FROM public.site_analytics_daily_visitors
      WHERE visit_date >= v_today - (v_days - 1)
        AND geo_country_code IS NOT NULL
        AND is_guest = false
    ),
    'geo_unknown_visitors', (
      SELECT COUNT(DISTINCT visitor_id)
      FROM public.site_analytics_daily_visitors
      WHERE visit_date >= v_today - (v_days - 1)
        AND geo_country_code IS NULL
    ),
    'geo_unknown_guest_visitors', (
      SELECT COUNT(DISTINCT visitor_id)
      FROM public.site_analytics_daily_visitors
      WHERE visit_date >= v_today - (v_days - 1)
        AND geo_country_code IS NULL
        AND is_guest = true
    ),
    'geo_unknown_signed_in_visitors', (
      SELECT COUNT(DISTINCT visitor_id)
      FROM public.site_analytics_daily_visitors
      WHERE visit_date >= v_today - (v_days - 1)
        AND geo_country_code IS NULL
        AND is_guest = false
    ),
    'daily_visitors', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', d.visit_date,
          'count', d.total_count,
          'guest_count', d.guest_count,
          'signed_in_count', d.signed_in_count
        )
        ORDER BY d.visit_date
      )
      FROM (
        SELECT
          visit_date,
          COUNT(DISTINCT visitor_id) AS total_count,
          COUNT(DISTINCT visitor_id) FILTER (WHERE is_guest = true) AS guest_count,
          COUNT(DISTINCT visitor_id) FILTER (WHERE is_guest = false) AS signed_in_count
        FROM public.site_analytics_daily_visitors
        WHERE visit_date >= v_today - (v_days - 1)
        GROUP BY visit_date
      ) d
    ), '[]'::jsonb),
    'geo_countries', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'country_code', g.country_code,
          'country_name', g.country_name,
          'unique_visitors', g.unique_visitors,
          'guest_visitors', g.guest_visitors,
          'signed_in_visitors', g.signed_in_visitors
        )
        ORDER BY g.unique_visitors DESC, g.country_name
      )
      FROM (
        SELECT
          geo_country_code AS country_code,
          COALESCE(MAX(geo_country_name), geo_country_code) AS country_name,
          COUNT(DISTINCT visitor_id) AS unique_visitors,
          COUNT(DISTINCT visitor_id) FILTER (WHERE is_guest = true) AS guest_visitors,
          COUNT(DISTINCT visitor_id) FILTER (WHERE is_guest = false) AS signed_in_visitors
        FROM public.site_analytics_daily_visitors
        WHERE visit_date >= v_today - (v_days - 1)
          AND geo_country_code IS NOT NULL
        GROUP BY geo_country_code
      ) g
    ), '[]'::jsonb),
    'geo_regions', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'country_code', g.country_code,
          'country_name', g.country_name,
          'region', g.region,
          'unique_visitors', g.unique_visitors,
          'guest_visitors', g.guest_visitors,
          'signed_in_visitors', g.signed_in_visitors
        )
        ORDER BY g.unique_visitors DESC, g.country_name, g.region
      )
      FROM (
        SELECT
          geo_country_code AS country_code,
          COALESCE(MAX(geo_country_name), geo_country_code) AS country_name,
          COALESCE(geo_region, 'Unknown region') AS region,
          COUNT(DISTINCT visitor_id) AS unique_visitors,
          COUNT(DISTINCT visitor_id) FILTER (WHERE is_guest = true) AS guest_visitors,
          COUNT(DISTINCT visitor_id) FILTER (WHERE is_guest = false) AS signed_in_visitors
        FROM public.site_analytics_daily_visitors
        WHERE visit_date >= v_today - (v_days - 1)
          AND geo_country_code IS NOT NULL
        GROUP BY geo_country_code, geo_region
      ) g
    ), '[]'::jsonb),
    'geo_cities', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'country_code', g.country_code,
          'country_name', g.country_name,
          'region', g.region,
          'city', g.city,
          'unique_visitors', g.unique_visitors,
          'guest_visitors', g.guest_visitors,
          'signed_in_visitors', g.signed_in_visitors
        )
        ORDER BY g.unique_visitors DESC, g.country_name, g.region, g.city
      )
      FROM (
        SELECT
          geo_country_code AS country_code,
          COALESCE(MAX(geo_country_name), geo_country_code) AS country_name,
          COALESCE(geo_region, 'Unknown region') AS region,
          COALESCE(geo_city, 'Unknown city') AS city,
          COUNT(DISTINCT visitor_id) AS unique_visitors,
          COUNT(DISTINCT visitor_id) FILTER (WHERE is_guest = true) AS guest_visitors,
          COUNT(DISTINCT visitor_id) FILTER (WHERE is_guest = false) AS signed_in_visitors
        FROM public.site_analytics_daily_visitors
        WHERE visit_date >= v_today - (v_days - 1)
          AND geo_country_code IS NOT NULL
          AND geo_city IS NOT NULL
        GROUP BY geo_country_code, geo_region, geo_city
      ) g
    ), '[]'::jsonb),
    'tool_usage', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'tool_id', t.tool_id,
          'sub_tool_id', t.sub_tool_id,
          'is_guest', t.is_guest,
          'unique_visitors', t.unique_visitors,
          'total_seconds', t.total_seconds,
          'avg_seconds', CASE
            WHEN t.unique_visitors > 0 THEN round(t.total_seconds::numeric / t.unique_visitors)
            ELSE 0
          END
        )
        ORDER BY t.total_seconds DESC, t.tool_id, t.sub_tool_id, t.is_guest DESC
      )
      FROM (
        SELECT
          tool_id,
          sub_tool_id,
          is_guest,
          COUNT(DISTINCT visitor_id) AS unique_visitors,
          SUM(total_seconds) AS total_seconds
        FROM public.site_analytics_tool_visitor_daily
        WHERE visit_date >= v_today - (v_days - 1)
        GROUP BY tool_id, sub_tool_id, is_guest
      ) t
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_analytics_ping(
  uuid, text, text, integer, boolean, text, text, text, text, text
) TO anon, authenticated;
