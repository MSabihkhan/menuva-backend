import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { AppError } from '../utils/AppError';

type Db = SupabaseClient<Database>;
type CardDiscountRow = Database['public']['Tables']['card_discounts']['Row'];
type CardDiscountInsert = Database['public']['Tables']['card_discounts']['Insert'];
type CardDiscountUpdate = Database['public']['Tables']['card_discounts']['Update'];

export async function listCardDiscounts(db: Db): Promise<CardDiscountRow[]> {
  const { data, error } = await db
    .from('card_discounts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list card discounts', error);
  }

  return data;
}

export async function getCardDiscount(db: Db, id: string): Promise<CardDiscountRow> {
  const { data, error } = await db
    .from('card_discounts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    throw new AppError(404, 'NOT_FOUND', 'Card discount not found', error);
  }

  return data;
}

export async function createCardDiscount(db: Db, payload: CardDiscountInsert): Promise<CardDiscountRow> {
  const { data, error } = await db
    .from('card_discounts')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create card discount', error);
  }

  return data;
}

export async function updateCardDiscount(db: Db, id: string, payload: CardDiscountUpdate): Promise<CardDiscountRow> {
  const { data, error } = await db
    .from('card_discounts')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update card discount', error);
  }

  return data;
}

export async function deleteCardDiscount(db: Db, id: string): Promise<void> {
  const { error } = await db
    .from('card_discounts')
    .delete()
    .eq('id', id);

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to delete card discount', error);
  }
}
