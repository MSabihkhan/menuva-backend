import { z } from 'zod';

export const placeOrderSchema = z.object({
  idempotencyKey: z.string().uuid(),
  kitchenNotes: z.string().optional()
}).strict();

export const getOrderParamsSchema = z.object({
  orderId: z.string().uuid()
}).strict();

export const branchOrdersParamsSchema = z.object({
  branchId: z.string().uuid()
}).strict();
