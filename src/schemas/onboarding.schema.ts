import { z } from 'zod';

export const bootstrapSchema = z.object({
  branchName: z.string().min(1).optional(),
  branchSlug: z.string().min(1).optional(),
  tableCount: z.number().int().min(1).max(50).optional(),
  seedSampleMenu: z.boolean().optional(),
}).strict();
