-- ============================================================
-- 002: Activities
-- Requires PostGIS extension to be enabled
-- ============================================================

CREATE TYPE activity_category AS ENUM ('walk', 'coffee', 'squash', 'running', 'language');
CREATE TYPE activity_status   AS ENUM ('open', 'full', 'active', 'archived', 'expired');

CREATE TABLE public.activities (
  id                   uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id         uuid               NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title                text               NOT NULL,
  description          text,
  category             activity_category  NOT NULL,
  location             geography(Point, 4326) NOT NULL,
  location_name        text,
  scheduled_at         timestamptz        NOT NULL,
  max_participants     int                NOT NULL CHECK (max_participants BETWEEN 2 AND 50),
  current_participants int                NOT NULL DEFAULT 1,
  status               activity_status    NOT NULL DEFAULT 'open',
  created_at           timestamptz        NOT NULL DEFAULT now(),

  -- Max 48h planning horizon
  CONSTRAINT scheduled_within_48h CHECK (
    scheduled_at <= now() + interval '48 hours'
    AND scheduled_at > now()
  )
);

-- Spatial index for radius queries
CREATE INDEX activities_location_idx ON public.activities USING GIST (location);
-- Index for status filter (map only shows open/full)
CREATE INDEX activities_status_idx   ON public.activities (status);
CREATE INDEX activities_category_idx ON public.activities (category);

-- ============================================================
-- RPC: get_nearby_activities
-- Returns activities within radius with organizer info
-- ============================================================
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
  organizer_avatar_url text
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
    p.avatar_url AS organizer_avatar_url
  FROM public.activities a
  JOIN public.profiles p ON p.id = a.organizer_id
  WHERE
    a.status IN ('open', 'full')
    AND ST_DWithin(a.location, ST_MakePoint(lng, lat)::geography, radius_meters)
    AND (category_filter IS NULL OR a.category = ANY(category_filter))
  ORDER BY a.scheduled_at ASC;
$$;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Anyone can read activities
CREATE POLICY "activities_select"
  ON public.activities FOR SELECT
  USING (true);

-- Authenticated, non-banned users can create activities
CREATE POLICY "activities_insert"
  ON public.activities FOR INSERT
  WITH CHECK (
    auth.uid() = organizer_id
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_banned = true
    )
  );

-- Only organizer can update their activity
CREATE POLICY "activities_update_own"
  ON public.activities FOR UPDATE
  USING (auth.uid() = organizer_id)
  WITH CHECK (auth.uid() = organizer_id);

-- Only organizer can delete their activity
CREATE POLICY "activities_delete_own"
  ON public.activities FOR DELETE
  USING (auth.uid() = organizer_id);
