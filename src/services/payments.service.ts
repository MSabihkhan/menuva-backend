import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { AppError } from '../utils/AppError';
import { applyBps } from '../utils/money';
import * as paymentModel from '../models/payments.model';

type Db = SupabaseClient<Database>;

interface PayBillPayload {
  splitMethod: 'full' | 'equal' | 'by_person' | 'custom';
  method: 'cash' | 'card' | 'wallet';
  allocations?: { memberId: string; amount: number }[];
  offerId?: string;
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

    const applicableOffers = await paymentModel.getOffers(db, restaurantId);
    const cardDiscounts = await paymentModel.getCardDiscounts(db, restaurantId);

    // Already paid? Sum recorded payments across every round for this session.
    let paidTotal = 0;
    for (const order of orders) {
      for (const p of order.payments) {
        paidTotal += p.amount;
      }
    }

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
      discounts: [], // specific applied discounts if any
      total,
      paid: paidTotal > 0 && paidTotal >= total,
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

    let billTotal = bill.total;

    // Apply offer if provided
    if (payload.offerId) {
      const offer = await paymentModel.getOfferById(db, payload.offerId, restaurantId);
      if (offer) {
        if (offer.discount_type === 'percentage') {
          const discountAmount = applyBps(billTotal, offer.discount_value);
          billTotal = Math.max(0, billTotal - discountAmount);
        } else if (offer.discount_type === 'fixed') {
          billTotal = Math.max(0, billTotal - offer.discount_value);
        }
      }
    }

    // Determine the amount being paid
    let totalPaid = 0;
    if (payload.splitMethod === 'full' || payload.splitMethod === 'equal') {
      totalPaid = billTotal;
    } else {
      if (!payload.allocations || payload.allocations.length === 0) {
        throw new AppError(409, 'CONFLICT', 'Allocations required for this split method.');
      }
      totalPaid = payload.allocations.reduce((sum, a) => sum + a.amount, 0);
    }

    if (totalPaid !== billTotal) {
      throw new AppError(409, 'CONFLICT', 'Allocations do not sum to the exact bill total.');
    }

    // Check if already paid (sum of existing payments >= billTotal)
    // Actually, we just check if any orders have remaining balances. 
    // For simplicity, sum all existing payments for the session.
    let existingPaymentsSum = 0;
    for (const order of orders) {
      for (const p of order.payments) {
        existingPaymentsSum += p.amount;
      }
    }

    if (existingPaymentsSum >= billTotal) {
      throw new AppError(409, 'CONFLICT', 'Bill is already fully paid.');
    }

    // We will distribute the totalPaid across the unpaid portion of the orders
    const paymentInserts: Database['public']['Tables']['payments']['Insert'][] = [];
    let remainingToPay = totalPaid;

    for (const order of orders) {
      if (remainingToPay <= 0) break;

      const orderTotal = order.total;
      const orderPaidSoFar = order.payments.reduce((sum, p) => sum + p.amount, 0);
      const orderUnpaid = Math.max(0, orderTotal - orderPaidSoFar);

      if (orderUnpaid > 0) {
        const payForOrder = Math.min(orderUnpaid, remainingToPay);
        paymentInserts.push({
          restaurant_id: restaurantId,
          order_id: order.id,
          amount: payForOrder,
          method: payload.method,
        });
        remainingToPay -= payForOrder;
      }
    }

    // If there is still remainingToPay (due to offers reducing billTotal but order totals remaining unchanged),
    // apply it to the first order to make the sum match.
    if (remainingToPay > 0 && paymentInserts.length > 0) {
       paymentInserts[0].amount += remainingToPay;
    } else if (remainingToPay > 0 && orders.length > 0) {
       paymentInserts.push({
          restaurant_id: restaurantId,
          order_id: orders[0].id,
          amount: remainingToPay,
          method: payload.method,
       });
    }

    const recorded = await paymentModel.recordPayments(db, paymentInserts);

    if (recorded.length === 0) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Failed to generate payment records.');
    }

    // Return the aggregated payment mimicking a single transaction
    return {
      id: recorded[0].id,
      amount: totalPaid,
      method: payload.method,
      paidAt: recorded[0].paid_at
    };
  }
};
