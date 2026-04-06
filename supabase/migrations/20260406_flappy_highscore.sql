ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS flappy_highscore integer NOT NULL DEFAULT 0;
