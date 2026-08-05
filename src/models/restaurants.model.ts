import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';
import { AppError } from '../utils/AppError';

export async function getRestaurant(db: SupabaseClient<Database>) {
  const { data, error } = await db
    .from('restaurants')
    .select('*')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new AppError(404, 'NOT_FOUND', 'Restaurant not found');
    }
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch restaurant', error);
  }
  return data;
}

export async function updateRestaurant(db: SupabaseClient<Database>, id: string, updates: Database['public']['Tables']['restaurants']['Update']) {
  const { data, error } = await db
    .from('restaurants')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new AppError(404, 'NOT_FOUND', 'Restaurant not found');
    }
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update restaurant', error);
  }
  return data;
}

export async function listBranches(db: SupabaseClient<Database>) {
  const { data, error } = await db
    .from('branches')
    .select('*')
    .is('deleted_at', null);

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list branches', error);
  }
  return data;
}

export async function createBranch(db: SupabaseClient<Database>, branchData: Database['public']['Tables']['branches']['Insert']) {
  const { data, error } = await db
    .from('branches')
    .insert(branchData)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AppError(409, 'CONFLICT', 'Branch with this slug already exists');
    }
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create branch', error);
  }
  return data;
}

export async function updateBranch(db: SupabaseClient<Database>, id: string, updates: Database['public']['Tables']['branches']['Update']) {
  const { data, error } = await db
    .from('branches')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new AppError(404, 'NOT_FOUND', 'Branch not found');
    }
    if (error.code === '23505') {
      throw new AppError(409, 'CONFLICT', 'Branch slug conflict');
    }
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update branch', error);
  }
  return data;
}

export async function deleteBranch(db: SupabaseClient<Database>, id: string) {
  const { error } = await db
    .from('branches')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
    .is('deleted_at', null);

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to delete branch', error);
  }
}

export async function listTables(db: SupabaseClient<Database>, branchId: string) {
  const { data, error } = await db
    .from('tables')
    .select('*')
    .eq('branch_id', branchId)
    .is('deleted_at', null);

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list tables', error);
  }
  return data;
}

export async function createTable(db: SupabaseClient<Database>, tableData: Database['public']['Tables']['tables']['Insert']) {
  const { data, error } = await db
    .from('tables')
    .insert(tableData)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AppError(409, 'CONFLICT', 'Table with this code already exists in the branch');
    }
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create table', error);
  }
  return data;
}

export async function updateTable(db: SupabaseClient<Database>, id: string, updates: Database['public']['Tables']['tables']['Update']) {
  const { data, error } = await db
    .from('tables')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new AppError(404, 'NOT_FOUND', 'Table not found');
    }
    if (error.code === '23505') {
      throw new AppError(409, 'CONFLICT', 'Table code conflict');
    }
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update table', error);
  }
  return data;
}

export async function deleteTable(db: SupabaseClient<Database>, id: string) {
  const { error } = await db
    .from('tables')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
    .is('deleted_at', null);

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to delete table', error);
  }
}

export async function regenerateTableQr(db: SupabaseClient<Database>, id: string, qrToken: string, qrCodeUrl: string) {
  const { data, error } = await db
    .from('tables')
    .update({ qr_token: qrToken, qr_code_url: qrCodeUrl })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new AppError(404, 'NOT_FOUND', 'Table not found');
    }
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to regenerate table QR', error);
  }
  return data;
}

export async function closeSession(db: SupabaseClient<Database>, tableId: string) {
  const { error } = await db
    .from('table_sessions')
    .update({ closed_at: new Date().toISOString() })
    .eq('table_id', tableId)
    .is('closed_at', null);

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to close table session', error);
  }
}
