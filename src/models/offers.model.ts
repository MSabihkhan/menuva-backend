import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { AppError } from '../utils/AppError';

type Db = SupabaseClient<Database>;
type OfferRow = Database['public']['Tables']['offers']['Row'];
type OfferInsert = Database['public']['Tables']['offers']['Insert'];
type OfferUpdate = Database['public']['Tables']['offers']['Update'];

type CardDiscountRow = Database['public']['Tables']['card_discounts']['Row'];
type CardDiscountInsert = Database['public']['Tables']['card_discounts']['Insert'];
type CardDiscountUpdate = Database['public']['Tables']['card_discounts']['Update'];

// --- Offers ---

export async function listOffers(db: Db): Promise<OfferRow[]> {
  const { data, error } = await db
    .from('offers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch offers', error);
  return data;
}

export async function createOffer(db: Db, offer: OfferInsert): Promise<OfferRow> {
  const { data, error } = await db
    .from('offers')
    .insert(offer)
    .select()
    .single();

  if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create offer', error);
  return data;
}

export async function updateOffer(db: Db, id: string, offer: OfferUpdate): Promise<OfferRow> {
  const { data, error } = await db
    .from('offers')
    .update(offer)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update offer', error);
  return data;
}

export async function deleteOffer(db: Db, id: string): Promise<void> {
  const { error } = await db.from('offers').delete().eq('id', id);
  if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to delete offer', error);
}

// --- Card Discounts ---

export async function listCardDiscounts(db: Db): Promise<CardDiscountRow[]> {
  const { data, error } = await db
    .from('card_discounts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch card discounts', error);
  return data;
}

export async function createCardDiscount(db: Db, discount: CardDiscountInsert): Promise<CardDiscountRow> {
  const { data, error } = await db
    .from('card_discounts')
    .insert(discount)
    .select()
    .single();

  if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create card discount', error);
  return data;
}

export async function updateCardDiscount(db: Db, id: string, discount: CardDiscountUpdate): Promise<CardDiscountRow> {
  const { data, error } = await db
    .from('card_discounts')
    .update(discount)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update card discount', error);
  return data;
}

export async function deleteCardDiscount(db: Db, id: string): Promise<void> {
  const { error } = await db.from('card_discounts').delete().eq('id', id);
  if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to delete card discount', error);
}
