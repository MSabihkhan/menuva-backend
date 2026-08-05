CREATE OR REPLACE FUNCTION public.get_function_def()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pg_get_functiondef('public.place_order(uuid,text,text)'::regprocedure);
$$;
