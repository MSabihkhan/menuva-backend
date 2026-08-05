import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import * as kitchenModel from '../models/kitchen.model';
import { AppError } from '../utils/AppError';
import { STATUS_FLOW } from '../config/constants';
import type { AuthContext } from '../types/auth.types';

export async function getBoard(
  db: SupabaseClient<Database>,
  auth: AuthContext,
  query: { status?: string; branchId?: string }
) {
  const statuses = query.status ? query.status.split(',') : ['placed', 'preparing', 'ready'];
  
  let targetBranchId = query.branchId;
  
  if (auth.role !== 'owner') {
    targetBranchId = auth.branchId;
  }

  const rawOrders = await kitchenModel.getKitchenBoard(db, {
    branchId: targetBranchId,
    statuses
  });

  const now = Date.now();

  const orders = rawOrders.map((row: any) => {
    const session = Array.isArray(row.table_sessions) ? row.table_sessions[0] : row.table_sessions;
    const table = session?.tables;
    const t = Array.isArray(table) ? table[0] : table;

    const placedAt = new Date(row.placed_at).getTime();
    const ageSeconds = Math.floor((now - placedAt) / 1000);

    return {
      id: row.id,
      tableCode: t?.code,
      tableLabel: t?.label,
      round: row.round,
      status: row.status,
      placedAt: row.placed_at,
      ageSeconds,
      kitchenNotes: row.kitchen_notes,
      lineItems: row.order_line_items.map((li: any) => ({
        name: li.name_snapshot,
        quantity: li.quantity,
        modifiers: li.modifiers_snapshot,
        byMemberName: li.by_member_name
      }))
    };
  });

  return { orders };
}

import { broadcastToSession, broadcastToKitchen } from '../utils/realtime';
import { logEvent } from '../models/event.model';

export async function advanceOrderStatus(
  db: SupabaseClient<Database>,
  auth: AuthContext,
  orderId: string,
  to?: string
) {
  const order = await kitchenModel.getOrder(db, orderId);

  if (auth.role !== 'owner' && order.branch_id !== auth.branchId) {
    throw new AppError(404, 'NOT_FOUND', 'Order not found');
  }

  const currentStatus = order.status;
  const expectedNext = STATUS_FLOW[currentStatus];
  
  if (!expectedNext) {
    throw new AppError(409, 'CONFLICT', `Order is already in final state: ${currentStatus}`);
  }

  if (to && to !== expectedNext) {
    throw new AppError(409, 'CONFLICT', `Illegal transition from ${currentStatus} to ${to}. Expected ${expectedNext}.`);
  }

  const nextStatus = expectedNext;

  const updatedOrder = await kitchenModel.updateOrderStatus(
    db,
    orderId,
    nextStatus,
    auth.userId,
    auth.kind,
    order.restaurant_id
  );

  await broadcastToSession(order.session_id, 'order_status_changed', {
    orderId,
    status: nextStatus,
  });

  await broadcastToKitchen(order.branch_id, 'order_status_changed', {
    orderId,
    status: nextStatus,
  });

  // Fire-and-forget event logging
  logEvent({
    tenantId: order.restaurant_id,
    branchId: order.branch_id,
    sessionId: order.session_id,
    actorType: 'staff',
    eventType: 'status_changed',
    payload: { orderId, from: currentStatus, to: nextStatus },
  });

  return {
    order: {
      id: updatedOrder.id,
      status: updatedOrder.status,
      statusChangedAt: updatedOrder.status_changed_at
    }
  };
}
