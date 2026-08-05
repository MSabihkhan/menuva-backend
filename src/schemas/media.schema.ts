import { z } from 'zod';

export const mediaParamSchema = z.object({
  menuItemId: z.string().uuid('Invalid menu item ID'),
});

export const imageUploadSchema = z.object({
  altText: z.string().optional(),
  isPrimary: z.enum(['true', 'false']).optional(),
});

export const videoUploadSchema = z.object({
  durationSec: z.string().regex(/^\d+$/, 'Duration must be a number').optional(),
});

export const imageDeleteParamSchema = z.object({
  imageId: z.string().uuid('Invalid image ID'),
});

export const videoDeleteParamSchema = z.object({
  videoId: z.string().uuid('Invalid video ID'),
});

export const modelDeleteParamSchema = z.object({
  modelId: z.string().uuid('Invalid model ID'),
});
