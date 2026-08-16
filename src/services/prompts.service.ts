import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import * as promptModel from '../models/prompts.model';
import { AppError } from '../utils/AppError';
import { broadcastToSession } from '../utils/realtime';
import { invalidateSession } from '../middleware/authenticate';

type Db = SupabaseClient<Database>;

/**
 * How long the table has to answer before silence counts as agreement. Long
 * enough that someone glancing away doesn't get steamrolled, short enough that
 * one person who put their phone down can't hold the kitchen up.
 */
const TTL_SECONDS: Record<string, number> = {
  place_order: 60,
  split_method: 60,
  end_session: 60,
};

export const promptsService = {
  async open(
    db: Db,
    sessionId: string,
    memberId: string,
    kind: 'place_order' | 'split_method' | 'end_session',
    payload: Record<string, unknown>,
  ) {
    const opened = await promptModel.openPrompt(
      db, sessionId, memberId, kind, payload, TTL_SECONDS[kind] ?? 60,
    );
    const prompt = await promptModel.getPrompt(db, opened.promptId);

    // Everyone else needs to see the question immediately — a vote nobody knows
    // about just runs down its clock and auto-approves.
    await broadcastToSession(sessionId, 'prompt_opened', {
      promptId: opened.promptId,
      kind: prompt?.kind ?? kind,
      initiatedBy: memberId,
    });

    return prompt;
  },

  async respond(db: Db, sessionId: string, promptId: string, memberId: string, response: string) {
    const prompt = await promptModel.respondPrompt(db, promptId, memberId, response);

    await broadcastToSession(sessionId, 'prompt_updated', {
      promptId,
      kind: prompt.kind,
      complete: prompt.complete,
    });

    return prompt;
  },

  async active(db: Db, sessionId: string) {
    return await promptModel.getActivePrompt(db, sessionId);
  },

  async get(db: Db, promptId: string) {
    const prompt = await promptModel.getPrompt(db, promptId);
    if (!prompt) throw new AppError(404, 'NOT_FOUND', 'Prompt not found');
    return prompt;
  },

  async cancel(db: Db, sessionId: string, promptId: string) {
    await promptModel.closePrompt(db, promptId, 'cancelled');
    await broadcastToSession(sessionId, 'prompt_resolved', { promptId, status: 'cancelled' });
  },

  async resolve(db: Db, sessionId: string, promptId: string) {
    await promptModel.closePrompt(db, promptId, 'resolved');
    await broadcastToSession(sessionId, 'prompt_resolved', { promptId, status: 'resolved' });
  },

  /**
   * Close the table for everyone. Broadcast first so devices leave the session
   * screens on their own rather than discovering it via a failed request.
   */
  async endSession(db: Db, sessionId: string) {
    const result = await promptModel.endSession(db, sessionId);
    // Only tell the table it is over if it actually is. Broadcasting a close
    // that the database refused would eject everyone from a live session.
    if (result.closed) {
      // Drop the cached "still open" row before anyone can use it.
      invalidateSession(sessionId);
      broadcastToSession(sessionId, 'session_ended', { sessionId });
    }
    return result;
  },

  async closeState(db: Db, sessionId: string) {
    return await promptModel.getCloseState(db, sessionId);
  },
};
