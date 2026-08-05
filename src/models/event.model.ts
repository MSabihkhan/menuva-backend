import { supabaseAdmin } from '../config/supabase';
import { logger } from '../utils/logger';

export async function logEvent(params: {
  tenantId: string;
  branchId?: string;
  sessionId?: string;
  actorType: 'diner' | 'staff' | 'system';
  eventType: string;
  itemId?: string;
  payload?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from('events').insert({
    tenant_id: params.tenantId,
    branch_id: params.branchId || null,
    session_id: params.sessionId || null,
    actor_type: params.actorType,
    event_type: params.eventType,
    item_id: params.itemId || null,
    payload: (params.payload || null) as Record<string, unknown> & import('../types/database.types').Json,
  });
  if (error) {
    logger.warn({ error, eventType: params.eventType }, 'Failed to log event (non-fatal)');
  }
}
