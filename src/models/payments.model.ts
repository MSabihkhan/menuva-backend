import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { AppError } from '../utils/AppError';

type Db = SupabaseClient<Database>;

export async function getSessionOrders(db: Db, sessionId: string) {
  const { data, error } = await db
    .from('orders')
    .select('*, order_line_items(*), payments(id, amount, discount_amount, discount_source, method, paid_at)')
    .eq('session_id', sessionId)
    .order('round', { ascending: true });

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch session orders', error);
  }
  return data;
}

export async function getRestaurantRates(db: Db, restaurantId: string) {
  const { data, error } = await db
    .from('restaurants')
    .select('tax_rate_bps, service_charge_bps')
    .eq('id', restaurantId)
    .single();

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch restaurant rates', error);
  }
  return data;
}

export async function getOffers(db: Db, restaurantId: string) {
  const { data, error } = await db
    .from('offers')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true);

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch offers', error);
  }
  return data;
}

export async function getOfferById(db: Db, offerId: string, restaurantId: string) {
  const { data, error } = await db
    .from('offers')
    .select('*')
    .eq('id', offerId)
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch offer', error);
  }
  return data;
}

export async function getCardDiscountById(db: Db, cardDiscountId: string, restaurantId: string) {
  const { data, error } = await db
    .from('card_discounts')
    .select('*')
    .eq('id', cardDiscountId)
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch card discount', error);
  }
  return data;
}

export async function getCardDiscounts(db: Db, restaurantId: string) {
  const { data, error } = await db
    .from('card_discounts')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true);

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch card discounts', error);
  }
  return data;
}

export async function recordPayments(db: Db, paymentInserts: Database['public']['Tables']['payments']['Insert'][]) {
  if (paymentInserts.length === 0) return [];
  
  const { data, error } = await db
    .from('payments')
    .insert(paymentInserts)
    .select();

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to record payments', error);
  }
  return data;
}
