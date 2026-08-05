import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { AppError } from '../utils/AppError';

type Db = SupabaseClient<Database>;

export async function listEmployees(db: Db) {
  const { data, error } = await db
    .from('employees')
    .select('*, memberships(*)')
    .is('deleted_at', null);

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch employees', error);
  }
  return data;
}

export async function getEmployee(db: Db, employeeId: string) {
  const { data, error } = await db
    .from('employees')
    .select('*, memberships(*)')
    .eq('id', employeeId)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new AppError(404, 'NOT_FOUND', 'Employee not found');
    }
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to fetch employee', error);
  }
  return data;
}

export async function updateEmployee(
  db: Db,
  employeeId: string,
  updates: Database['public']['Tables']['employees']['Update']
) {
  const { data, error } = await db
    .from('employees')
    .update(updates)
    .eq('id', employeeId)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update employee', error);
  }
  return data;
}

export async function updateMembership(
  db: Db,
  employeeId: string,
  updates: Database['public']['Tables']['memberships']['Update']
) {
  const { data, error } = await db
    .from('memberships')
    .update(updates)
    .eq('employee_id', employeeId)
    .select()
    .single();

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update membership', error);
  }
  return data;
}

export async function softDeleteEmployee(db: Db, employeeId: string) {
  const { data, error } = await db
    .from('employees')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', employeeId)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new AppError(404, 'NOT_FOUND', 'Employee not found');
    }
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to delete employee', error);
  }
  return data;
}

export async function countActiveOwners(db: Db) {
  const { error, count } = await db
    .from('memberships')
    .select('id, employees!inner(id, is_active, deleted_at)', { count: 'exact', head: true })
    .eq('role', 'owner')
    .eq('employees.is_active', true)
    .is('employees.deleted_at', null);

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to count active owners', error);
  }
  return count || 0;
}

export async function inviteStaff(db: Db, email: string, name: string, branchId: string, role: string) {
  const { data, error } = await db.rpc('invite_staff', {
    p_email: email,
    p_name: name,
    p_branch_id: branchId,
    p_role: role
  });

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to invite staff', error);
  }
  return data;
}
