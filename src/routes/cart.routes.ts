import { Router } from 'express';
import { cartController } from '../controllers/cart.controller';
import { authenticate } from '../middleware/authenticate';
import { requireDiner } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { dinerLimiter } from '../middleware/security';
import { addToCartSchema, updateCartItemSchema } from '../schemas/cart.schema';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.get('/cart', dinerLimiter, authenticate, requireDiner, asyncHandler(cartController.getCart));
router.post('/cart/items', dinerLimiter, authenticate, requireDiner, validate(addToCartSchema, 'body'), asyncHandler(cartController.addItem));
router.patch('/cart/items/:cartItemId', dinerLimiter, authenticate, requireDiner, validate(updateCartItemSchema, 'body'), asyncHandler(cartController.updateItem));
router.delete('/cart/items/:cartItemId', dinerLimiter, authenticate, requireDiner, asyncHandler(cartController.removeItem));

export default router;
