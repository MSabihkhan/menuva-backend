-- -----------------------------------------------------------------------------
-- 20260817030000_close_requires_served_and_paid.sql
-- -----------------------------------------------------------------------------
-- Paying closed the table immediately, even when the food had not arrived yet.
-- A diner who settles up as soon as they order — which people do — lost the
-- order-status screen the moment they paid, and had no way to see what they
-- had ordered or how far along it was.
--
-- Closing now requires BOTH conditions, which is the real definition of "this
-- visit is over":
--
--   * every round served or cancelled, and
--   * the bill fully settled (cash collected + discounts granted >= total)
--
-- Staff keep an override (p_force) — a walkout or a comped table has to be
-- closable regardless.
--
-- Also adds the 'pay_bill' prompt kind. Paying and closing are now separate
-- moments, so the table is asked about them separately rather than one prompt
-- claiming to do both.
-- -----------------------------------------------------------------------------

ALTER TABLE public.table_prompts DROP CONSTRAINT IF EXISTS table_prompts_kind_chk;
ALTER TABLE public.table_prompts ADD CONSTRAINT table_prompts_kind_chk
  CHECK (kind IN ('place_order', 'split_method', 'end_session', 'pay_bill'));

--------------------------------------------------------------------------------
-- session_close_state — the single source of truth for "can this table close?"
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.session_close_state(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_orders    int;
  v_unserved  int;
  v_total     bigint;
  v_settled   bigint;
BEGIN
  SELECT count(*), COALESCE(sum(total), 0) INTO v_orders, v_total
  FROM orders WHERE session_id = p_session_id;

  SELECT count(*) INTO v_unserved
  FROM orders
  WHERE session_id = p_session_id AND status NOT IN ('served', 'cancelled');

  SELECT COALESCE(sum(p.amount + COALESCE(p.discount_amount, 0)), 0) INTO v_settled
  FROM payments p JOIN orders o ON o.id = p.order_id
  WHERE o.session_id = p_session_id;

  RETURN jsonb_build_object(
    'orderCount', v_orders,
    'unservedCount', v_unserved,
    'allServed', v_unserved = 0,
    'paid', v_orders > 0 AND v_settled >= v_total,
    -- A table that never ordered can always be closed; there is nothing to wait
    -- for and nothing owed.
    'canClose', v_orders = 0 OR (v_unserved = 0 AND v_settled >= v_total)
  );
END;
$$;

--------------------------------------------------------------------------------
-- end_diner_session — refuses unless the visit is genuinely finished
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.end_diner_session(
  p_session_id uuid,
  p_force      boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_now   timestamptz := now();
  v_state jsonb;
BEGIN
  v_state := session_close_state(p_session_id);

  IF NOT p_force AND NOT (v_state->>'canClose')::boolean THEN
    -- Not an error: the caller asked politely and the answer is "not yet".
    RETURN jsonb_build_object(
      'closed', false,
      'reason', CASE
        WHEN NOT (v_state->>'paid')::boolean THEN 'bill_outstanding'
        ELSE 'food_not_served'
      END,
      'state', v_state
    );
  END IF;

  UPDATE table_sessions
  SET closed_at = v_now, is_locked = true
  WHERE id = p_session_id AND closed_at IS NULL;

  UPDATE table_prompts
  SET status = 'resolved', resolved_at = v_now
  WHERE session_id = p_session_id AND status = 'pending';

  DELETE FROM cart_items WHERE session_id = p_session_id;

  RETURN jsonb_build_object('closed', true, 'sessionId', p_session_id, 'closedAt', v_now, 'state', v_state);
END;
$$;

--------------------------------------------------------------------------------
-- The stale sweep closes abandoned tables regardless of the new guard.
--------------------------------------------------------------------------------
-- Its own rules are stricter (it never touches a table that owes money), and it
-- must still be able to retire a party that walked out mid-meal.
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
      IF v_last < now() - make_interval(mins => p_idle_minutes) THEN
        PERFORM end_diner_session(v_session.id, true);
        v_closed := v_closed + 1;
      END IF;
    ELSIF v_settled >= v_total THEN
      IF v_last < now() - make_interval(mins => p_settled_idle_minutes) THEN
        PERFORM end_diner_session(v_session.id, true);
        v_closed := v_closed + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN v_closed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.session_close_state(uuid)         TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.end_diner_session(uuid, boolean)  TO authenticated, anon;
