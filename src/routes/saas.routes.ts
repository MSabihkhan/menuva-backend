import { Router, type RequestHandler } from 'express';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { writeLimiter } from '../middleware/security';

import * as saasController from '../controllers/saas.controller';
import * as saasSchema from '../schemas/saas.schema';

const router = Router();

/**
 * Middleware to require the Supabase service role key as a Bearer token.
 * This effectively guards the SaaS routes so they are only accessible
 * by the platform admin surface, completely bypassing RLS via supabaseAdmin.
 */
const requireServiceKey: RequestHandler = (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError(401, 'MISSING_TOKEN', 'Service role key required');
  }

  const token = authHeader.slice(7);
  if (token !== env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid service role key');
  }

  next();
};

// Apply service key requirement to all SaaS routes
// router.use(requireServiceKey); // Removed because it leaked

// GET routes (Rate Tier G applied globally)
router.get('/tenants', requireServiceKey, asyncHandler(saasController.getTenants));
router.get('/tenants/:id', requireServiceKey, asyncHandler(saasController.getTenantById));

router.get('/plans', requireServiceKey, asyncHandler(saasController.getPlans));

router.get('/subscriptions', requireServiceKey, asyncHandler(saasController.getSubscriptions));

router.get('/billing', requireServiceKey, asyncHandler(saasController.getBilling));

router.get('/costs', requireServiceKey, asyncHandler(saasController.getCosts));

router.get('/analytics', requireServiceKey, asyncHandler(saasController.getAnalytics));

// Mutating routes (Rate Tier W)
router.post(
  '/plans',
  requireServiceKey,
  writeLimiter,
  validate(saasSchema.createPlanSchema),
  asyncHandler(saasController.createPlan)
);

router.patch(
  '/plans/:id',
  requireServiceKey,
  writeLimiter,
  validate(saasSchema.updatePlanSchema),
  asyncHandler(saasController.updatePlan)
);

router.patch(
  '/subscriptions/:id',
  requireServiceKey,
  writeLimiter,
  validate(saasSchema.updateSubscriptionSchema),
  asyncHandler(saasController.updateSubscription)
);

router.post(
  '/costs',
  requireServiceKey,
  writeLimiter,
  validate(saasSchema.createCostSchema),
  asyncHandler(saasController.createCost)
);

export default router;
