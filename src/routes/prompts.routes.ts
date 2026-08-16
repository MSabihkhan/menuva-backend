import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireDiner } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { dinerLimiter } from '../middleware/security';
import { asyncHandler } from '../utils/asyncHandler';
import { promptsController } from '../controllers/prompts.controller';
import {
  openPromptSchema,
  promptParamsSchema,
  respondPromptSchema,
} from '../schemas/prompts.schema';

const router = Router();

// Table-wide decisions: place order, choose a split method, end the session.
router.post('/table/prompts',
  dinerLimiter, authenticate, requireDiner,
  validate(openPromptSchema), asyncHandler(promptsController.open));

router.get('/table/prompts/active',
  dinerLimiter, authenticate, requireDiner,
  asyncHandler(promptsController.active));

router.post('/table/prompts/:promptId/respond',
  dinerLimiter, authenticate, requireDiner,
  validate(promptParamsSchema, 'params'), validate(respondPromptSchema),
  asyncHandler(promptsController.respond));

router.post('/table/prompts/:promptId/cancel',
  dinerLimiter, authenticate, requireDiner,
  validate(promptParamsSchema, 'params'), asyncHandler(promptsController.cancel));

router.post('/table/prompts/:promptId/resolve',
  dinerLimiter, authenticate, requireDiner,
  validate(promptParamsSchema, 'params'), asyncHandler(promptsController.resolve));

// Ends the table for everyone — the last step of the pay-and-leave flow.
router.post('/table/end',
  dinerLimiter, authenticate, requireDiner,
  asyncHandler(promptsController.endSession));

export default router;
