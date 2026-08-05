import { supabaseAdmin } from '../config/supabase';
import { logger } from './logger';

export async function broadcastToSession(
  sessionId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  try {
    const channel = supabaseAdmin.channel(`session:${sessionId}`);
    await channel.send({
      type: 'broadcast',
      event,
      payload,
    });
    supabaseAdmin.removeChannel(channel);
  } catch (err) {
    logger.warn({ err, sessionId, event }, 'Realtime broadcast failed (non-fatal)');
  }
}

export async function broadcastToKitchen(
  branchId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  try {
    const channel = supabaseAdmin.channel(`kitchen:${branchId}`);
    await channel.send({
      type: 'broadcast',
      event,
      payload,
    });
    supabaseAdmin.removeChannel(channel);
  } catch (err) {
    logger.warn({ err, branchId, event }, 'Realtime broadcast failed (non-fatal)');
  }
}
