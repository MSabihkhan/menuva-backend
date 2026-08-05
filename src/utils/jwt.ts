import jwt from 'jsonwebtoken';
import { createPublicKey, type KeyObject } from 'crypto';
import { env } from '../config/env';
import { AppError } from './AppError';

export interface JwtPayload {
  sub: string;
  exp: number;
  iss?: string;
  is_diner?: boolean;
  session_id?: string;
  member_id?: string;
  restaurant_id?: string;
  branch_id?: string;
  table_id?: string;
  role?: string;
  app_metadata?: {
    restaurant_id?: string;
    role?: string;
    branch_id?: string;
    employee_id?: string;
    table_id?: string;
  };
  [key: string]: unknown;
}

/**
 * Two token families reach this backend, signed differently:
 *
 *   • Diner tokens — minted here (pgjwt / mintDinerJwt) with HS256 and the
 *     project's shared JWT secret. `is_diner: true`.
 *   • Staff tokens — issued by Supabase Auth on staff login. Modern Supabase
 *     projects sign these ASYMMETRICALLY (ES256/RS256) with a rotating key, so
 *     they CANNOT be verified with the shared secret — they must be checked
 *     against the project's public JWKS.
 *
 * We branch on the token's `alg` header: HS256 → shared secret; anything else
 * → JWKS. Verification uses only `jsonwebtoken` + Node's `crypto` (a JWK imports
 * straight into a public KeyObject) — deliberately no ESM-only JWKS library, so
 * the CJS test runner keeps working.
 */
const SUPABASE_ISSUER = `${env.SUPABASE_URL}/auth/v1`;
const JWKS_URL = `${SUPABASE_ISSUER}/.well-known/jwks.json`;

interface Jwk {
  kid: string;
  kty: string;
  alg?: string;
  [k: string]: unknown;
}

// Public keys are small and rotate rarely — cache by `kid`, refetch on miss.
const keyCache = new Map<string, KeyObject>();
let lastFetch = 0;

async function getSigningKey(kid: string): Promise<KeyObject> {
  const cached = keyCache.get(kid);
  if (cached) return cached;

  // Throttle refetches (e.g. against a bogus kid) to at most once every 30s.
  if (Date.now() - lastFetch < 30_000 && keyCache.size > 0) {
    throw new AppError(401, 'INVALID_TOKEN', 'Unknown signing key.');
  }
  lastFetch = Date.now();

  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new AppError(401, 'INVALID_TOKEN', 'Could not fetch signing keys.');
  const { keys } = (await res.json()) as { keys: Jwk[] };

  for (const jwk of keys ?? []) {
    try {
      keyCache.set(jwk.kid, createPublicKey({ key: jwk as never, format: 'jwk' }));
    } catch {
      /* skip an unusable key */
    }
  }

  const key = keyCache.get(kid);
  if (!key) throw new AppError(401, 'INVALID_TOKEN', 'Unknown signing key.');
  return key;
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const decoded = jwt.decode(token, { complete: true });
  const alg = decoded?.header?.alg;

  try {
    if (alg === 'HS256') {
      // Diner tokens minted by this backend.
      return jwt.verify(token, env.SUPABASE_JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
    }

    // Asymmetric (staff) token → verify against Supabase's public keys.
    const kid = decoded?.header?.kid;
    if (!kid || (alg !== 'ES256' && alg !== 'RS256')) {
      throw new AppError(401, 'INVALID_TOKEN', 'Invalid authentication token.');
    }
    const key = await getSigningKey(kid);
    return jwt.verify(token, key, {
      algorithms: [alg],
      issuer: SUPABASE_ISSUER,
    }) as JwtPayload;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Session token expired. Please sign in again.');
    }
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid authentication token.');
  }
}
