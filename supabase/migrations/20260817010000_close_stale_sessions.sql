-- -----------------------------------------------------------------------------
-- 20260817010000_close_stale_sessions.sql
-- -----------------------------------------------------------------------------
-- A table session only ever closed when somebody paid, when staff closed it, or
-- when its 4-hour expiry ran out. Anything abandoned in between stayed OPEN, so
-- the next person to scan that table's QR was shown the previous party still
-- sitting there.
--
-- Reproduced on live data: table T6 had an open session from 111 minutes
-- earlier listing three diners, and a fresh scan reported "Sabih, Zainab,
-- subaina already here" at an empty table.
--
-- The fix has to be careful about what it closes. A real party can order and
-- then not touch their phones for an hour while they eat — closing them out
-- would strand them with an unpaid bill they can no longer see. So:
--
--   * no orders at all, idle a while      -> abandoned before ordering, close it
--   * orders all finished AND fully paid  -> the meal is over, close it
--   * anything still owing money          -> NEVER auto-close; staff decide
--
-- Run lazily, at the moment someone scans the table, which is exactly when a
-- stale session matters and costs nothing the rest of the time.
-- -----------------------------------------------------------------------------

/** Minutes of inactivity before an un-ordered session is considered abandoned. */
CREATE OR REPLACE FUNCTION public.close_stale_table_sessions(
  p_table_id            uuid,
  p_idle_minutes        int DEFAULT 30,
  p_settled_idle_minutes int DEFAULT 10
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session   RECORD;
  v_last      timestamptz;
  v_orders    int;
  v_total     bigint;
  v_settled   bigint;
  v_closed    int := 0;
BEGIN
  FOR v_session IN
    SELECT * FROM table_sessions
    WHERE table_id = p_table_id AND closed_at IS NULL
  LOOP
    -- Most recent sign of life from anyone at the table.
    SELECT GREATEST(
      v_session.opened_at,
      COALESCE((SELECT max(joined_at) FROM session_members WHERE session_id = v_session.id), v_session.opened_at),
      COALESCE((SELECT max(added_at)  FROM cart_items      WHERE session_id = v_session.id), v_session.opened_at),
      COALESCE((SELECT max(GREATEST(placed_at, COALESCE(updated_at, placed_at)))
                FROM orders WHERE session_id = v_session.id), v_session.opened_at),
      COALESCE((SELECT max(p.paid_at) FROM payments p
                JOIN orders o ON o.id = p.order_id
                WHERE o.session_id = v_session.id), v_session.opened_at)
    ) INTO v_last;

    SELECT count(*), COALESCE(sum(total), 0) INTO v_orders, v_total
    FROM orders WHERE session_id = v_session.id;

    SELECT COALESCE(sum(p.amount + COALESCE(p.discount_amount, 0)), 0) INTO v_settled
    FROM payments p JOIN orders o ON o.id = p.order_id
    WHERE o.session_id = v_session.id;

    IF v_orders = 0 THEN
      -- Nobody ordered. Nothing is owed and nothing is lost by closing.
      IF v_last < now() - make_interval(mins => p_idle_minutes) THEN
        PERFORM end_diner_session(v_session.id);
        v_closed := v_closed + 1;
      END IF;
    ELSIF v_settled >= v_total THEN
      -- Ordered, ate, and the bill is settled — the visit is over.
      IF v_last < now() - make_interval(mins => p_settled_idle_minutes) THEN
        PERFORM end_diner_session(v_session.id);
        v_closed := v_closed + 1;
      END IF;
    END IF;
    -- Money still outstanding: deliberately left open for staff to handle.
  END LOOP;

  RETURN v_closed;
END;
$$;

--------------------------------------------------------------------------------
-- get_table_members — sweep before reporting who is here
--------------------------------------------------------------------------------
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

  -- Someone is standing at the table with their phone out: the perfect moment
  -- to retire a session the previous party walked away from.
  PERFORM close_stale_table_sessions(v_table.id);

  SELECT s.id INTO v_session
  FROM table_sessions s
  WHERE s.table_id = v_table.id
    AND s.closed_at IS NULL
    AND s.expires_at > now()
  ORDER BY s.opened_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
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

GRANT EXECUTE ON FUNCTION public.close_stale_table_sessions(uuid, int, int) TO authenticated, anon;
