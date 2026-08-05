import { z } from 'zod';

export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional()
}).strict();

export const listReviewsSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  branchId: z.string().uuid().optional(),
}).strict();
