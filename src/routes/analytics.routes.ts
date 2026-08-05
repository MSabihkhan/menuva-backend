import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import * as analyticsController from '../controllers/analytics.controller';
import {
  getSalesSchema,
  getMenuPerformanceSchema,
  getKitchenTimingSchema,
  getUpsellAnalyticsSchema,
  getBranchAnalyticsSchema
} from '../schemas/analytics.schema';

const router = Router();

router.get(
  '/analytics/sales',
  authenticate,
  requireRole('owner', 'branch_manager'),
  validate(getSalesSchema, 'query'),
  asyncHandler(analyticsController.getSales)
);

router.get(
  '/analytics/menu-performance',
  authenticate,
  requireRole('owner'),
  validate(getMenuPerformanceSchema, 'query'),
  asyncHandler(analyticsController.getMenuPerformance)
);

router.get(
  '/analytics/kitchen-timing',
  authenticate,
  requireRole('owner', 'branch_manager'),
  validate(getKitchenTimingSchema, 'query'),
  asyncHandler(analyticsController.getKitchenTiming)
);

router.get(
  '/analytics/upsell',
  authenticate,
  requireRole('owner'),
  validate(getUpsellAnalyticsSchema, 'query'),
  asyncHandler(analyticsController.getUpsell)
);

router.get(
  '/branches/:branchId/analytics',
  authenticate,
  requireRole('owner', 'branch_manager'),
  validate(getBranchAnalyticsSchema, 'params'),
  asyncHandler(analyticsController.getBranchAnalytics)
);

export default router;
