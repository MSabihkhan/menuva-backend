import { supabaseAdmin } from './supabaseAdmin';

export async function purgeTenant(restaurantId: string) {
  // First, get all owners for this restaurant to delete their auth accounts
  const { data: owners } = await supabaseAdmin
    .from('owners')
    .select('id')
    .eq('restaurant_id', restaurantId);

  // We need to fetch email to delete them? Supabase admin auth delete uses auth.users.id
  if (owners && owners.length > 0) {
    for (const owner of owners) {
      await supabaseAdmin.auth.admin.deleteUser(owner.id);
    }
  }

  // Hard delete restaurant -> cascades to everything else
  const { error } = await supabaseAdmin
    .from('restaurants')
    .delete()
    .eq('id', restaurantId);

  if (error) {
    console.error('Failed to purge tenant:', error.message);
  }
}
