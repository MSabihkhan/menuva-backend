import { supabaseAdmin } from './supabaseAdmin';
import { mintStaffJwt, mintDinerJwt } from './tokens';
import { randomUUID } from 'crypto';

export type SeededTenant = {
  restaurantId: string;
  branchId: string;
  ownerUserId: string;
  ownerEmployeeId: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerToken: string;
  editorToken: string;
  kitchenToken: string;
  branchManagerToken: string;
  categoryId: string;
  itemA: { id: string; price: number };
  itemB: { id: string; price: number };
  table: { id: string; qrToken: string; code: string };
};

export async function seedTenant(): Promise<SeededTenant> {
  const restaurantId = randomUUID();
  const branchId = randomUUID();
  const slug = `test-${randomUUID().slice(0, 8)}`;
  const qrToken = randomUUID();
  
  // 1. Create a user for owner (auth.users)
  const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email: `${slug}@example.com`,
    password: 'password123',
    email_confirm: true,
    user_metadata: { name: 'Test Owner' },
    app_metadata: { restaurant_id: restaurantId, role: 'owner' }
  });
  if (authErr) throw new Error('Failed to create auth user: ' + authErr.message);

  const realOwnerUserId = authUser.user.id;

  // 2. Insert restaurant
  const { error: rErr } = await supabaseAdmin.from('restaurants').insert({
    id: restaurantId,
    name: 'Test Restaurant',
    slug,
    currency: 'IDR',
    tax_rate_bps: 1100,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  if (rErr) throw new Error('Failed to insert restaurant: ' + rErr.message);

  // 3. Insert branch
  const { error: bErr } = await supabaseAdmin.from('branches').insert({
    id: branchId,
    restaurant_id: restaurantId,
    name: 'Main Branch',
    slug: `main-${slug}`,
    opens_at: '09:00:00',
    closes_at: '22:00:00',
    is_active: true
  });
  if (bErr) throw new Error('Failed to insert branch: ' + bErr.message);

  // 4. Insert staff / roles (owners table, memberships, employees)
  await supabaseAdmin.from('owners').insert({ id: realOwnerUserId, restaurant_id: restaurantId, email: authUser.user.email, name: 'Test Owner' });

  const ownerEmployeeId = randomUUID();
  await supabaseAdmin.from('employees').insert({
    id: ownerEmployeeId,
    restaurant_id: restaurantId,
    user_id: realOwnerUserId,
    email: authUser.user.email,
    name: 'Test Owner Employee',
    is_active: true
  });
  await supabaseAdmin.from('memberships').insert({
    employee_id: ownerEmployeeId,
    restaurant_id: restaurantId,
    branch_id: branchId,
    role: 'owner'
  });

  // tokens
  const ownerToken = mintStaffJwt({ userId: realOwnerUserId, restaurantId, role: 'owner' });
  const editorToken = mintStaffJwt({ restaurantId, role: 'editor', employeeId: randomUUID() });
  const kitchenToken = mintStaffJwt({ restaurantId, role: 'kitchen', branchId, employeeId: randomUUID() });
  const branchManagerToken = mintStaffJwt({ restaurantId, role: 'branch_manager', branchId, employeeId: randomUUID() });

  // 5. Seed Menu Category
  const categoryId = randomUUID();
  await supabaseAdmin.from('menu_categories').insert({
    id: categoryId,
    restaurant_id: restaurantId,
    name: 'Mains',
    sort_order: 1
  });

  // 6. Seed Items
  const itemA = { id: randomUUID(), price: 25000 };
  const itemB = { id: randomUUID(), price: 15000 };
  const { error: miErr } = await supabaseAdmin.from('menu_items').insert([
    { id: itemA.id, restaurant_id: restaurantId, category_id: categoryId, name: 'Burger', description: 'desc', price: itemA.price, is_active: true },
    { id: itemB.id, restaurant_id: restaurantId, category_id: categoryId, name: 'Fries', description: 'desc', price: itemB.price, is_active: true }
  ]);
  if (miErr) throw new Error('Failed to insert menu items: ' + miErr.message);

  const { error: bmiErr } = await supabaseAdmin.from('branch_menu_items').insert([
    { branch_id: branchId, restaurant_id: restaurantId, menu_item_id: itemA.id, available: true },
    { branch_id: branchId, restaurant_id: restaurantId, menu_item_id: itemB.id, available: true }
  ]);
  if (bmiErr) throw new Error('Failed to insert branch menu items: ' + bmiErr.message);

  // 7. Seed variant group for itemA
  const variantGroupId = randomUUID();
  const { error: mgErr } = await supabaseAdmin.from('modifier_groups').insert({
    id: variantGroupId,
    restaurant_id: restaurantId,
    menu_item_id: itemA.id,
    name: 'Size',
    is_required: true,
    max_selections: 1
  });
  if (mgErr) throw new Error('Failed to insert modifier_groups: ' + mgErr.message);

  const { error: mErr } = await supabaseAdmin.from('modifiers').insert([
    { id: randomUUID(), restaurant_id: restaurantId, group_id: variantGroupId, name: 'Small', price_delta: 0 },
    { id: randomUUID(), restaurant_id: restaurantId, group_id: variantGroupId, name: 'Large', price_delta: 5000 }
  ]);
  if (mErr) throw new Error('Failed to insert modifiers: ' + mErr.message);

  // 8. Seed Table
  const tableId = randomUUID();
  const { error: tblErr } = await supabaseAdmin.from('tables').insert({
    id: tableId,
    restaurant_id: restaurantId,
    branch_id: branchId,
    code: 'T1',
    qr_token: qrToken,
    capacity: 4
  });
  if (tblErr) throw new Error('Failed to insert table: ' + tblErr.message);

  // 9. Seed Upsell rules
  const { error: rulesErr } = await supabaseAdmin.from('upsell_rules').insert({
    restaurant_id: restaurantId,
    max_suggestions_add_cart: 2,
    minimum_lift_bps: 1000
  });
  if (rulesErr) console.error('Failed to insert upsell rules:', rulesErr.message);

  return {
    restaurantId,
    branchId,
    ownerUserId: realOwnerUserId,
    ownerEmployeeId,
    ownerEmail: `${slug}@example.com`,
    ownerPassword: 'password123',
    ownerToken,
    editorToken,
    kitchenToken,
    branchManagerToken,
    categoryId,
    itemA,
    itemB,
    table: { id: tableId, qrToken, code: 'T1' }
  };
}

export async function seedSession(tenant: SeededTenant) {
  const sessionId = randomUUID();
  const { error: tsErr } = await supabaseAdmin.from('table_sessions').insert({
    id: sessionId,
    restaurant_id: tenant.restaurantId,
    branch_id: tenant.branchId,
    table_id: tenant.table.id,
    opened_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
  });
  if (tsErr) throw new Error('Failed to insert table_sessions: ' + tsErr.message);
  
  const memberId = randomUUID();
  const { error: smErr } = await supabaseAdmin.from('session_members').insert({
    id: memberId,
    session_id: sessionId,
    restaurant_id: tenant.restaurantId,
    name: 'Test Diner',
    initials: 'TD',
    device_id: 'dev-1',
    joined_at: new Date().toISOString()
  });
  if (smErr) throw new Error('Failed to insert session_members: ' + smErr.message);

  const dinerToken = mintDinerJwt({
    sessionId,
    memberId,
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    tableId: tenant.table.id
  });

  return { sessionId, memberId, dinerToken };
}

export async function seedMenu() {}
export async function seedTable() {}
