import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { AppError } from '../utils/AppError';
import { applyBps } from '../utils/money';
import { broadcastToSession } from '../utils/realtime';
import * as paymentModel from '../models/payments.model';

type Db = SupabaseClient<Database>;

interface PayBillPayload {
  splitMethod: 'full' | 'equal' | 'by_person' | 'custom';
  method: 'cash' | 'card' | 'wallet';
  allocations?: { memberId: string; amount: number }[];
  offerId?: string;
  cardDiscountId?: string;
}

/**
 * What a bill is settled by: cash collected PLUS any discount granted. Before
 * `payments.discount_amount` existed, a discounted bill could never satisfy
 * `sum(amount) >= total`, so it stayed "unpaid" forever on every device.
 */
function settledSoFar(orders: Array<{ payments: Array<{ amount: number; discount_amount?: number | null }> }>) {
  let collected = 0;
  let discounted = 0;
  for (const order of orders) {
    for (const p of order.payments) {
      collected += p.amount;
      discounted += p.discount_amount ?? 0;
    }
  }
  return { collected, discounted, settled: collected + discounted };
}

export const paymentsService = {
  async getBill(db: Db, sessionId: string, restaurantId: string, currentMemberId?: string) {
    const orders = await paymentModel.getSessionOrders(db, sessionId);
    
    let subtotal = 0;
    const byMemberMap = new Map<string, { memberId: string; name: string; subtotal: number }>();

    for (const order of orders) {
      for (const item of order.order_line_items) {
        const itemTotal = item.unit_price_snapshot * item.quantity;
        subtotal += itemTotal;

        if (item.by_member_id) {
          const existing = byMemberMap.get(item.by_member_id);
          if (existing) {
            existing.subtotal += itemTotal;
          } else {
            byMemberMap.set(item.by_member_id, {
              memberId: item.by_member_id,
              name: item.by_member_name,
              subtotal: itemTotal,
            });
          }
        }
      }
    }

    const rates = await paymentModel.getRestaurantRates(db, restaurantId);
    const tax = rates.tax_rate_bps ? applyBps(subtotal, rates.tax_rate_bps) : 0;
    const serviceCharge = rates.service_charge_bps ? applyBps(subtotal, rates.service_charge_bps) : 0;
    const total = subtotal + tax + serviceCharge;

    // The client is typed in camelCase; returning raw DB rows here meant
    // `offer.discountType` was undefined on every offer, which is what turned
    // the applied-discount line into NaN.
    const applicableOffers = (await paymentModel.getOffers(db, restaurantId)).map(o => ({
      id: o.id,
      name: o.name,
      discountType: o.discount_type as 'percentage' | 'fixed',
      discountValue: o.discount_value,
    }));
    const cardDiscounts = (await paymentModel.getCardDiscounts(db, restaurantId)).map(c => ({
      id: c.id,
      bankName: c.bank_name,
      cardType: c.card_type,
      discountBps: c.discount_bps,
    }));

    const { collected, discounted, settled } = settledSoFar(orders);

    // Get an array of round overviews
    const rounds = orders.map(o => ({
      id: o.id,
      round: o.round,
      status: o.status,
      placedAt: o.placed_at,
      subtotal: o.subtotal,
      tax: o.tax,
      total: o.total,
    }));

    return {
      rounds,
      byMember: Array.from(byMemberMap.values()).map(m => ({
        ...m,
        isCurrentUser: m.memberId === currentMemberId,
      })),
      subtotal,
      tax,
      serviceCharge,
      // Every discount actually granted on this table, so a device that did not
      // perform the payment can still show why it collected less than `total`.
      discounts: orders.flatMap(o =>
        o.payments
          .filter(p => (p.discount_amount ?? 0) > 0)
          .map(p => ({ amount: p.discount_amount as number, source: p.discount_source ?? null })),
      ),
      total,
      paid: settled > 0 && settled >= total,
      amountCollected: collected,
      discountTotal: discounted,
      /** Outstanding balance. 0 once the table is settled. */
      amountDue: Math.max(0, total - settled),
      payments: orders.flatMap(o =>
        o.payments.map(p => ({
          id: p.id,
          amount: p.amount,
          discountAmount: p.discount_amount ?? 0,
          method: p.method,
          paidAt: p.paid_at,
        })),
      ),
      applicableOffers,
      cardDiscounts,
    };
  },

  async payBill(db: Db, sessionId: string, restaurantId: string, payload: PayBillPayload) {
    const bill = await this.getBill(db, sessionId, restaurantId);
    
    // Check if there are orders to pay for
    const orders = await paymentModel.getSessionOrders(db, sessionId);
    if (orders.length === 0) {
      throw new AppError(409, 'CONFLICT', 'No orders to pay for.');
    }

    // Anything already settled (cash + discounts granted) reduces what is left
    // to pay. Reading this from the full bill total rather than the outstanding
    // balance is what made a second device re-charge the whole table.
    const alreadySettled = settledSoFar(orders);
    const outstanding = bill.total - alreadySettled.settled;

    if (outstanding <= 0) {
      throw new AppError(409, 'CONFLICT', 'Bill is already fully paid.');
    }

    // Discounts apply to the outstanding balance, never to the whole table
    // again. Both are recorded, so the bill can prove why less cash was taken.
    let discountAmount = 0;
    const discountSources: string[] = [];

    if (payload.offerId) {
      const offer = await paymentModel.getOfferById(db, payload.offerId, restaurantId);
      if (offer) {
        const off =
          offer.discount_type === 'percentage'
            ? applyBps(outstanding, offer.discount_value)
            : offer.discount_value;
        discountAmount += Math.min(outstanding - discountAmount, off);
        discountSources.push(`offer:${offer.id}`);
      }
    }

    // Card discounts are opt-in: the diner names the card they are paying with,
    // so we never silently discount the wrong one. Only meaningful on `card`.
    if (payload.cardDiscountId && payload.method === 'card') {
      const card = await paymentModel.getCardDiscountById(db, payload.cardDiscountId, restaurantId);
      if (card) {
        const off = applyBps(outstanding - discountAmount, card.discount_bps);
        discountAmount += Math.min(outstanding - discountAmount, off);
        discountSources.push(`card:${card.id}`);
      }
    }

    discountAmount = Math.max(0, Math.min(outstanding, discountAmount));
    const amountDue = outstanding - discountAmount;

    // Determine the amount being collected
    let totalPaid = 0;
    if (payload.splitMethod === 'full' || payload.splitMethod === 'equal') {
      totalPaid = amountDue;
    } else {
      if (!payload.allocations || payload.allocations.length === 0) {
        throw new AppError(409, 'CONFLICT', 'Allocations required for this split method.');
      }
      totalPaid = payload.allocations.reduce((sum, a) => sum + a.amount, 0);
    }

    if (totalPaid !== amountDue) {
      throw new AppError(409, 'CONFLICT', 'Allocations do not sum to the exact bill total.');
    }

    // Settle round by round. Cash and discount travel together: a round is
    // covered when amount + discount_amount reaches its outstanding balance,
    // which is exactly the rule `getBill` reads back.
    const paymentInserts: Database['public']['Tables']['payments']['Insert'][] = [];
    const source = discountSources.length > 0 ? discountSources.join(',') : null;
    let cashLeft = totalPaid;
    let discountLeft = discountAmount;

    for (const order of orders) {
      if (cashLeft <= 0 && discountLeft <= 0) break;

      const orderSettled = order.payments.reduce(
        (sum, p) => sum + p.amount + (p.discount_amount ?? 0),
        0,
      );
      const orderOutstanding = Math.max(0, order.total - orderSettled);
      if (orderOutstanding === 0) continue;

      // Discount first, so the recorded cash never exceeds what was collected.
      const discountForOrder = Math.min(discountLeft, orderOutstanding);
      const cashForOrder = Math.min(cashLeft, orderOutstanding - discountForOrder);
      if (discountForOrder === 0 && cashForOrder === 0) continue;

      paymentInserts.push({
        restaurant_id: restaurantId,
        order_id: order.id,
        amount: cashForOrder,
        discount_amount: discountForOrder,
        discount_source: discountForOrder > 0 ? source : null,
        method: payload.method,
      });
      discountLeft -= discountForOrder;
      cashLeft -= cashForOrder;
    }

    // Anything left over (a partial split that doesn't line up with round
    // boundaries) lands on the first round rather than vanishing.
    if ((cashLeft > 0 || discountLeft > 0) && paymentInserts.length > 0) {
      paymentInserts[0].amount += cashLeft;
      paymentInserts[0].discount_amount = (paymentInserts[0].discount_amount ?? 0) + discountLeft;
      if (discountLeft > 0) paymentInserts[0].discount_source = source;
    } else if ((cashLeft > 0 || discountLeft > 0) && orders.length > 0) {
      paymentInserts.push({
        restaurant_id: restaurantId,
        order_id: orders[0].id,
        amount: cashLeft,
        discount_amount: discountLeft,
        discount_source: discountLeft > 0 ? source : null,
        method: payload.method,
      });
    }

    const recorded = await paymentModel.recordPayments(db, paymentInserts);

    if (recorded.length === 0) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Failed to generate payment records.');
    }

    // Tell the rest of the table immediately. Without this, a second phone only
    // learned the bill was settled on its next poll — and until then it was
    // being offered a payment that would now be rejected.
    const nowSettled = alreadySettled.settled + totalPaid + discountAmount;
    await broadcastToSession(sessionId, 'payment_recorded', {
      amount: totalPaid,
      discountAmount,
      method: payload.method,
      paid: nowSettled >= bill.total,
      amountDue: Math.max(0, bill.total - nowSettled),
    });

    // Return the aggregated payment mimicking a single transaction
    return {
      id: recorded[0].id,
      amount: totalPaid,
      discountAmount,
      method: payload.method,
      paidAt: recorded[0].paid_at,
      paid: nowSettled >= bill.total,
      amountDue: Math.max(0, bill.total - nowSettled),
    };
  }
};
