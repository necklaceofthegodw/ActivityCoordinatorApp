-- Add profile verification fields
ALTER TABLE public.profiles
  ADD COLUMN is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN verification_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN last_attempt_at timestamptz;

-- Grandfather all existing users as verified
UPDATE public.profiles SET is_verified = true;
