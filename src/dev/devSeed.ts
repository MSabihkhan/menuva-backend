/**
 * ────────────────────────────────────────────────────────────────────────────
 *  devSeed.ts — DEV-ONLY tenant seeding for the API dashboard
 * ────────────────────────────────────────────────────────────────────────────
 *  Seeds a throwaway restaurant (branch, tables, menu, modifiers, an open table
 *  session) and mints a token for every identity, so the dashboard at /dev can
 *  call the real API without anyone copy-pasting UUIDs or JWTs.
 *
 *  This module is imported ONLY from dev.routes.ts, which app.ts mounts only
 *  when NODE_ENV !== 'production'. It uses supabaseAdmin (service role), so it
 *  must never be reachable in prod.
 * ────────────────────────────────────────────────────────────────────────────
 */

import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import { env } from '../config/env';

export interface DevMenuItem {
  id: string;
  name: string;
  price: number;
  categoryId: string;
}

export interface DevContext {
  seededAt: string;
  restaurantId: string;
  branchId: string;
  owner: { email: string; password: string; userId: string; employeeId: string };
  kitchenLogin: { email: string; password: string };
  tokens: {
    diner: string;
    owner: string;
    branch_manager: string;
    manager: string;
    kitchen: string;
    editor: string;
  };
  serviceRoleKey: string;
  session: { sessionId: string; memberId: string; tableId: string };
  tables: Array<{ id: string; code: string; qrToken: string }>;
  categories: Array<{ id: string; name: string }>;
  menuItems: DevMenuItem[];
  modifierGroup: { id: string; name: string; modifiers: Array<{ id: string; name: string }> } | null;
}

let cached: DevContext | null = null;

export function getCachedContext(): DevContext | null {
  return cached;
}

function mintStaff(claims: {
  userId?: string;
  restaurantId: string;
  role: string;
  branchId?: string;
  employeeId?: string;
}): string {
  return jwt.sign(
    {
      aud: 'authenticated',
      iss: 'supabase',
      sub: claims.userId || randomUUID(),
      role: 'authenticated',
      app_metadata: {
        restaurant_id: claims.restaurantId,
        role: claims.role,
        branch_id: claims.branchId,
        employee_id: claims.employeeId,
      },
      exp: Math.floor((Date.now() + 8 * 60 * 60 * 1000) / 1000),
    },
    env.SUPABASE_JWT_SECRET,
  );
}

function mintDiner(claims: {
  sessionId: string;
  memberId: string;
  restaurantId: string;
  branchId: string;
  tableId: string;
}): string {
  return jwt.sign(
    {
      aud: 'authenticated',
      iss: 'supabase',
      role: 'authenticated',
      is_diner: true,
      sub: claims.memberId,
      session_id: claims.sessionId,
      member_id: claims.memberId,
      restaurant_id: claims.restaurantId,
      branch_id: claims.branchId,
      table_id: claims.tableId,
      exp: Math.floor((Date.now() + 8 * 60 * 60 * 1000) / 1000),
    },
    env.SUPABASE_JWT_SECRET,
  );
}

export async function seedDevTenant(): Promise<DevContext> {
  const shortid = randomUUID().slice(0, 6);
  const slug = `dev-${shortid}`;
  const email = `${slug}@example.com`;
  const password = 'password123';
  const restaurantId = randomUUID();

  // 1. Owner auth user (real, so POST /auth/staff/login works against it)
  const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: 'Dev Owner' },
    app_metadata: { restaurant_id: restaurantId, role: 'owner' },
  });
  if (authErr) throw new Error(`createUser failed: ${authErr.message}`);
  const ownerUserId = authUser.user!.id;

  // 2. Restaurant
  const { error: rErr } = await supabaseAdmin.from('restaurants').insert({
    id: restaurantId,
    name: `Dev Restaurant ${shortid}`,
    slug,
    currency: 'PKR',
    tax_rate_bps: 1600,
  });
  if (rErr) throw new Error(`restaurants insert failed: ${rErr.message}`);

  // 3. Owner + employee rows
  await supabaseAdmin.from('owners').insert({
    id: ownerUserId,
    user_id: ownerUserId,
    restaurant_id: restaurantId,
    email,
    name: 'Dev Owner',
  });

  const ownerEmpId = randomUUID();
  await supabaseAdmin.from('employees').insert({
    id: ownerEmpId,
    restaurant_id: restaurantId,
    user_id: ownerUserId,
    email,
    name: 'Dev Owner',
    is_active: true,
  });

  // 4. Upsell rules
  await supabaseAdmin.from('upsell_rules').insert({
    restaurant_id: restaurantId,
    max_suggestions_add_cart: 2,
    minimum_lift_bps: 1000,
  });

  // 5. Branch
  const branchId = randomUUID();
  const { error: bErr } = await supabaseAdmin.from('branches').insert({
    id: branchId,
    restaurant_id: restaurantId,
    name: 'Main Branch',
    // NOTE: branches.slug has a GLOBAL unique constraint (not per-restaurant),
    // so this must be unique across every tenant, not just within this one.
    slug: `main-${shortid}`,
    opens_at: '09:00:00',
    closes_at: '23:00:00',
    is_active: true,
  });
  if (bErr) throw new Error(`branches insert failed: ${bErr.message}`);

  // 5b. Kitchen staff auth user — a real password-based login scoped to this
  // branch, so the Kitchen Display can be signed into and its realtime channel
  // (kitchen:<branchId>) exercised. (The minted kitchen JWT below is header-only.)
  const kitchenEmail = `kitchen-${shortid}@example.com`;
  const kitchenPassword = 'password123';
  const { data: kitchenAuth, error: kErr } = await supabaseAdmin.auth.admin.createUser({
    email: kitchenEmail,
    password: kitchenPassword,
    email_confirm: true,
    user_metadata: { name: 'Dev Kitchen' },
    app_metadata: { restaurant_id: restaurantId, role: 'kitchen', branch_id: branchId },
  });
  if (kErr) throw new Error(`kitchen createUser failed: ${kErr.message}`);
  const kitchenUserId = kitchenAuth.user!.id;
  // Role + branch live on the auth user's app_metadata (set above); the
  // employees table is just a directory row.
  await supabaseAdmin.from('employees').insert({
    id: randomUUID(),
    restaurant_id: restaurantId,
    user_id: kitchenUserId,
    email: kitchenEmail,
    name: 'Dev Kitchen',
    is_active: true,
  });

  // 6. Tables
  const tables = Array.from({ length: 5 }).map((_, i) => ({
    id: randomUUID(),
    code: `T${i + 1}`,
    qrToken: randomUUID(),
  }));
  await supabaseAdmin.from('tables').insert(
    tables.map((t) => ({
      id: t.id,
      restaurant_id: restaurantId,
      branch_id: branchId,
      code: t.code,
      qr_token: t.qrToken,
      capacity: 4,
    })),
  );

  // 7. Menu
  const catMains = randomUUID();
  const catDrinks = randomUUID();
  await supabaseAdmin.from('menu_categories').insert([
    { id: catMains, restaurant_id: restaurantId, name: 'Mains', sort_order: 1 },
    { id: catDrinks, restaurant_id: restaurantId, name: 'Drinks', sort_order: 2 },
  ]);

  const rawItems = [
    { id: randomUUID(), category_id: catMains, name: 'Signature Burger', price: 150000, cost_price: 60000 },
    { id: randomUUID(), category_id: catMains, name: 'Loaded Fries', price: 80000, cost_price: 30000 },
    { id: randomUUID(), category_id: catMains, name: 'Club Sandwich', price: 120000, cost_price: 50000 },
    { id: randomUUID(), category_id: catDrinks, name: 'Mint Margarita', price: 60000, cost_price: 20000 },
    { id: randomUUID(), category_id: catDrinks, name: 'Iced Latte', price: 70000, cost_price: 25000 },
  ];
  await supabaseAdmin
    .from('menu_items')
    .insert(rawItems.map((i) => ({ ...i, restaurant_id: restaurantId })));

  await supabaseAdmin.from('branch_menu_items').insert(
    rawItems.map((i) => ({
      branch_id: branchId,
      restaurant_id: restaurantId,
      menu_item_id: i.id,
      available: true,
    })),
  );

  // 8. Modifier group on the burger
  const modGroupId = randomUUID();
  await supabaseAdmin.from('modifier_groups').insert({
    id: modGroupId,
    restaurant_id: restaurantId,
    menu_item_id: rawItems[0].id,
    name: 'Extras',
    is_required: false,
    max_selections: 2,
  });
  const modifiers = [
    { id: randomUUID(), name: 'Extra Cheese', price_delta: 20000 },
    { id: randomUUID(), name: 'Jalapenos', price_delta: 10000 },
  ];
  await supabaseAdmin.from('modifiers').insert(
    modifiers.map((m) => ({ ...m, restaurant_id: restaurantId, group_id: modGroupId })),
  );

  // 9. Open table session + diner member on T1
  const sessionId = randomUUID();
  await supabaseAdmin.from('table_sessions').insert({
    id: sessionId,
    restaurant_id: restaurantId,
    branch_id: branchId,
    table_id: tables[0].id,
    opened_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  });

  const memberId = randomUUID();
  await supabaseAdmin.from('session_members').insert({
    id: memberId,
    restaurant_id: restaurantId,
    session_id: sessionId,
    name: 'Dev Diner',
    initials: 'DD',
    device_id: 'dev-dashboard',
  });

  const ctx: DevContext = {
    seededAt: new Date().toISOString(),
    restaurantId,
    branchId,
    owner: { email, password, userId: ownerUserId, employeeId: ownerEmpId },
    kitchenLogin: { email: kitchenEmail, password: kitchenPassword },
    tokens: {
      diner: mintDiner({ sessionId, memberId, restaurantId, branchId, tableId: tables[0].id }),
      owner: mintStaff({ userId: ownerUserId, restaurantId, role: 'owner', employeeId: ownerEmpId }),
      branch_manager: mintStaff({ restaurantId, role: 'branch_manager', branchId, employeeId: randomUUID() }),
      manager: mintStaff({ restaurantId, role: 'manager', branchId, employeeId: randomUUID() }),
      kitchen: mintStaff({ restaurantId, role: 'kitchen', branchId, employeeId: randomUUID() }),
      editor: mintStaff({ restaurantId, role: 'editor', employeeId: randomUUID() }),
    },
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    session: { sessionId, memberId, tableId: tables[0].id },
    tables,
    categories: [
      { id: catMains, name: 'Mains' },
      { id: catDrinks, name: 'Drinks' },
    ],
    menuItems: rawItems.map((i) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      categoryId: i.category_id,
    })),
    modifierGroup: {
      id: modGroupId,
      name: 'Extras',
      modifiers: modifiers.map((m) => ({ id: m.id, name: m.name })),
    },
  };

  cached = ctx;
  return ctx;
}
