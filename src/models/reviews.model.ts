import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { AppError } from '../utils/AppError';

type Db = SupabaseClient<Database>;
type ReviewInsert = Database['public']['Tables']['reviews']['Insert'];
type ReviewRow = Database['public']['Tables']['reviews']['Row'];

export async function createReview(db: Db, data: ReviewInsert): Promise<ReviewRow> {
  const { data: review, error } = await db
    .from('reviews')
    .insert(data)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') { // unique violation
      throw new AppError(409, 'CONFLICT', 'A review already exists for this session.');
    }
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create review', error);
  }

  return review;
}

export async function getLatestOrderForSession(db: Db, sessionId: string): Promise<string | null> {
  const { data, error } = await db
    .from('orders')
    .select('id')
    .eq('session_id', sessionId)
    .order('placed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch latest order', error);
  }

  return data?.id ?? null;
}

export async function listReviews(
  db: Db,
  filters: {
    branchId?: string;
    rating?: number;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<ReviewRow[]> {
  let query = db.from('reviews').select('*').order('created_at', { ascending: false });

  if (filters.branchId) {
    query = query.eq('branch_id', filters.branchId);
  }
  if (filters.rating) {
    query = query.eq('rating', filters.rating);
  }
  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }

  const { data, error } = await query;
  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list reviews', error);
  }

  return data;
}
