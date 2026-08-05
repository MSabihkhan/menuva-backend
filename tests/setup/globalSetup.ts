import './env';
import { supabaseAdmin } from './supabaseAdmin';

export default async function globalSetup() {
  console.log('Validating remote Supabase connection...');
  // Assert a known table exists. If it fails, migrations are probably missing.
  const { error } = await supabaseAdmin.from('restaurants').select('id').limit(1);
  if (error && error.code === '42P01') {
    throw new Error('Restaurants table not found. Apply migrations to the test project first.');
  }

  // Populate materialized views so analytics endpoints don't return 500s due to unpopulated state
  const { error: refreshErr } = await supabaseAdmin.rpc('refresh_all_analytics');
  if (refreshErr) {
    console.error('Failed to populate materialized views:', refreshErr.message);
  }
}
