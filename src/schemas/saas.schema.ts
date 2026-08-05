import { z } from 'zod';

export const createPlanSchema = z.object({
  name: z.string().min(1),
  price: z.number().int().nonnegative(),
  features: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
}).strict();

export const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  price: z.number().int().nonnegative().optional(),
  features: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
}).strict();

export const updateSubscriptionSchema = z.object({
  status: z.enum(['active', 'past_due', 'canceled', 'trialing', 'unpaid', 'incomplete', 'incomplete_expired', 'paused']),
}).strict();

export const createCostSchema = z.object({
  costType: z.string().min(1),
  amount: z.number().int().nonnegative(),
  periodStart: z.string().datetime({ offset: true }),
  periodEnd: z.string().datetime({ offset: true }),
  restaurantId: z.string().uuid().optional(),
}).strict();
