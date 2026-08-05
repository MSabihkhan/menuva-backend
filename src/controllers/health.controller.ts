import type { Request, Response } from 'express';
import { supabaseAnon } from '../config/supabase';

export const healthCheck = async (_req: Request, res: Response): Promise<void> => {
  let dbStatus: 'reachable' | 'down' = 'down';

  try {
    // Cheap liveness: single-row Supabase ping
    const { error } = await supabaseAnon
      .from('restaurants')
      .select('id')
      .limit(1);

    if (!error) {
      dbStatus = 'reachable';
    }
  } catch {
    // DB unreachable — leave as 'down'
  }

  if (dbStatus === 'down') {
    res.status(503).json({
      ok: false,
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Database unreachable' },
    });
    return;
  }

  res.status(200).json({
    ok: true,
    data: {
      status: 'up' as const,
      time: new Date().toISOString(),
      db: dbStatus,
    },
  });
};
