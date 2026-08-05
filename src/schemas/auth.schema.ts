import { z } from 'zod';


export const ownerSignupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  restaurantName: z.string().min(1),
  restaurantSlug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must be kebab-case').min(1)
}).strict();

export const staffLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
}).strict();

export const dinerJoinSchema = z.object({
  qrToken: z.string().min(1),
  deviceId: z.string().min(1),
  dinerName: z.string().min(1).max(30),
  initials: z.string().length(2).optional()
}).strict();

export const staffInviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  branchId: z.string().uuid(),
  role: z.enum(['branch_manager', 'manager', 'kitchen', 'editor'])
}).strict();
