import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';
import * as reviewsModel from '../models/reviews.model';
import { AppError } from '../utils/AppError';

type Db = SupabaseClient<Database>;

export async function submitReview(
  db: Db,
  restaurantId: string,
  branchId: string,
  sessionId: string,
  rating: number,
  comment?: string
) {
  const orderId = await reviewsModel.getLatestOrderForSession(db, sessionId);

  const reviewInsert = {
    restaurant_id: restaurantId,
    branch_id: branchId,
    session_id: sessionId,
    order_id: orderId,
    rating,
    comment: comment || null,
  };

  return await reviewsModel.createReview(db, reviewInsert);
}

export async function getReviews(
  db: Db,
  userRole: string,
  userBranchId?: string,
  filters?: {
    branchId?: string;
    rating?: number;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  let targetBranchId = filters?.branchId;

  // Branch-scoped staff are restricted to their branch
  if (userRole !== 'owner') {
    if (targetBranchId && targetBranchId !== userBranchId) {
      throw new AppError(403, 'INSUFFICIENT_ROLE', 'Cannot view reviews for other branches');
    }
    targetBranchId = userBranchId;
  }

  return await reviewsModel.listReviews(db, {
    branchId: targetBranchId,
    rating: filters?.rating,
    dateFrom: filters?.dateFrom,
    dateTo: filters?.dateTo,
  });
}
