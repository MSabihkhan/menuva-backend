import type { RequestHandler } from 'express';
import { AppError } from '../utils/AppError';
import { verifyToken } from '../utils/jwt';
import { supabaseForToken, supabaseAdmin } from '../config/supabase';
import type { AuthContext, Role } from '../types/auth.types';

/**
 * How long after a table closes a diner may still submit their review.
 * Payment closes the session for everyone, and the review comes straight
 * after, so a hard cut-off would silently discard most feedback.
 */
const REVIEW_GRACE_MS = 30 * 60 * 1000;

/**
 * Short-lived cache of the diner session row.
 *
 * Every diner request re-read table_sessions to check the session was still
 * open — a full Supabase round trip (~230ms) on the critical path of every tap,
 * just to read a row that changes at most a handful of times per visit.
 *
 * The TTL is deliberately tiny, and `invalidateSession` is called the instant a
 * session is closed, so a closed table still ejects its devices immediately
 * rather than after the cache expires. The window only matters if a session is
 * closed by something that does not go through the app.
 */
const SESSION_CACHE_TTL_MS = 5000;
const sessionCache = new Map<string, { expiresAt: number; row: { expires_at: string; closed_at: string | null } }>();

export function invalidateSession(sessionId: string): void {
  sessionCache.delete(sessionId);
}

function cachedSession(sessionId: string) {
  const hit = sessionCache.get(sessionId);
  if (hit && hit.expiresAt > Date.now()) return hit.row;
  if (hit) sessionCache.delete(sessionId);
  return null;
}

function cacheSession(sessionId: string, row: { expires_at: string; closed_at: string | null }) {
  // Never cache a closed session: it must be re-read so the close is honoured
  // the moment the grace window for reviews lapses.
  if (row.closed_at) return;
  sessionCache.set(sessionId, { expiresAt: Date.now() + SESSION_CACHE_TTL_MS, row });
}

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

      // Live session re-check: validate the session is still open.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let session: any = cachedSession(auth.sessionId!);

      if (!session) {
        const { data, error: sessionError } = await supabaseAdmin
          .from('table_sessions')
          .select('id,expires_at,closed_at')
          .eq('id', auth.sessionId!)
          .single();
        session = data;

        if (sessionError || !session) {
          console.error('authenticate.ts sessionError:', sessionError);
          throw new AppError(401, 'SESSION_EXPIRED',
            'This table session has ended. Scan the QR code again.');
        }
        cacheSession(auth.sessionId!, session);
      }

      const expiresAt = new Date(session.expires_at as string).getTime();

      // A just-closed table still has to accept reviews. Paying closes the
      // session for everyone, and the review is the very next thing each diner
      // does — rejecting it outright meant the table could only be reviewed by
      // someone who got in before the payment landed. Nothing else is allowed
      // through: no menu, no cart, no ordering, no second payment.
      const closedAt = session.closed_at ? new Date(session.closed_at as string).getTime() : null;
      const withinReviewGrace =
        closedAt !== null && Date.now() - closedAt <= REVIEW_GRACE_MS;
      const reviewOnlyRequest = req.method === 'POST' && req.path.startsWith('/reviews');

      if (expiresAt < Date.now()) {
        throw new AppError(401, 'SESSION_EXPIRED',
          'This table session has ended. Scan the QR code again.');
      }
      if (closedAt !== null && !(withinReviewGrace && reviewOnlyRequest)) {
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
