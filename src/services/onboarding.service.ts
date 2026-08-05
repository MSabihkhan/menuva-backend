import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';
import * as onboardingModel from '../models/onboarding.model';

export async function bootstrap(
  db: SupabaseClient<Database>,
  restaurantId: string,
  ownerId: string,
  payload: any
) {
  const params = {
    branchName: payload.branchName || 'Main Branch',
    branchSlug: payload.branchSlug || 'main',
    tableCount: payload.tableCount || 5,
    seedSampleMenu: payload.seedSampleMenu || false,
  };

  return onboardingModel.bootstrapTenant(db, restaurantId, ownerId, params);
}
