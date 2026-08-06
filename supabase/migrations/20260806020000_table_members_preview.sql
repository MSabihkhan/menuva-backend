-- -----------------------------------------------------------------------------
-- 20260806020000_table_members_preview.sql
-- -----------------------------------------------------------------------------
-- The join screen could not show who was already at the table: a diner who has
-- not joined yet holds no token, so every existing endpoint was closed to them
-- and the second and third person to scan saw an empty screen with no sign
-- that their friends were already ordering.
--
-- SECURITY DEFINER so an unauthenticated scanner can read it, but deliberately
-- narrow: it takes a QR token (an unguessable 128-bit value printed on that
-- one table), and returns ONLY the display name and initials of members of
-- that table's currently-open session. No ids, no cart, no order, no totals,
-- nothing about any other table. Knowing the token already grants the right to
-- join the table and see these same names.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_table_members(p_qr_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_table RECORD;
  v_session RECORD;
  v_members jsonb;
BEGIN
  SELECT t.id, t.code, t.label
  INTO v_table
  FROM tables t
  WHERE t.qr_token = p_qr_token
    AND t.is_active = true
    AND t.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or inactive QR token' USING ERRCODE = 'P0001';
  END IF;

  SELECT s.id INTO v_session
  FROM table_sessions s
  WHERE s.table_id = v_table.id
    AND s.closed_at IS NULL
    AND s.expires_at > now()
  ORDER BY s.opened_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    -- No open session: nobody is at the table yet. Not an error.
    RETURN jsonb_build_object(
      'tableCode', v_table.code,
      'tableLabel', v_table.label,
      'members', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('name', sm.name, 'initials', sm.initials)
    ORDER BY sm.joined_at
  ), '[]'::jsonb)
  INTO v_members
  FROM session_members sm
  WHERE sm.session_id = v_session.id;

  RETURN jsonb_build_object(
    'tableCode', v_table.code,
    'tableLabel', v_table.label,
    'members', v_members
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_table_members(text) TO anon, authenticated;
