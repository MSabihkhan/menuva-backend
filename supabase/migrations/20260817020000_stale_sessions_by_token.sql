-- -----------------------------------------------------------------------------
-- 20260817020000_stale_sessions_by_token.sql
-- -----------------------------------------------------------------------------
-- The join path only has the QR token, not the table id, so give it a way to
-- run the same sweep. Without this, a diner who reaches /t/<token> and joins
-- without the roster having loaded first would still be added to the previous
-- party's abandoned session.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.close_stale_sessions_for_token(p_qr_token text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_table_id uuid;
BEGIN
  SELECT id INTO v_table_id FROM tables
  WHERE qr_token = p_qr_token AND is_active = true AND deleted_at IS NULL;

  IF v_table_id IS NULL THEN
    RETURN 0; -- an invalid token is the join RPC's problem to report, not ours
  END IF;

  RETURN close_stale_table_sessions(v_table_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_stale_sessions_for_token(text) TO authenticated, anon;
