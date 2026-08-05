import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { AppError } from '../utils/AppError';

type Db = SupabaseClient<Database>;

export async function listNotifications(
  db: Db,
  filters: {
    channel?: string;
    recipientType?: string;
    eventType?: string;
    limit?: number;
    offset?: number;
  },
) {
  let query = db.from('notification_log').select('*').order('sent_at', { ascending: false });
  if (filters.channel) query = query.eq('channel', filters.channel);
  if (filters.recipientType) query = query.eq('recipient_type', filters.recipientType);
  if (filters.eventType) query = query.eq('event_type', filters.eventType);
  query = query.range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 50) - 1);
  const { data, error } = await query;
  if (error) throw new AppError(500, 'INTERNAL_ERROR', error.message);
  return data;
}
