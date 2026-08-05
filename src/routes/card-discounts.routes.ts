import { Router } from 'express';
import * as cardDiscountsController from '../controllers/card-discounts.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createCardDiscountSchema, updateCardDiscountSchema } from '../schemas/card-discounts.schema';
import { asyncHandler } from '../utils/asyncHandler';
import { writeLimiter } from '../middleware/security';

const router = Router();

router.get(
  '/',
  authenticate,
  requireRole('owner', 'branch_manager'),
  asyncHandler(cardDiscountsController.list)
);

router.post(
  '/',
  writeLimiter,
  authenticate,
  requireRole('owner', 'branch_manager'),
  validate(createCardDiscountSchema),
  asyncHandler(cardDiscountsController.create)
);

router.patch(
  '/:id',
  writeLimiter,
  authenticate,
  requireRole('owner', 'branch_manager'),
  validate(updateCardDiscountSchema),
  asyncHandler(cardDiscountsController.update)
);

router.delete(
  '/:id',
  writeLimiter,
  authenticate,
  requireRole('owner', 'branch_manager'),
  asyncHandler(cardDiscountsController.remove)
);

export default router;
