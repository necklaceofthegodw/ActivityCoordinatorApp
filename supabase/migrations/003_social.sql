-- ============================================================
-- 003: Participants, Messages, Reports
-- ============================================================

-- ---- Participants ----
CREATE TABLE public.participants (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid        NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id)   ON DELETE CASCADE,
  joined_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, user_id)
);

CREATE INDEX participants_activity_idx ON public.participants (activity_id);
CREATE INDEX participants_user_idx     ON public.participants (user_id);

ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

-- Participants can see who else is in their activity; organizer can always see
CREATE POLICY "participants_select"
  ON public.participants FOR SELECT
  USING (
    user_id = auth.uid()
    OR activity_id IN (
      SELECT id FROM public.activities WHERE organizer_id = auth.uid()
    )
    OR activity_id IN (
      SELECT activity_id FROM public.participants WHERE user_id = auth.uid()
    )
  );

-- Non-banned authenticated users can join open activities
CREATE POLICY "participants_insert"
  ON public.participants FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_banned = true
    )
    AND EXISTS (
      SELECT 1 FROM public.activities
      WHERE id = activity_id AND status = 'open'
    )
  );

-- User can leave (delete own participation)
CREATE POLICY "participants_delete_own"
  ON public.participants FOR DELETE
  USING (user_id = auth.uid());

-- ---- Trigger: update current_participants + status on join ----
CREATE OR REPLACE FUNCTION public.handle_participant_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.activities
  SET
    current_participants = current_participants + 1,
    status = CASE
      WHEN current_participants + 1 >= max_participants THEN 'full'::activity_status
      ELSE status
    END
  WHERE id = NEW.activity_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_participant_join
  AFTER INSERT ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.handle_participant_join();

-- ---- Trigger: update current_participants on leave ----
CREATE OR REPLACE FUNCTION public.handle_participant_leave()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.activities
  SET
    current_participants = current_participants - 1,
    status = CASE
      WHEN status = 'full' THEN 'open'::activity_status
      ELSE status
    END
  WHERE id = OLD.activity_id AND status IN ('open', 'full');
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_participant_leave
  AFTER DELETE ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.handle_participant_leave();

-- ---- Messages ----
CREATE TABLE public.messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid        NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id)   ON DELETE CASCADE,
  content     text        NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_activity_idx ON public.messages (activity_id, created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Only participants (or organizer) of an activity can read/write messages
CREATE POLICY "messages_select"
  ON public.messages FOR SELECT
  USING (
    activity_id IN (
      SELECT activity_id FROM public.participants WHERE user_id = auth.uid()
      UNION
      SELECT id FROM public.activities WHERE organizer_id = auth.uid()
    )
  );

CREATE POLICY "messages_insert"
  ON public.messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_banned = true
    )
    AND activity_id IN (
      SELECT activity_id FROM public.participants WHERE user_id = auth.uid()
      UNION
      SELECT id FROM public.activities WHERE organizer_id = auth.uid()
    )
  );

-- ---- Reports ----
CREATE TABLE public.reports (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason           text        NOT NULL CHECK (length(reason) BETWEEN 10 AND 500),
  created_at       timestamptz NOT NULL DEFAULT now(),
  -- One report per pair — prevents spam
  UNIQUE (reporter_id, reported_user_id),
  -- Cannot report yourself
  CONSTRAINT no_self_report CHECK (reporter_id <> reported_user_id)
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_insert"
  ON public.reports FOR INSERT
  WITH CHECK (
    reporter_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_banned = true
    )
  );

-- ---- Trigger: auto-ban after 3 unique reports ----
CREATE OR REPLACE FUNCTION public.handle_report_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  report_count int;
BEGIN
  SELECT COUNT(*) INTO report_count
  FROM public.reports
  WHERE reported_user_id = NEW.reported_user_id;

  IF report_count >= 3 THEN
    UPDATE public.profiles
    SET is_banned = true, report_count = report_count
    WHERE id = NEW.reported_user_id;
  ELSE
    UPDATE public.profiles
    SET report_count = report_count
    WHERE id = NEW.reported_user_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_report_insert
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_report_insert();
