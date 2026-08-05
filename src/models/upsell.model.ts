import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { AppError } from '../utils/AppError';

type Db = SupabaseClient<Database>;
type RulesRow = Database['public']['Tables']['upsell_rules']['Row'];
type RulesUpdate = Database['public']['Tables']['upsell_rules']['Update'];
type PairingRow = Database['public']['Tables']['upselling_combinations']['Row'];
type PairingInsert = Database['public']['Tables']['upselling_combinations']['Insert'];
type AffinityRow = Database['public']['Tables']['upsell_category_affinity']['Row'];
type AffinityInsert = Database['public']['Tables']['upsell_category_affinity']['Insert'];

export async function getRules(db: Db): Promise<RulesRow> {
  const { data, error } = await db.from('upsell_rules').select('*').single();
  if (error) {
    if (error.code === 'PGRST116') throw new AppError(404, 'NOT_FOUND', 'Upsell rules not found');
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch upsell rules', error);
  }
  return data;
}

export async function updateRules(db: Db, patch: RulesUpdate): Promise<RulesRow> {
  const rules = await getRules(db);
  const { data, error } = await db.from('upsell_rules').update(patch).eq('id', rules.id).select().single();
  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update upsell rules', error);
  }
  return data;
}

export async function listPairings(db: Db): Promise<PairingRow[]> {
  const { data, error } = await db.from('upselling_combinations').select('*').order('sort_order');
  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch pairings', error);
  }
  return data;
}

export async function createPairings(db: Db, inserts: PairingInsert[]): Promise<PairingRow[]> {
  const { data, error } = await db.from('upselling_combinations').insert(inserts).select();
  if (error) {
    if (error.code === '23505') throw new AppError(409, 'CONFLICT', 'Pairing already exists');
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create pairings', error);
  }
  return data;
}

export async function deletePairing(db: Db, id: string): Promise<void> {
  const { error } = await db.from('upselling_combinations').delete().eq('id', id);
  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to delete pairing', error);
  }
}

export async function listAffinity(db: Db): Promise<AffinityRow[]> {
  const { data, error } = await db.from('upsell_category_affinity').select('*').order('priority');
  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch affinity', error);
  }
  return data;
}

export async function createAffinity(db: Db, insert: AffinityInsert): Promise<AffinityRow> {
  const { data, error } = await db.from('upsell_category_affinity').insert(insert).select().single();
  if (error) {
    if (error.code === '23505') throw new AppError(409, 'CONFLICT', 'Affinity already exists');
    if (error.code === '23514') throw new AppError(400, 'VALIDATION_ERROR', 'Source and target categories must be different');
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create affinity', error);
  }
  return data;
}

export async function deleteAffinity(db: Db, id: string): Promise<void> {
  const { error } = await db.from('upsell_category_affinity').delete().eq('id', id);
  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to delete affinity', error);
  }
}
