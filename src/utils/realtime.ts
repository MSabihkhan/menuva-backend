import { supabaseAdmin } from '../config/supabase';
import { logger } from './logger';

/**
 * Broadcasts are notifications, not part of the operation that triggered them.
 *
 * These used to be awaited inside request handlers, which put a measured ~360ms
 * of realtime round trip on the critical path of every cart change, order and
 * payment — the diner sat waiting for a message they were not even the
 * recipient of. They are now dispatched in the background: the HTTP response
 * goes out immediately and the broadcast lands a moment later, which is the
 * order the recipients experience anyway.
 *
 * Nothing depends on delivery. A dropped broadcast degrades to the polling that
 * every screen already does as a safety net.
 */
function dispatch(channelName: string, event: string, payload: Record<string, unknown>) {
  void (async () => {
    try {
      const channel = supabaseAdmin.channel(channelName);
      await channel.send({ type: 'broadcast', event, payload });
      await supabaseAdmin.removeChannel(channel);
    } catch (err) {
      logger.warn({ err, channelName, event }, 'Realtime broadcast failed (non-fatal)');
    }
  })();
}

export function broadcastToSession(
  sessionId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  dispatch(`session:${sessionId}`, event, payload);
}

export function broadcastToKitchen(
  branchId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  dispatch(`kitchen:${branchId}`, event, payload);
}
