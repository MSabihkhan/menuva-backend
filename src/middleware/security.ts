/**
 * ────────────────────────────────────────────────────────────────────────────
 *  security.ts — Menuva global security middleware
 * ────────────────────────────────────────────────────────────────────────────
 *  WHAT'S IN HERE (in the exact order these run in app.ts):
 *    1. trustProxy(app)        — so req.ip is the real client behind Supabase/host
 *    2. requestContext         — pino-http: attaches req.id + req.log, sets x-request-id
 *    3. helmet(...)            — secure HTTP headers for a JSON API (see §6)
 *    4. corsMiddleware         — strict origin allowlist, credentials:true (see §5)
 *    5. cookieParser()         — parses httpOnly staff auth cookies
 *    6. express.json({limit})  — body parser with a hard size cap (§4.1)
 *    7. globalRateLimiter      — baseline per-IP flood protection (§4.2 tier G)
 *
 *  WHAT'S *NOT* HERE (applied per-route, see routes/* and 03-API-Contracts):
 *    - authenticate  (authenticate.ts)  — verifies JWT, attaches req.auth + req.db
 *    - authorize     (authorize.ts)     — role / ownership guards
 *    - validate      (validate.ts)      — Zod, per-route
 *    - route-tier rate limiters         — authLimiter, dinerLimiter, writeLimiter
 *    - errorHandler  (error.ts)         — MUST be registered LAST in app.ts
 *
 *  ORDER MATTERS: helmet before cors before body-parsing before rate-limiting.
 *  Never move the error handler off the end. Never authenticate before cors.
 * ────────────────────────────────────────────────────────────────────────────
 */

import type { Application, RequestHandler } from 'express';
import pinoHttp from 'pino-http';
import helmetLib from 'helmet';
import corsLib from 'cors';
import cookieParserLib from 'cookie-parser';
import express from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

// ── 1. Trust proxy ──────────────────────────────────────────────────────────
export function trustProxy(app: Application): void {
  app.set('trust proxy', 1);
}

// ── 2. Request context (pino-http) ──────────────────────────────────────────
export const requestContext: RequestHandler = pinoHttp({
  logger,
  genReqId: (req) => {
    const existing = req.headers['x-request-id'];
    if (typeof existing === 'string' && existing.length > 0) return existing;
    return crypto.randomUUID();
  },
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res) =>
    `${req.method} ${req.url} ${res.statusCode}`,
  customProps: () => ({}),
  autoLogging: {
    ignore: (req) => req.url === '/api/health',
  },
}) as unknown as RequestHandler;

// ── 3. Helmet (§6 — JSON-API profile) ───────────────────────────────────────
export const helmetMiddleware: RequestHandler = helmetLib({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
  hsts: { maxAge: 15552000, includeSubDomains: true },
  frameguard: { action: 'deny' },
}) as unknown as RequestHandler;

// ── 4. CORS (§5) ────────────────────────────────────────────────────────────
const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(',').map((s) => s.trim());

// DEV ONLY: the /dev API dashboard is served by this same server, so its origin
// is the server's own. Browsers still send an Origin header on same-origin POSTs,
// which the allowlist below would otherwise reject. Never applied in production.
if (env.NODE_ENV !== 'production') {
  allowedOrigins.push(`http://localhost:${env.PORT}`, `http://127.0.0.1:${env.PORT}`);
}

export const corsMiddleware: RequestHandler = corsLib({
  origin: (origin, cb) => {
    // Allow same-origin/curl (no Origin header) and any allow-listed origin
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(
      new AppError(403, 'INSUFFICIENT_ROLE', 'Origin not allowed') as unknown as Error,
      false,
    );
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: [
    'x-request-id',
    'RateLimit-Limit',
    'RateLimit-Remaining',
    'RateLimit-Reset',
  ],
  maxAge: 600,
}) as RequestHandler;

// ── 5. Cookie parser ────────────────────────────────────────────────────────
export const cookieParser: RequestHandler = cookieParserLib() as RequestHandler;

// ── 6. JSON body parser ─────────────────────────────────────────────────────
export const jsonParser: RequestHandler = express.json({ limit: '1mb' });

// ── 7. Rate limiters ────────────────────────────────────────────────────────

// Tier G — global baseline (all /api/*)
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS ?? 60_000,
  max: env.RATE_LIMIT_MAX ?? 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError(429, 'RATE_LIMITED', 'Too many requests, slow down.'));
  },
  // TODO(scale): Redis store for multi-instance deployments
});

// Tier A — auth/brute-force (login, signup, diner join, refresh)
export const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError(429, 'RATE_LIMITED', 'Too many requests, slow down.'));
  },
  // TODO(scale): Redis store
});

// Tier D — diner writes (cart, orders, upsell logging)
export const dinerLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyGenerator: (req) => {
    return req.auth?.sessionId ?? req.ip ?? 'unknown';
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError(429, 'RATE_LIMITED', 'Too many requests, slow down.'));
  },
  // TODO(scale): Redis store
});

// Tier W — staff writes (CRUD, kitchen advance)
export const writeLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  keyGenerator: (req) => {
    return req.auth?.userId ?? req.ip ?? 'unknown';
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError(429, 'RATE_LIMITED', 'Too many requests, slow down.'));
  },
  // TODO(scale): Redis store
});
