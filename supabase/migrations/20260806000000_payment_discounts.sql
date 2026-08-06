-- -----------------------------------------------------------------------------
-- 20260806000000_payment_discounts.sql
-- -----------------------------------------------------------------------------
-- A settled bill could not be represented. `payments.amount` recorded the cash
-- actually collected, which is the bill total MINUS any offer discount — but
-- `getBill` decided "paid" by comparing the sum of payments against the FULL
-- undiscounted total. So the moment a diner used a discount:
--
--   * the bill never flipped to paid, on any device;
--   * a second phone joining the table was shown "pay again" for a bill that
--     was already settled;
--   * paying again either double-charged or was rejected outright.
--
-- The missing piece is the discount itself: nothing recorded that the gap
-- between `total` and what was collected was intentional. These two columns
-- record it, so settlement is `sum(amount) + sum(discount_amount) >= total`.
--
-- `discount_source` is free text ('offer:<id>', 'card:<id>') rather than a FK:
-- an offer can be deleted later and that must never orphan a historical
-- payment row.
-- -----------------------------------------------------------------------------

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS discount_amount int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_source text;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_discount_amount_chk;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_discount_amount_chk CHECK (discount_amount >= 0);

COMMENT ON COLUMN public.payments.discount_amount IS
  'Paisa discounted off this payment. amount + discount_amount is what the line settles.';
COMMENT ON COLUMN public.payments.discount_source IS
  'Where the discount came from: offer:<uuid> or card:<uuid>. Null when there was none.';
