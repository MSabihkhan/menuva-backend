import { z } from 'zod';

export const patchRestaurantSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  taxRateBps: z.number().int().min(0).optional(),
  serviceChargeBps: z.number().int().min(0).optional()
}).strict();

export const postBranchSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  address: z.string().optional(),
  opensAt: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format HH:MM'),
  closesAt: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format HH:MM'),
  timezone: z.string().optional()
}).strict();

export const branchParamsSchema = z.object({
  id: z.string().uuid()
}).strict();

export const patchBranchSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  address: z.string().optional(),
  opensAt: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format HH:MM').optional(),
  closesAt: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format HH:MM').optional(),
  timezone: z.string().optional(),
  isActive: z.boolean().optional()
}).strict();

export const branchTablesParamsSchema = z.object({
  branchId: z.string().uuid()
}).strict();

export const postTableSchema = z.object({
  code: z.string().min(1),
  label: z.string().optional(),
  capacity: z.number().int().min(1).optional()
}).strict();

export const tableParamsSchema = z.object({
  branchId: z.string().uuid(),
  id: z.string().uuid()
}).strict();

export const patchTableSchema = z.object({
  code: z.string().min(1).optional(),
  label: z.string().optional(),
  capacity: z.number().int().min(1).optional()
}).strict();

export const regenerateQrParamsSchema = z.object({
  branchId: z.string().uuid(),
  tableId: z.string().uuid()
}).strict();

export const closeSessionParamsSchema = z.object({
  tableId: z.string().uuid()
}).strict();
