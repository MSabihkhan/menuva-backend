import { Router } from 'express';
import * as reviewsController from '../controllers/reviews.controller';
import { createReviewSchema, listReviewsSchema } from '../schemas/reviews.schema';
import { authenticate } from '../middleware/authenticate';
import { requireRole, requireDiner } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { dinerLimiter } from '../middleware/security';

const router = Router();

// POST /api/reviews
router.post(
  '/reviews',
  dinerLimiter,
  authenticate,
  requireDiner,
  validate(createReviewSchema),
  asyncHandler(reviewsController.createReview)
);

// GET /api/reviews
router.get(
  '/reviews',
  authenticate,
  requireRole('owner', 'branch_manager', 'manager'),
  validate(listReviewsSchema, 'query'),
  asyncHandler(reviewsController.listReviews)
);

export default router;
