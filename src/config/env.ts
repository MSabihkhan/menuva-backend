import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().int().positive().default(4000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),
  CORS_ALLOWED_ORIGINS: z.string().min(1),
  // Origin the table QR codes point at. Defaults to the production domain so
  // local dev and existing deployments keep working without a new variable.
  PUBLIC_APP_URL: z.string().url().default('https://menuva.app'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().optional(),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().optional(),
  DINER_TOKEN_TTL_HOURS: z.coerce.number().int().positive().default(4),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

Object.defineProperty(env, 'SUPABASE_SERVICE_ROLE_KEY', { enumerable: false });
Object.defineProperty(env, 'SUPABASE_JWT_SECRET', { enumerable: false });
