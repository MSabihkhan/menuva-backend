import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';
import { AppError } from '../utils/AppError';
import { randomUUID } from 'crypto';

export async function bootstrapTenant(
  db: SupabaseClient<Database>,
  restaurantId: string,
  ownerId: string,
  params: {
    branchName: string;
    branchSlug: string;
    tableCount: number;
    seedSampleMenu: boolean;
  }
) {
  // 1. Check if a *live* branch already exists. Must exclude soft-deleted rows —
  // otherwise re-onboarding after a branch deletion would reuse the dead branch
  // (leaving deleted_at set), and it would stay invisible everywhere that filters
  // on deleted_at (GET /branches, the console). A deleted branch means "start fresh".
  const { data: existingBranches, error: bErr } = await db
    .from('branches')
    .select('id, name')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .limit(1);

  if (bErr) throw new AppError(500, 'INTERNAL_ERROR', bErr.message);

  let branchId: string;
  let branchName: string;

  if (existingBranches && existingBranches.length > 0) {
    branchId = existingBranches[0].id;
    branchName = existingBranches[0].name;
  } else {
    // Create default branch. `branches.slug` is GLOBALLY unique, so the common
    // onboarding default ("main") collides once a second tenant onboards. Retry
    // with a short random suffix on a unique-violation so first-run never fails.
    branchId = randomUUID();
    branchName = params.branchName;
    let slug = params.branchSlug;
    let inserted = false;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      const { error: insertBErr } = await db.from('branches').insert({
        id: branchId,
        restaurant_id: restaurantId,
        name: branchName,
        slug,
        opens_at: '09:00:00',
        closes_at: '23:00:00',
        is_active: true
      });
      if (!insertBErr) {
        inserted = true;
      } else if (insertBErr.code === '23505') {
        // slug taken — append a short suffix and try again
        slug = `${params.branchSlug}-${randomUUID().slice(0, 6)}`;
      } else {
        throw new AppError(500, 'INTERNAL_ERROR', insertBErr.message);
      }
    }
    if (!inserted) throw new AppError(409, 'CONFLICT', 'Could not allocate a unique branch slug');
  }

  // 2. Fetch existing tables to avoid duplicating codes if idempotent
  const { data: existingTables, error: tErr } = await db
    .from('tables')
    .select('id, code, qr_token')
    .eq('branch_id', branchId);
  if (tErr) throw new AppError(500, 'INTERNAL_ERROR', tErr.message);

  const tables = [...(existingTables || [])];

  if (tables.length === 0) {
    // Create tables
    const newTables = Array.from({ length: params.tableCount }).map((_, i) => ({
      id: randomUUID(),
      restaurant_id: restaurantId,
      branch_id: branchId,
      code: `T${i + 1}`,
      qr_token: randomUUID(),
      capacity: 4,
      is_active: true
    }));
    
    if (newTables.length > 0) {
      const { error: insertTErr } = await db.from('tables').insert(newTables);
      if (insertTErr) throw new AppError(500, 'INTERNAL_ERROR', insertTErr.message);
      tables.push(...newTables);
    }
  }

  // 3. Seed Sample Menu
  let menuSeeded = false;
  if (params.seedSampleMenu) {
    const { data: existingCats } = await db.from('menu_categories').select('id').eq('restaurant_id', restaurantId).limit(1);
    if (!existingCats || existingCats.length === 0) {
      const catId1 = randomUUID();
      const catId2 = randomUUID();
      await db.from('menu_categories').insert([
        { id: catId1, restaurant_id: restaurantId, name: 'Mains', sort_order: 1 },
        { id: catId2, restaurant_id: restaurantId, name: 'Drinks', sort_order: 2 }
      ]);

      const items = [
        { id: randomUUID(), restaurant_id: restaurantId, category_id: catId1, name: 'Classic Burger', price: 150000, sort_order: 1 },
        { id: randomUUID(), restaurant_id: restaurantId, category_id: catId1, name: 'Margherita Pizza', price: 200000, sort_order: 2 },
        { id: randomUUID(), restaurant_id: restaurantId, category_id: catId2, name: 'Iced Latte', price: 50000, sort_order: 1 },
        { id: randomUUID(), restaurant_id: restaurantId, category_id: catId2, name: 'Lemonade', price: 30000, sort_order: 2 }
      ];
      await db.from('menu_items').insert(items);
      
      const branchItems = items.map(item => ({
        id: randomUUID(),
        restaurant_id: restaurantId,
        branch_id: branchId,
        menu_item_id: item.id,
        available: true
      }));
      await db.from('branch_menu_items').insert(branchItems);
      
      menuSeeded = true;
    }
  }

  // 4. Upsert onboard_restaurants status
  const { data: existingOnboard } = await db.from('onboard_restaurants').select('id').eq('restaurant_id', restaurantId).limit(1);
  if (existingOnboard && existingOnboard.length > 0) {
    await db.from('onboard_restaurants').update({ status: 'active' }).eq('id', existingOnboard[0].id);
  } else {
    await db.from('onboard_restaurants').insert({
      id: randomUUID(),
      restaurant_id: restaurantId,
      onboarded_by: ownerId,
      status: 'active'
    });
  }

  return {
    branch: { id: branchId, name: branchName },
    tables: tables.map(t => ({ id: t.id, code: t.code, qrToken: t.qr_token })),
    menuSeeded
  };
}
