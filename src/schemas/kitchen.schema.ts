import { z } from 'zod';

export const getKitchenBoardSchema = z.object({
  status: z.string().optional(),
  branchId: z.string().uuid().optional(),
}).strict();

export const advanceOrderSchema = z.object({
  to: z.enum(['preparing', 'ready', 'served']).optional(),
}).strict();

export const advanceOrderParamsSchema = z.object({
  orderId: z.string().uuid()
}).strict();
