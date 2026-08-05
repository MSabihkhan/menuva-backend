import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type Role = 'owner' | 'branch_manager' | 'manager' | 'kitchen' | 'editor';

export interface DinerClaims {
  sub: string;
  session_id: string;
  member_id: string;
  restaurant_id: string;
  branch_id: string;
  table_id: string;
  is_diner: true;
  role: 'authenticated';
  exp: number;
  iss: string;
}

export interface StaffClaims {
  sub: string;
  app_metadata: {
    restaurant_id: string;
    role: Role;
    branch_id?: string;
    employee_id?: string;
  };
  exp: number;
  iss: string;
}

export interface AuthContext {
  kind: 'staff' | 'diner';
  userId: string;
  restaurantId: string;
  role?: Role;
  branchId?: string;
  employeeId?: string;
  sessionId?: string;
  memberId?: string;
  tableId?: string;
  raw: Record<string, unknown>;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      db?: SupabaseClient<Database>;
      id: string;
    }
  }
}

export {};
