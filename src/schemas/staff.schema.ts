import { z } from 'zod';
import { STAFF_ROLES } from '../config/constants';

export const updateStaffSchema = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(STAFF_ROLES).optional(),
  branchId: z.string().uuid().optional(),
}).strict();
