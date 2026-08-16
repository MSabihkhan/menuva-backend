-- -----------------------------------------------------------------------------
-- 20260817040000_drop_old_end_session_overload.sql
-- -----------------------------------------------------------------------------
-- Adding the p_force parameter created a SECOND end_diner_session rather than
-- replacing the first: CREATE OR REPLACE only matches on the full argument
-- list. With both a 1-arg and a 2-arg version present, a call passing only
-- p_session_id matched both and PostgREST refused it as ambiguous, so every
-- attempt to close a table failed with "Failed to end session".
--
-- Dropping the original leaves the 2-arg version, whose p_force defaults to
-- false, so existing callers keep working unchanged.
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.end_diner_session(uuid);
