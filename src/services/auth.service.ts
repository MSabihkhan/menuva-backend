import { randomBytes } from 'crypto';
import { supabaseAnon, supabaseAdmin, supabaseForToken } from '../config/supabase';
import { AppError } from '../utils/AppError';
import { joinTableSession, inviteStaffRpc } from '../models/auth.model';
import { broadcastToSession } from '../utils/realtime';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

type Db = SupabaseClient<Database>;

export async function ownerSignup(params: { name: string; email: string; password: string; restaurantName: string; restaurantSlug: string }) {
  const { name, email, password, restaurantName, restaurantSlug } = params;

  const { data, error } = await supabaseAnon.auth.signUp({
    email,
    password,
    options: {
      data: {
        signup_role: 'owner',
        restaurant_name: restaurantName,
        restaurant_slug: restaurantSlug,
        name,
      },
    },
  });

  if (error) {
    if (error.status === 422 || error.message.includes('already registered') || error.message.includes('slug')) {
      throw new AppError(409, 'CONFLICT', 'Email or restaurant slug already exists', error);
    }
    // Supabase's confirmation email is what proves the address and unlocks the
    // account. If it could not be sent, NO user was created — reporting success
    // here stranded the owner: they were told to check an inbox that would never
    // receive anything, and no restaurant was ever provisioned. Surface it.
    if (error.status === 429) {
      throw new AppError(
        503,
        'SERVICE_UNAVAILABLE',
        'We could not send your confirmation email right now. Please try again in a few minutes.',
        error,
      );
    }
    if ((error as { code?: string }).code === 'email_address_invalid') {
      throw new AppError(400, 'VALIDATION_ERROR', 'That email address was rejected as invalid.', error);
    }
    console.error('Signup error:', error);
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to sign up owner', error);
  }

  // Belt-and-braces: a 2xx with no user means the account was not created, and
  // the caller must not be told to go check their email.
  if (!data?.user) {
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'Signup could not be completed. Please try again in a few minutes.',
    );
  }

  return { needsEmailConfirm: !data.session };
}

export async function staffLogin(params: { email: string; password: string }) {
  const { data, error } = await supabaseAnon.auth.signInWithPassword({
    email: params.email,
    password: params.password,
  });

  if (error || !data.session) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password', error);
  }

  const { access_token, refresh_token, expires_in, user } = data.session;
  return {
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresIn: expires_in,
    role: user.app_metadata.role,
    restaurantId: user.app_metadata.restaurant_id,
    branchId: user.app_metadata.branch_id,
  };
}

export async function staffRefresh(refreshToken: string) {
  const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token: refreshToken });

  if (error || !data.session) {
    throw new AppError(401, 'TOKEN_EXPIRED', 'Session token expired. Please sign in again.', error);
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in,
  };
}

export async function staffLogout(accessToken: string) {
  // Try to sign out using the anon client but passing the token.
  // Actually, we can just use the admin client or anon client. It's safer to use the token.
  const { error } = await supabaseForToken(accessToken).auth.signOut();
  if (error) {
    // If it fails, we still want to clear cookies, so we ignore or log.
  }
}

export async function dinerJoin(params: { qrToken: string; deviceId: string; dinerName: string; initials?: string }) {
  const data = await joinTableSession(
    supabaseAnon,
    params.qrToken,
    params.deviceId,
    params.dinerName,
    params.initials
  );

  // Non-fatal: notify other diners on the table that someone just joined.
  await broadcastToSession(data.session_id, 'member_joined', {
    memberId: data.member_id,
    name: params.dinerName,
    initials: params.initials || params.dinerName.slice(0, 2).toUpperCase(),
  });

  return {
    sessionId: data.session_id,
    memberId: data.member_id,
    token: data.token,
    expiresAt: data.expires_at,
    tableCode: data.table_code,
    tableLabel: data.table_label
  };
}

/** Readable one-time password: no ambiguous characters, safe to read aloud. */
function generateTemporaryPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(16);
  let out = '';
  for (let i = 0; i < 14; i++) out += alphabet[bytes[i % bytes.length] % alphabet.length];
  return out;
}

export async function staffInvite(
  db: Db,
  params: { email: string; name: string; branchId: string; role: string; restaurantId: string },
) {
  // 1. Call RPC under RLS to ensure they have permission and add the row
  const employeeId = await inviteStaffRpc(db, params.email, params.name, params.branchId, params.role);

  // 2. Give them an actual account.
  //
  // This used to call inviteUserByEmail and swallow any failure, so whenever the
  // project's email quota was exhausted the invite "succeeded" with no auth user
  // behind it — the person showed as Active in the Staff list but could never log
  // in, and `employees.user_id` pointed at a UUID the RPC had invented. Create the
  // user directly with a one-time password instead: no email dependency, and the
  // account exists before we report success.
  //
  // app_metadata is what `authenticate` reads off the staff JWT, so it must carry
  // the tenant and role or the first login fails as "not fully provisioned".
  const temporaryPassword = generateTemporaryPassword();
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: params.email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { name: params.name },
    app_metadata: {
      restaurant_id: params.restaurantId,
      role: params.role,
      branch_id: params.branchId,
      employee_id: employeeId,
    },
  });

  if (createError || !created?.user) {
    const message = createError?.message ?? 'Could not create the staff account';
    if (/already been registered|already exists/i.test(message)) {
      throw new AppError(409, 'CONFLICT', 'That email already has an account', createError ?? undefined);
    }
    throw new AppError(500, 'INTERNAL_ERROR', 'Staff row created but the login could not be provisioned', createError ?? undefined);
  }

  // 3. Point the employee row at the real auth user.
  const { error: linkError } = await supabaseAdmin
    .from('employees')
    .update({ user_id: created.user.id })
    .eq('id', employeeId);
  if (linkError) {
    console.error('Failed to link employee to auth user:', linkError.message);
    throw new AppError(500, 'INTERNAL_ERROR', 'Staff account created but could not be linked', linkError);
  }

  return { employeeId, email: params.email, temporaryPassword };
}
