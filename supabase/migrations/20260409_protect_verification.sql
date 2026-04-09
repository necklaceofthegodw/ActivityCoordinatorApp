-- Prevent regular users from self-verifying via direct DB update.
-- The Edge Function uses service_role key which bypasses RLS and this trigger check.
-- Regular authenticated users can set is_verified = false (needed for avatar change)
-- but cannot set is_verified = true themselves.

CREATE OR REPLACE FUNCTION public.prevent_self_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role (Edge Function) is allowed to change is_verified freely
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Block any attempt to set is_verified = true via frontend
  IF NEW.is_verified = TRUE AND OLD.is_verified = FALSE THEN
    RAISE EXCEPTION 'Verification must go through the verification endpoint';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_verification_flow
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_verification();
