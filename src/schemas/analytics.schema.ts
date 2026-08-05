import { z } from 'zod';

export const getSalesSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  branchId: z.string().uuid().optional(),
}).strict();

export const getMenuPerformanceSchema = z.object({}).strict();

export const getKitchenTimingSchema = z.object({}).strict();

export const getUpsellAnalyticsSchema = z.object({}).strict();

export const getBranchAnalyticsSchema = z.object({
  branchId: z.string().uuid(),
}).strict();
