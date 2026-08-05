import express from 'express';
import {
  trustProxy,
  requestContext,
  helmetMiddleware,
  corsMiddleware,
  cookieParser,
  jsonParser,
  globalRateLimiter,
} from './middleware/security';
import { notFoundHandler, errorHandler } from './middleware/error';
import routes from './routes/index';
import { env } from './config/env';

const app = express();

// ── global (from security.ts, in this order) ──────────────────────────────
trustProxy(app);
app.use(requestContext);          // pino-http: req.id, req.log, x-request-id
app.use(helmetMiddleware);        // §6
app.use(corsMiddleware);          // §5
app.use(cookieParser);            // parses httpOnly staff auth cookies
app.use(jsonParser);              // express.json({ limit: '1mb' })
app.use(globalRateLimiter);       // tier G

// ── routes (each wires its own per-route stack) ───────────────────────────
app.use('/api', routes);

// ── DEV-ONLY API dashboard at /dev — never mounted in production ──────────
if (env.NODE_ENV !== 'production') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  app.use('/dev', require('./dev/dev.routes').default);
}

// ── tail ──────────────────────────────────────────────────────────────────
app.use(notFoundHandler);         // unmatched → AppError(404, 'NOT_FOUND')
app.use(errorHandler);            // MUST be last — the only place errors serialize

export default app;
