import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { healthCheck } from '../controllers/health.controller';

const router = Router();

router.get('/health', asyncHandler(healthCheck));

export default router;
