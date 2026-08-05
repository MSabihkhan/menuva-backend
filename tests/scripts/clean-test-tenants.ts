import { supabaseAdmin } from '../setup/supabaseAdmin';
import { purgeTenant } from '../setup/teardown';

async function main() {
  console.log('Cleaning test tenants...');
  const { data: restaurants, error } = await supabaseAdmin
    .from('restaurants')
    .select('id, slug')
    .like('slug', 'test-%');

  if (error) {
    console.error('Failed to list test restaurants:', error.message);
    process.exit(1);
  }

  if (!restaurants || restaurants.length === 0) {
    console.log('No test tenants found to clean.');
    process.exit(0);
  }

  console.log(`Found ${restaurants.length} test tenants. Purging...`);
  for (const r of restaurants) {
    console.log(`Purging ${r.slug}...`);
    await purgeTenant(r.id);
  }
  console.log('Done.');
}

main().catch(console.error);
