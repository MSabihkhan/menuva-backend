import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';
import { AppError } from '../utils/AppError';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderLineItemRow = Database['public']['Tables']['order_line_items']['Row'];

export interface OrderLineItemView {
  id: string;
  name: string;
  quantity: number;
  modifiers: OrderLineItemRow['modifiers_snapshot'];
  byMemberId: string | null;
  byMemberName: string;
}

export type OrderWithLineItems = OrderRow & {
  lineItems: OrderLineItemView[];
};

function mapLineItems(rows: OrderLineItemRow[]): OrderLineItemView[] {
  return rows.map((li) => ({
    id: li.id,
    name: li.name_snapshot,
    quantity: li.quantity,
    modifiers: li.modifiers_snapshot,
    byMemberId: li.by_member_id,
    byMemberName: li.by_member_name,
  }));
}

/**
 * `sessionId` is required: this is the diner-facing endpoint, and without an
 * explicit filter it fell through to RLS, which scopes by restaurant/branch —
 * not by session. Every diner at every table in the branch was seeing every
 * other table's rounds and line items.
 */
export async function getOrders(db: SupabaseClient<Database>, sessionId: string): Promise<OrderWithLineItems[]> {
  const { data, error } = await db
    .from('orders')
    .select(`
      *,
      lineItems:order_line_items(*)
    `)
    .eq('session_id', sessionId)
    .order('round', { ascending: true });

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', error.message);
  }

  return (data as (OrderRow & { lineItems: OrderLineItemRow[] })[]).map((o) => ({
    ...o,
    lineItems: mapLineItems(o.lineItems ?? []),
  })) as OrderWithLineItems[];
}

/**
 * `sessionId` scopes this to the caller's own table when set. Staff pass
 * `undefined` — they're legitimately allowed to look up any order in their
 * restaurant/branch (RLS still applies), but a diner must not be able to pull
 * another table's order by guessing/enumerating an order id.
 */
export async function getOrderById(
  db: SupabaseClient<Database>,
  orderId: string,
  sessionId?: string,
): Promise<OrderWithLineItems> {
  let query = db
    .from('orders')
    .select(`
      *,
      lineItems:order_line_items(*)
    `)
    .eq('id', orderId);
  if (sessionId) query = query.eq('session_id', sessionId);
  const { data, error } = await query.single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new AppError(404, 'NOT_FOUND', 'Order not found or access denied');
    }
    throw new AppError(500, 'INTERNAL_ERROR', error.message);
  }

  const row = data as OrderRow & { lineItems: OrderLineItemRow[] };
  return { ...row, lineItems: mapLineItems(row.lineItems ?? []) } as OrderWithLineItems;
}
