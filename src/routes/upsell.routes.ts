import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireDiner, requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { dinerLimiter, writeLimiter } from '../middleware/security';
import { asyncHandler } from '../utils/asyncHandler';
import * as schema from '../schemas/upsell.schema';
import * as controller from '../controllers/upsell.controller';

const router = Router();

router.post(
  '/upsell/suggestions',
  dinerLimiter,
  authenticate,
  requireDiner,
  validate(schema.getSuggestionsSchema),
  asyncHandler(controller.getSuggestions)
);

router.post(
  '/upsell/events',
  dinerLimiter,
  authenticate,
  requireDiner,
  validate(schema.logEventSchema),
  asyncHandler(controller.logEvent)
);

router.get(
  '/upsell/rules',
  authenticate,
  requireRole('owner'),
  asyncHandler(controller.getRules)
);

router.patch(
  '/upsell/rules',
  writeLimiter,
  authenticate,
  requireRole('owner'),
  validate(schema.patchRulesSchema),
  asyncHandler(controller.patchRules)
);

router.get(
  '/upsell/pairings',
  authenticate,
  requireRole('owner', 'editor'),
  asyncHandler(controller.getPairings)
);

router.post(
  '/upsell/pairings',
  writeLimiter,
  authenticate,
  requireRole('owner', 'editor'),
  validate(schema.createPairingSchema),
  asyncHandler(controller.createPairings)
);

router.delete(
  '/upsell/pairings/:id',
  writeLimiter,
  authenticate,
  requireRole('owner', 'editor'),
  asyncHandler(controller.deletePairing)
);

router.get(
  '/upsell/affinity',
  authenticate,
  requireRole('owner'),
  asyncHandler(controller.getAffinity)
);

router.post(
  '/upsell/affinity',
  writeLimiter,
  authenticate,
  requireRole('owner'),
  validate(schema.createAffinitySchema),
  asyncHandler(controller.createAffinity)
);

router.delete(
  '/upsell/affinity/:id',
  writeLimiter,
  authenticate,
  requireRole('owner'),
  asyncHandler(controller.deleteAffinity)
);

export default router;
