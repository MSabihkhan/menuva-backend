import * as dotenv from 'dotenv';
import * as path from 'path';

// MUST run before any app imports to ensure we hit the test/dev DB
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

function die(msg: string) {
  console.error(msg);
  process.exit(1);
}

if (!process.env.SUPABASE_URL || !process.env.TEST_SUPABASE_PROJECT_REF || !process.env.SUPABASE_URL.includes(process.env.TEST_SUPABASE_PROJECT_REF)) {
  die('refusing: SUPABASE_URL is not the test/dev project');
}
if (process.env.PROD_SUPABASE_PROJECT_REF && process.env.PROD_SUPABASE_PROJECT_REF === process.env.TEST_SUPABASE_PROJECT_REF) {
  die('refusing: PROD and TEST supabase project refs are the same');
}

import { supabaseAdmin } from '../tests/setup/supabaseAdmin';
import { randomUUID } from 'crypto';
import { mintDinerJwt, mintStaffJwt } from '../tests/setup/tokens';

async function main() {
  console.log('🚀 Starting Dev Seed...');
  const shortid = randomUUID().slice(0, 6);
  const slug = `demo-${shortid}`;
  
  // 1. Create owner user
  const email = `${slug}@example.com`;
  const password = 'password123';
  const restaurantId = randomUUID();
  
  const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: 'Demo Owner' },
    app_metadata: { restaurant_id: restaurantId, role: 'owner' }
  });
  if (authErr) die('Failed to create auth user: ' + authErr.message);
  const ownerUserId = authUser.user!.id;

  // 2. Create Restaurant
  await supabaseAdmin.from('restaurants').insert({
    id: restaurantId,
    name: `Demo Restaurant ${shortid}`,
    slug,
    currency: 'PKR',
    tax_rate_bps: 1600
  });

  // 3. Owners / Employees
  await supabaseAdmin.from('owners').insert({ id: ownerUserId, restaurant_id: restaurantId, email, name: 'Demo Owner' });
  
  const ownerEmpId = randomUUID();
  await supabaseAdmin.from('employees').insert({
    id: ownerEmpId,
    restaurant_id: restaurantId,
    user_id: ownerUserId,
    email,
    name: 'Demo Owner',
    is_active: true
  });

  // 4. Upsell Rules
  await supabaseAdmin.from('upsell_rules').insert({
    restaurant_id: restaurantId,
    max_suggestions_add_cart: 2,
    minimum_lift_bps: 1000
  });

  // 5. Branch
  const branchId = randomUUID();
  await supabaseAdmin.from('branches').insert({
    id: branchId,
    restaurant_id: restaurantId,
    name: 'Main Branch',
    slug: 'main',
    opens_at: '09:00:00',
    closes_at: '23:00:00',
    is_active: true
  });

  // 6. Tables
  const tableTokens: string[] = [];
  const tableIds: string[] = [];
  const tablesToInsert = Array.from({ length: 5 }).map((_, i) => {
    const id = randomUUID();
    const token = randomUUID();
    tableIds.push(id);
    tableTokens.push(token);
    return {
      id,
      restaurant_id: restaurantId,
      branch_id: branchId,
      code: `T${i + 1}`,
      qr_token: token,
      capacity: 4
    };
  });
  await supabaseAdmin.from('tables').insert(tablesToInsert);

  // 7. Menu
  const catMains = randomUUID();
  const catDrinks = randomUUID();
  await supabaseAdmin.from('menu_categories').insert([
    { id: catMains, restaurant_id: restaurantId, name: 'Mains', sort_order: 1 },
    { id: catDrinks, restaurant_id: restaurantId, name: 'Drinks', sort_order: 2 }
  ]);

  const items = [
    { id: randomUUID(), restaurant_id: restaurantId, category_id: catMains, name: 'Signature Burger', price: 150000 },
    { id: randomUUID(), restaurant_id: restaurantId, category_id: catMains, name: 'Loaded Fries', price: 80000 },
    { id: randomUUID(), restaurant_id: restaurantId, category_id: catMains, name: 'Club Sandwich', price: 120000 },
    { id: randomUUID(), restaurant_id: restaurantId, category_id: catDrinks, name: 'Mint Margarita', price: 60000 },
    { id: randomUUID(), restaurant_id: restaurantId, category_id: catDrinks, name: 'Iced Latte', price: 70000 }
  ];
  await supabaseAdmin.from('menu_items').insert(items);
  await supabaseAdmin.from('branch_menu_items').insert(
    items.map(i => ({ branch_id: branchId, restaurant_id: restaurantId, menu_item_id: i.id, available: true }))
  );

  // Add Modifiers to Burger
  const modGroupId = randomUUID();
  await supabaseAdmin.from('modifier_groups').insert({
    id: modGroupId,
    restaurant_id: restaurantId,
    menu_item_id: items[0].id,
    name: 'Extras',
    is_required: false,
    max_selections: 2
  });
  await supabaseAdmin.from('modifiers').insert([
    { id: randomUUID(), restaurant_id: restaurantId, group_id: modGroupId, name: 'Extra Cheese', price_delta: 20000 },
    { id: randomUUID(), restaurant_id: restaurantId, group_id: modGroupId, name: 'Jalapenos', price_delta: 10000 }
  ]);

  // 8. Session & Diner
  const sessionId = randomUUID();
  await supabaseAdmin.from('table_sessions').insert({
    id: sessionId,
    restaurant_id: restaurantId,
    branch_id: branchId,
    table_id: tableIds[0],
    opened_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
  });

  const memberId = randomUUID();
  await supabaseAdmin.from('session_members').insert({
    id: memberId,
    restaurant_id: restaurantId,
    session_id: sessionId,
    name: 'Dev Diner',
    initials: 'DD',
    device_id: 'dev-device'
  });

  // 9. Tokens
  const dinerToken = mintDinerJwt({ sessionId, memberId, restaurantId, branchId, tableId: tableIds[0] });
  const editorToken = mintStaffJwt({ restaurantId, role: 'editor', employeeId: randomUUID() });
  const kitchenToken = mintStaffJwt({ restaurantId, branchId, role: 'kitchen', employeeId: randomUUID() });

  console.log('\n======================================================');
  console.log('✅ SEED SUCCESS! COPY-PASTE BLOCK BELOW');
  console.log('======================================================\n');
  
  console.log('BASE URL: http://localhost:4000/api');
  console.log('\n--- CREDENTIALS ---');
  console.log(`Owner Login:  ${email}`);
  console.log(`Password:     ${password}`);
  
  console.log('\n--- JWT TOKENS (For HTTP Headers) ---');
  console.log(`Diner Token (Bearer): \n${dinerToken}\n`);
  console.log(`Staff Token - Editor (Bearer): \n${editorToken}\n`);
  console.log(`Staff Token - Kitchen (Bearer): \n${kitchenToken}\n`);
  
  console.log('\n--- TABLE QR TOKENS ---');
  console.log(`T1 (Open session): ${tableTokens[0]}`);
  console.log(`T2: ${tableTokens[1]}`);
  console.log(`T3: ${tableTokens[2]}`);
  
  console.log('\n======================================================\n');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
