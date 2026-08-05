import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';
import * as ordersModel from '../models/orders.model';

export async function getOrders(db: SupabaseClient<Database>, sessionId: string): Promise<ordersModel.OrderWithLineItems[]> {
  return await ordersModel.getOrders(db, sessionId);
}

export async function getOrderById(
  db: SupabaseClient<Database>,
  orderId: string,
  sessionId?: string,
): Promise<ordersModel.OrderWithLineItems> {
  return await ordersModel.getOrderById(db, orderId, sessionId);
}

import { broadcastToSession, broadcastToKitchen } from '../utils/realtime';
import { logEvent } from '../models/event.model';

export async function placeOrder(db: SupabaseClient<Database>, sessionId: string, idempotencyKey: string, kitchenNotes?: string) {
  const { data, error } = await db.rpc('place_order', {
    p_session_id: sessionId,
    p_idempotency_key: idempotencyKey,
    p_kitchen_notes: kitchenNotes || undefined,
  } as any);

  if (error) {
    if (error.code === 'P0001') {
      const { AppError } = require('../utils/AppError');
      throw new AppError(401, 'SESSION_EXPIRED', 'Session has expired');
    }
    if (error.code === 'P0002') {
      const { AppError } = require('../utils/AppError');
      throw new AppError(409, 'EMPTY_CART', 'Cart is empty');
    }
    throw error;
  }

  const result = data as any;
  const orderId = result.order.id;
  const round = result.order.round;
  const total = result.order.total;
  const branchId = result.order.branch_id;

  await broadcastToSession(sessionId, 'order_placed', {
    orderId,
    round,
    total,
  });

  await broadcastToKitchen(branchId, 'new_order', {
    orderId,
    sessionId,
    round,
  });

  // Fire-and-forget event logging
  logEvent({
    tenantId: result.order.restaurant_id,
    branchId,
    sessionId,
    actorType: 'diner',
    eventType: 'order_placed',
    payload: { orderId, round, total },
  });

  return result;
}

