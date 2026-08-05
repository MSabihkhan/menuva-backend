-- Fix place_order table_id typo
CREATE OR REPLACE FUNCTION public.place_order(
  p_session_id uuid,
  p_idempotency_key text,
  p_kitchen_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_existing_order RECORD;
  v_order_id uuid;
  v_round int;
  v_merged boolean := false;
  v_latest_order RECORD;
  v_subtotal int := 0;
  v_tax int := 0;
  v_service_charge int := 0;
  v_total int := 0;
  v_cart_item RECORD;
BEGIN
  -- 1. Get session
  SELECT * INTO v_session FROM sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESSION NOT FOUND' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Idempotency check
  SELECT * INTO v_existing_order FROM orders WHERE idempotency_key = p_idempotency_key LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'order_id', v_existing_order.id,
      'round', v_existing_order.round,
      'merged', false
    );
  END IF;

  -- 3. Check for cart items
  IF NOT EXISTS (SELECT 1 FROM cart_items WHERE session_id = p_session_id) THEN
    RAISE EXCEPTION 'CONFLICT' USING ERRCODE = 'P0002';
  END IF;

  -- 4. Round-Merge
  SELECT * INTO v_latest_order FROM orders 
  WHERE session_id = p_session_id 
  ORDER BY round DESC LIMIT 1;

  IF FOUND AND EXTRACT(EPOCH FROM (now() - v_latest_order.placed_at)) <= 300 THEN
    v_order_id := v_latest_order.id;
    v_round := v_latest_order.round;
    v_merged := true;
  ELSE
    v_round := COALESCE((SELECT max(round) FROM orders WHERE session_id = p_session_id), 0) + 1;
    v_merged := false;
    
    INSERT INTO orders (
      restaurant_id, branch_id, session_id,
      round, status, idempotency_key, kitchen_notes, placed_at,
      subtotal, tax, service_charge, total
    ) VALUES (
      v_session.restaurant_id, v_session.branch_id, p_session_id,
      v_round, 'placed', p_idempotency_key, p_kitchen_notes, now(),
      0, 0, 0, 0
    ) RETURNING id INTO v_order_id;
  END IF;

  -- 5. Snapshot items
  FOR v_cart_item IN 
    SELECT c.*, m.price 
    FROM cart_items c
    JOIN menu_items m ON m.id = c.menu_item_id
    WHERE c.session_id = p_session_id
  LOOP
    INSERT INTO order_line_items (
      order_id, menu_item_id, quantity, price_at_time, notes
    ) VALUES (
      v_order_id, v_cart_item.menu_item_id, v_cart_item.quantity, v_cart_item.price, v_cart_item.notes
    );
    v_subtotal := v_subtotal + (v_cart_item.price * v_cart_item.quantity);
  END LOOP;

  -- 6. Delete cart
  DELETE FROM cart_items WHERE session_id = p_session_id;

  -- 7. Update totals
  v_tax := (v_subtotal * 0.1)::int; -- example 10%
  v_total := v_subtotal + v_tax + v_service_charge;
  UPDATE orders SET 
    subtotal = subtotal + v_subtotal,
    tax = tax + v_tax,
    total = total + v_total
  WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'round', v_round,
    'merged', v_merged
  );
END;
$$;
