CREATE OR REPLACE FUNCTION public.email_is_registered(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(email) = lower(trim(p_email))
  );
$$;

REVOKE ALL ON FUNCTION public.email_is_registered(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_is_registered(text) TO anon, authenticated;
