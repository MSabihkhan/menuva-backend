/**
 * ────────────────────────────────────────────────────────────────────────────
 *  dev.routes.ts — DEV-ONLY API dashboard
 * ────────────────────────────────────────────────────────────────────────────
 *  Mounted by app.ts ONLY when NODE_ENV !== 'production'.
 *
 *    GET  /dev            → the dashboard HTML
 *    GET  /dev/context    → the currently-seeded tenant (or null)
 *    POST /dev/seed       → seed a fresh throwaway tenant, return its context
 *
 *  The dashboard calls the REAL /api/* routes with the tokens from /dev/seed,
 *  so what you see in it is exactly what the frontend will get.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { Router } from 'express';
import path from 'path';
import { seedDevTenant, getCachedContext } from './devSeed';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

router.get('/context', (_req, res) => {
  res.json({ ok: true, data: getCachedContext() });
});

router.post(
  '/seed',
  asyncHandler(async (_req, res) => {
    const ctx = await seedDevTenant();
    res.json({ ok: true, data: ctx });
  }),
);

export default router;
