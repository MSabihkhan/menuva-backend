import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { AppError } from '../utils/AppError';

type Db = SupabaseClient<Database>;

export async function listAuditEntries(
  db: Db,
  filters: { entityType?: string; entityId?: string; limit?: number; offset?: number },
) {
  let query = db.from('audit_log').select('*').order('occurred_at', { ascending: false });
  if (filters.entityType) query = query.eq('entity_type', filters.entityType);
  if (filters.entityId) query = query.eq('entity_id', filters.entityId);
  query = query.range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 50) - 1);
  const { data, error } = await query;
  if (error) throw new AppError(500, 'INTERNAL_ERROR', error.message);
  return data;
}
