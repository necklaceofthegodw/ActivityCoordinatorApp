-- 1. Add points and tier columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier    integer NOT NULL DEFAULT 0;

-- 2. Helper: compute tier from points
CREATE OR REPLACE FUNCTION compute_tier(p integer)
RETURNS integer
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF    p >= 700 THEN RETURN 4;
  ELSIF p >= 350 THEN RETURN 3;
  ELSIF p >= 150 THEN RETURN 2;
  ELSIF p >= 50  THEN RETURN 1;
  ELSE                RETURN 0;
  END IF;
END;
$$;

-- 3. Trigger function: award points when activity becomes active
CREATE OR REPLACE FUNCTION award_points_on_active()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  host_points   integer;
  participant   record;
BEGIN
  -- Only fire on transition TO 'active'
  IF NEW.status <> 'active' OR OLD.status = 'active' THEN
    RETURN NEW;
  END IF;

  -- Host: 10 base + 5 per joiner + 10 bonus if full
  host_points := 10 + (NEW.current_participants * 5);
  IF NEW.current_participants >= NEW.max_participants THEN
    host_points := host_points + 10;
  END IF;

  UPDATE profiles
  SET points = points + host_points,
      tier   = compute_tier(points + host_points)
  WHERE id = NEW.organizer_id;

  -- Each participant: +5
  FOR participant IN
    SELECT user_id FROM participants WHERE activity_id = NEW.id
  LOOP
    UPDATE profiles
    SET points = points + 5,
        tier   = compute_tier(points + 5)
    WHERE id = participant.user_id;
  END LOOP;

  RETURN NEW;
END;
$$;

-- 4. Attach trigger to activities table
DROP TRIGGER IF EXISTS on_activity_status_active ON activities;
CREATE TRIGGER on_activity_status_active
  AFTER UPDATE ON activities
  FOR EACH ROW
  EXECUTE FUNCTION award_points_on_active();
