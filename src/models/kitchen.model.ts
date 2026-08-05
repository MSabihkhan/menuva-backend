import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { AppError } from '../utils/AppError';

type Db = SupabaseClient<Database>;

export async function getKitchenBoard(
  db: Db,
  filters: { branchId?: string; statuses: string[] }
) {
  let query = db
    .from('orders')
    .select(`
      id,
      round,
      status,
      placed_at,
      kitchen_notes,
      table_sessions!inner (
        tables!inner (
          code,
          label
        )
      ),
      order_line_items (
        name_snapshot,
        quantity,
        modifiers_snapshot,
        by_member_name
      )
    `)
    .in('status', filters.statuses)
    .order('placed_at', { ascending: true });

  if (filters.branchId) {
    query = query.eq('branch_id', filters.branchId);
  }

  const { data, error } = await query;
  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch kitchen board', error);
  }
  return data;
}

export async function getOrder(db: Db, orderId: string) {
  const { data, error } = await db
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new AppError(404, 'NOT_FOUND', 'Order not found');
    }
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch order', error);
  }
  return data;
}

export async function updateOrderStatus(
  db: Db,
  orderId: string,
  newStatus: string,
  actorId: string,
  actorType: string,
  restaurantId: string
) {
  const { data: updatedOrder, error } = await db
    .from('orders')
    .update({
      status: newStatus,
      status_changed_at: new Date().toISOString()
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update order status', error);
  }

  const { error: auditError } = await db
    .from('audit_log')
    .insert({
      restaurant_id: restaurantId,
      entity_type: 'order',
      entity_id: orderId,
      action: 'status_advanced',
      actor_type: actorType,
      actor_id: actorId,
      new_value: { status: newStatus }
    });

  if (auditError) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to log audit event', auditError);
  }

  return updatedOrder;
}
