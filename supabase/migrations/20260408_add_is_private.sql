-- ============================================================
-- Add is_private column to activities
-- ============================================================

ALTER TABLE public.activities
  ADD COLUMN is_private boolean NOT NULL DEFAULT false;

-- ============================================================
-- Update get_nearby_activities:
-- - exclude private activities
-- - add is_private to return shape
-- ============================================================
DROP FUNCTION IF EXISTS public.get_nearby_activities(double precision, double precision, double precision, activity_category[]);

CREATE OR REPLACE FUNCTION public.get_nearby_activities(
  lat              double precision,
  lng              double precision,
  radius_meters    double precision,
  category_filter  activity_category[] DEFAULT NULL
)
RETURNS TABLE (
  id                   uuid,
  organizer_id         uuid,
  title                text,
  description          text,
  category             activity_category,
  location_name        text,
  scheduled_at         timestamptz,
  max_participants     int,
  current_participants int,
  status               activity_status,
  created_at           timestamptz,
  lat                  double precision,
  lng                  double precision,
  organizer_nickname   text,
  organizer_avatar_url text,
  is_private           boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    a.id,
    a.organizer_id,
    a.title,
    a.description,
    a.category,
    a.location_name,
    a.scheduled_at,
    a.max_participants,
    a.current_participants,
    a.status,
    a.created_at,
    ST_Y(a.location::geometry) AS lat,
    ST_X(a.location::geometry) AS lng,
    p.nickname AS organizer_nickname,
    p.avatar_url AS organizer_avatar_url,
    a.is_private
  FROM public.activities a
  JOIN public.profiles p ON p.id = a.organizer_id
  WHERE
    a.status IN ('open', 'full')
    AND a.is_private = false
    AND ST_DWithin(a.location, ST_MakePoint(lng, lat)::geography, radius_meters)
    AND (category_filter IS NULL OR a.category = ANY(category_filter))
  ORDER BY a.scheduled_at ASC;
$$;

-- ============================================================
-- New RPC: get_activity_by_id
-- Returns a single activity by ID (works for private too)
-- Same shape as get_nearby_activities
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_activity_by_id(
  p_activity_id uuid
)
RETURNS TABLE (
  id                   uuid,
  organizer_id         uuid,
  title                text,
  description          text,
  category             activity_category,
  location_name        text,
  scheduled_at         timestamptz,
  max_participants     int,
  current_participants int,
  status               activity_status,
  created_at           timestamptz,
  lat                  double precision,
  lng                  double precision,
  organizer_nickname   text,
  organizer_avatar_url text,
  is_private           boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    a.id,
    a.organizer_id,
    a.title,
    a.description,
    a.category,
    a.location_name,
    a.scheduled_at,
    a.max_participants,
    a.current_participants,
    a.status,
    a.created_at,
    ST_Y(a.location::geometry) AS lat,
    ST_X(a.location::geometry) AS lng,
    p.nickname AS organizer_nickname,
    p.avatar_url AS organizer_avatar_url,
    a.is_private
  FROM public.activities a
  JOIN public.profiles p ON p.id = a.organizer_id
  WHERE a.id = p_activity_id;
$$;
