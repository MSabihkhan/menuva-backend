import './env';
import * as jwt from 'jsonwebtoken';
import { supabaseAdmin } from './supabaseAdmin';

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET!;

export function mintStaffJwt(claims: { userId?: string; restaurantId: string; role: string; branchId?: string; employeeId?: string; expMs?: number }) {
  const exp = Math.floor((Date.now() + (claims.expMs || 3600000)) / 1000);
  return jwt.sign(
    {
      aud: 'authenticated',
      iss: 'supabase',
      sub: claims.userId || 'user-id',
      role: 'authenticated',
      app_metadata: { 
        restaurant_id: claims.restaurantId, 
        role: claims.role, 
        branch_id: claims.branchId, 
        employee_id: claims.employeeId 
      },
      exp,
    },
    JWT_SECRET
  );
}

export function mintDinerJwt(claims: { sessionId: string; memberId: string; restaurantId: string; branchId: string; tableId: string; expMs?: number }) {
  const exp = Math.floor((Date.now() + (claims.expMs || 3600000)) / 1000);
  return jwt.sign(
    {
      aud: 'authenticated',
      iss: 'supabase',
      role: 'authenticated',
      is_diner: true,
      sub: claims.memberId,
      session_id: claims.sessionId,
      member_id: claims.memberId,
      restaurant_id: claims.restaurantId,
      branch_id: claims.branchId,
      table_id: claims.tableId,
      exp,
    },
    JWT_SECRET
  );
}

export function expiredStaffToken(params: any = { restaurantId: 'r1', role: 'owner' }) {
  return mintStaffJwt({ ...params, expMs: -3600000 });
}

export function expiredDinerToken(params: any = { sessionId: 's1', memberId: 'm1', restaurantId: 'r1', branchId: 'b1', tableId: 't1' }) {
  return mintDinerJwt({ ...params, expMs: -3600000 });
}

export function tamperedToken() {
  const t = mintDinerJwt({ sessionId: 's1', memberId: 'm1', restaurantId: 'r1', branchId: 'b1', tableId: 't1' });
  return t.slice(0, -5) + 'abcde';
}

export async function loginStaff(email: string, password: string) {
  // Use supabaseAdmin to sign in with password to get real cookie path
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    throw error;
  }
  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: data.user
  };
}
