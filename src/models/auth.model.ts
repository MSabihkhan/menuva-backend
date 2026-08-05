import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { AppError } from '../utils/AppError';

type Db = SupabaseClient<Database>;

export async function joinTableSession(
  db: Db,
  qrToken: string,
  deviceId: string,
  dinerName: string,
  initials?: string
) {
  const { data, error } = await db.rpc('join_table_session', {
    p_qr_token: qrToken,
    p_device_id: deviceId,
    p_diner_name: dinerName,
    p_initials: initials || undefined,
  });

  if (error) {
    if (error.code === 'P0001' || error.message.includes('Invalid or inactive')) {
      throw new AppError(404, 'NOT_FOUND', 'Invalid or inactive QR token');
    }
    console.error('join_table_session error details:', error);
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to join table session', error);
  }

  return data as any;
}

export async function inviteStaffRpc(
  db: Db,
  email: string,
  name: string,
  branchId: string,
  role: string
) {
  const { data, error } = await db.rpc('invite_staff', {
    p_email: email,
    p_name: name,
    p_branch_id: branchId,
    p_role: role,
  });

  if (error) {
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      throw new AppError(404, 'NOT_FOUND', 'Branch not found or access denied');
    }
    if (error.code === '23505' || error.message.includes('already a member')) {
      throw new AppError(409, 'CONFLICT', 'User is already a member');
    }
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to invite staff', error);
  }

  return data;
}
