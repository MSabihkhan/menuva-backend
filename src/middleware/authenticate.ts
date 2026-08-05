import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError';
import { verifyToken } from '../utils/jwt';
import { supabaseForToken, supabaseAdmin } from '../config/supabase';
import type { AuthContext, Role } from '../types/auth.types';

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    // 1. Extract token — precedence: Authorization header, then mv_access cookie
    let rawToken: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      rawToken = authHeader.slice(7);
    } else if (req.cookies?.mv_access) {
      rawToken = req.cookies.mv_access as string;
    }

    if (!rawToken) {
      throw new AppError(401, 'MISSING_TOKEN', 'Authentication required.');
    }

    // 2. Verify signature + exp (HS256 diner tokens or ES256/RS256 staff tokens)
    const payload = await verifyToken(rawToken);

    // 3. Branch on is_diner
    let auth: AuthContext;

    if (payload.is_diner) {
      console.log('Diner Payload:', payload);
      // ── Diner path ──
      auth = {
        kind: 'diner',
        userId: payload.sub,
        restaurantId: payload.restaurant_id as string,
        branchId: payload.branch_id as string,
        sessionId: payload.session_id as string,
        memberId: payload.member_id as string,
        tableId: payload.table_id as string,
        raw: payload as unknown as Record<string, unknown>,
      };

      // Live session re-check: validate the session is still open
      const { data, error: sessionError } = await supabaseAdmin
        .from('table_sessions')
        .select('id,expires_at,closed_at')
        .eq('id', auth.sessionId!)
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = data as any;

      if (sessionError || !session) {
        console.error('authenticate.ts sessionError:', sessionError);
        throw new AppError(401, 'SESSION_EXPIRED',
          'This table session has ended. Scan the QR code again.');
      }

      const expiresAt = new Date(session.expires_at as string).getTime();
      if (session.closed_at || expiresAt < Date.now()) {
        throw new AppError(401, 'SESSION_EXPIRED',
          'This table session has ended. Scan the QR code again.');
      }
    } else {
      // ── Staff path ──
      console.log('Staff Payload:', payload);
      const meta = payload.app_metadata;
      if (!meta?.restaurant_id) {
        throw new AppError(401, 'INVALID_TOKEN',
          'Account not fully provisioned. Sign in again.');
      }

      auth = {
        kind: 'staff',
        userId: payload.sub,
        restaurantId: meta.restaurant_id as string,
        role: meta.role as Role,
        branchId: meta.branch_id as string | undefined,
        employeeId: meta.employee_id as string | undefined,
        raw: payload as unknown as Record<string, unknown>,
      };
    }

    // 4. Attach request-scoped client
    req.auth = auth;
    req.db = supabaseForToken(rawToken);

    // 5. next()
    next();
  } catch (err) {
    next(err);
  }
};
