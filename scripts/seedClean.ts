import * as dotenv from 'dotenv';
import * as path from 'path';

// MUST run before any app imports to ensure we hit the test DB
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

function die(msg: string) {
  console.error(msg);
  process.exit(1);
}

if (!process.env.SUPABASE_URL || !process.env.TEST_SUPABASE_PROJECT_REF || !process.env.SUPABASE_URL.includes(process.env.TEST_SUPABASE_PROJECT_REF)) {
  die('refusing: SUPABASE_URL is not the test project');
}
if (process.env.PROD_SUPABASE_PROJECT_REF && process.env.PROD_SUPABASE_PROJECT_REF === process.env.TEST_SUPABASE_PROJECT_REF) {
  die('refusing: PROD and TEST supabase project refs are the same');
}

import { supabaseAdmin } from '../tests/setup/supabaseAdmin';

async function main() {
  console.log('🧹 Cleaning Demo Tenants...');
  const { data: restaurants, error: rErr } = await supabaseAdmin
    .from('restaurants')
    .select('id, name')
    .like('slug', 'demo-%');

  if (rErr) die('Failed to fetch demo restaurants: ' + rErr.message);

  if (!restaurants || restaurants.length === 0) {
    console.log('No demo restaurants found.');
    process.exit(0);
  }

  console.log(`Found ${restaurants.length} demo restaurants to delete.`);

  for (const r of restaurants) {
    // Delete owners' auth accounts
    const { data: owners } = await supabaseAdmin
      .from('owners')
      .select('id')
      .eq('restaurant_id', r.id);

    if (owners) {
      for (const owner of owners) {
        await supabaseAdmin.auth.admin.deleteUser(owner.id);
      }
    }

    // Hard delete restaurant (cascades)
    await supabaseAdmin.from('restaurants').delete().eq('id', r.id);
    console.log(`Deleted: ${r.name}`);
  }

  console.log('✅ Cleanup complete.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
