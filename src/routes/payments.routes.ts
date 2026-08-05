import { Router } from 'express';
import { dinerLimiter } from '../middleware/security';
import { authenticate } from '../middleware/authenticate';
import { requireDiner } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { paymentsController } from '../controllers/payments.controller';
import { payBillSchema } from '../schemas/payments.schema';

const router = Router();

router.get('/payments/bill',
  authenticate,
  requireDiner,
  asyncHandler(paymentsController.getBill)
);

router.post('/payments',
  dinerLimiter,
  authenticate,
  requireDiner,
  validate(payBillSchema),
  asyncHandler(paymentsController.payBill)
);

export default router;
