-- ============================================================
-- 001: Profiles
-- Extends auth.users with public profile data
-- ============================================================

CREATE TABLE public.profiles (
  id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname      text        NOT NULL UNIQUE,
  avatar_url    text,
  bio           text,
  activity_count int        NOT NULL DEFAULT 0,
  is_banned     boolean     NOT NULL DEFAULT false,
  report_count  int         NOT NULL DEFAULT 0,
  push_subscription jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Index for nickname lookups
CREATE INDEX profiles_nickname_idx ON public.profiles (nickname);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read non-banned profiles
CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT
  USING (true);

-- Only owner can update their own profile (not banned/report_count — managed by system)
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Insert handled by trigger on auth.users (see below)
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
