import { Router } from 'express';
import { dinerLimiter } from '../middleware/security';
import { authenticate } from '../middleware/authenticate';
import { requireDiner } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { paymentsController } from '../controllers/payments.controller';
import { payBillSchema, splitPreviewSchema } from '../schemas/payments.schema';

const router = Router();

router.get('/payments/bill',
  authenticate,
  requireDiner,
  asyncHandler(paymentsController.getBill)
);

// What each diner owes for an agreed set of split choices. Computed server-side
// because the mixed case (some personal, some equal) is easy to get wrong.
router.post('/payments/split',
  dinerLimiter,
  authenticate,
  requireDiner,
  validate(splitPreviewSchema),
  asyncHandler(paymentsController.getSplit)
);

router.post('/payments',
  dinerLimiter,
  authenticate,
  requireDiner,
  validate(payBillSchema),
  asyncHandler(paymentsController.payBill)
);

export default router;
