import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import { AppError } from '../utils/AppError';

type Db = SupabaseClient<Database>;

export interface TablePrompt {
  id: string;
  kind: 'place_order' | 'split_method' | 'end_session';
  status: 'pending' | 'resolved' | 'cancelled';
  payload: Record<string, unknown>;
  initiatedBy: string;
  expiresAt: string;
  expired: boolean;
  memberCount: number;
  answeredCount: number;
  responses: { memberId: string; name: string; initials: string; response: string | null }[];
  /** Server-computed: everyone answered (or it expired) and nobody said wait. */
  complete: boolean;
}

export async function openPrompt(
  db: Db,
  sessionId: string,
  memberId: string,
  kind: string,
  payload: Record<string, unknown>,
  ttlSeconds: number,
) {
  const { data, error } = await db.rpc('open_table_prompt', {
    p_session_id: sessionId,
    p_member_id: memberId,
    p_kind: kind,
    p_payload: payload as never,
    p_ttl_seconds: ttlSeconds,
  });
  if (error) {
    if (error.code === 'P0001') throw new AppError(410, 'SESSION_EXPIRED', 'This table session has ended');
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to open prompt', error);
  }
  return data as unknown as { promptId: string; kind: string; alreadyOpen: boolean };
}

export async function respondPrompt(db: Db, promptId: string, memberId: string, response: string) {
  const { data, error } = await db.rpc('respond_table_prompt', {
    p_prompt_id: promptId,
    p_member_id: memberId,
    p_response: response,
  });
  if (error) {
    if (error.code === 'P0002') throw new AppError(409, 'CONFLICT', 'That prompt is no longer open');
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to record response', error);
  }
  return data as unknown as TablePrompt;
}

export async function getActivePrompt(db: Db, sessionId: string) {
  const { data, error } = await db.rpc('get_active_table_prompt', { p_session_id: sessionId });
  if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to read prompt', error);
  return (data as unknown as TablePrompt | null) ?? null;
}

export async function getPrompt(db: Db, promptId: string) {
  const { data, error } = await db.rpc('get_table_prompt', { p_prompt_id: promptId });
  if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to read prompt', error);
  return (data as unknown as TablePrompt | null) ?? null;
}

export async function closePrompt(db: Db, promptId: string, status: 'resolved' | 'cancelled') {
  const { error } = await db.rpc('close_table_prompt', { p_prompt_id: promptId, p_status: status });
  if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to close prompt', error);
}

export async function endSession(db: Db, sessionId: string) {
  const { data, error } = await db.rpc('end_diner_session', { p_session_id: sessionId });
  if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to end session', error);
  return data as unknown as { sessionId: string; closedAt: string };
}
