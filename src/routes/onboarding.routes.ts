import { Router } from 'express';
import * as onboardingController from '../controllers/onboarding.controller';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { bootstrapSchema } from '../schemas/onboarding.schema';
import { globalRateLimiter } from '../middleware/security';

const router = Router();

router.post(
  '/bootstrap',
  globalRateLimiter,
  authenticate,
  requireRole('owner'),
  validate(bootstrapSchema, 'body'),
  onboardingController.bootstrap
);

export default router;
