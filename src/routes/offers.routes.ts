import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { writeLimiter } from '../middleware/security';
import * as OffersController from '../controllers/offers.controller';
import * as OffersSchema from '../schemas/offers.schema';

const router = Router();

const authMiddleware = [authenticate, requireRole('owner', 'branch_manager')];

// --- Offers ---
router.get('/offers', ...authMiddleware, OffersController.getOffers);
router.post(
  '/offers',
  ...authMiddleware,
  writeLimiter,
  validate(OffersSchema.createOfferBodySchema, 'body'),
  OffersController.createOffer
);
router.patch(
  '/offers/:id',
  ...authMiddleware,
  writeLimiter,
  validate(OffersSchema.updateOfferParamsSchema, 'params'),
  validate(OffersSchema.updateOfferBodySchema, 'body'),
  OffersController.updateOffer
);
router.delete(
  '/offers/:id',
  ...authMiddleware,
  writeLimiter,
  validate(OffersSchema.deleteOfferParamsSchema, 'params'),
  OffersController.deleteOffer
);

// --- Card Discounts ---
router.get('/card-discounts', ...authMiddleware, OffersController.getCardDiscounts);
router.post(
  '/card-discounts',
  ...authMiddleware,
  writeLimiter,
  validate(OffersSchema.createCardDiscountBodySchema, 'body'),
  OffersController.createCardDiscount
);
router.patch(
  '/card-discounts/:id',
  ...authMiddleware,
  writeLimiter,
  validate(OffersSchema.updateCardDiscountParamsSchema, 'params'),
  validate(OffersSchema.updateCardDiscountBodySchema, 'body'),
  OffersController.updateCardDiscount
);
router.delete(
  '/card-discounts/:id',
  ...authMiddleware,
  writeLimiter,
  validate(OffersSchema.deleteCardDiscountParamsSchema, 'params'),
  OffersController.deleteCardDiscount
);

export default router;
