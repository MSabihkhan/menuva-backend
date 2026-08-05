import { AppError } from '../utils/AppError';
import * as staffModel from '../models/staff.model';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

type Db = SupabaseClient<Database>;

export async function listStaff(db: Db, branchIdScope?: string) {
  let employees = await staffModel.listEmployees(db);
  
  if (branchIdScope) {
    employees = employees.filter(emp => 
      emp.memberships && emp.memberships.some((m: any) => m.branch_id === branchIdScope)
    );
  }
  
  return { employees };
}

export async function updateStaffMember(
  db: Db,
  employeeId: string,
  updates: { isActive?: boolean; role?: string; branchId?: string }
) {
  const employee = await staffModel.getEmployee(db, employeeId);
  if (!employee) {
    throw new AppError(404, 'NOT_FOUND', 'Employee not found');
  }

  const isOwner = employee.memberships && employee.memberships.some((m: any) => m.role === 'owner');
  const isDeactivating = updates.isActive === false;
  const isChangingRoleFromOwner = isOwner && updates.role && updates.role !== 'owner';
  
  if (isOwner && (isDeactivating || isChangingRoleFromOwner)) {
    const ownersCount = await staffModel.countActiveOwners(db);
    if (ownersCount <= 1) {
      throw new AppError(409, 'CONFLICT', 'Cannot deactivate the last owner');
    }
  }

  if (updates.isActive !== undefined) {
    await staffModel.updateEmployee(db, employeeId, { is_active: updates.isActive });
  }

  if (updates.role !== undefined || updates.branchId !== undefined) {
    const membershipUpdates: any = {};
    if (updates.role !== undefined) membershipUpdates.role = updates.role;
    if (updates.branchId !== undefined) membershipUpdates.branch_id = updates.branchId;
    
    await staffModel.updateMembership(db, employeeId, membershipUpdates);
  }

  return await staffModel.getEmployee(db, employeeId);
}

export async function removeStaffMember(db: Db, employeeId: string) {
  const employee = await staffModel.getEmployee(db, employeeId);
  if (!employee) {
    throw new AppError(404, 'NOT_FOUND', 'Employee not found');
  }
  
  const isOwner = employee.memberships && employee.memberships.some((m: any) => m.role === 'owner');
  if (isOwner) {
    const ownersCount = await staffModel.countActiveOwners(db);
    if (ownersCount <= 1) {
      throw new AppError(409, 'CONFLICT', 'Cannot remove the last owner');
    }
  }

  await staffModel.softDeleteEmployee(db, employeeId);
}
