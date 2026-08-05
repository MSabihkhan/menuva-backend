import request from 'supertest';
import app from '../src/app';
import { seedTenant, seedSession, SeededTenant } from './setup/seed';
import { purgeTenant } from './setup/teardown';
import { randomUUID as v4 } from 'crypto';
import { supabaseAdmin } from './setup/supabaseAdmin';

describe('Orders', () => {
  let t: SeededTenant;
  let dinerToken: string;
  beforeAll(async () => {
    t = await seedTenant();
    const s = await seedSession(t);
    dinerToken = s.dinerToken;
  });
  afterAll(async () => { await purgeTenant(t.restaurantId); });

  async function addCartItem() {
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${dinerToken}`)
      .send({ menuItemId: t.itemB.id, quantity: 1 });
  }

  it('POST /api/orders/place - empty cart -> 409', async () => {
    const res = await request(app)
      .post('/api/orders/place')
      .set('Authorization', `Bearer ${dinerToken}`)
      .send({ idempotencyKey: v4() });
    expect(res.status).toBe(409);
  });

  it('POST /api/orders/place - idempotency replay', async () => {
    await addCartItem();
    const idemKey = v4();

    const res1 = await request(app)
      .post('/api/orders/place')
      .set('Authorization', `Bearer ${dinerToken}`)
      .send({ idempotencyKey: idemKey });
    expect(res1.status).toBe(201);
    const orderId = res1.body.data.order.id;

    const res2 = await request(app)
      .post('/api/orders/place')
      .set('Authorization', `Bearer ${dinerToken}`)
      .send({ idempotencyKey: idemKey });
    expect(res2.status).toBe(200);
    expect(res2.body.data.order.id).toBe(orderId);
  });

  it('POST /api/orders/place - 5-min round merge', async () => {
    await addCartItem();
    const idemKey = v4();

    const res = await request(app)
      .post('/api/orders/place')
      .set('Authorization', `Bearer ${dinerToken}`)
      .send({ idempotencyKey: idemKey });

    expect(res.status).toBe(200);
    expect(res.body.data.merged).toBe(true);
  });

  it('POST /api/orders/place - new round', async () => {
    const { data: orders } = await supabaseAdmin.from('orders').select('id').eq('restaurant_id', t.restaurantId);
    if (orders) {
      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      for (const o of orders) {
        await supabaseAdmin.from('orders').update({ placed_at: tenMinsAgo }).eq('id', o.id);
      }
    }

    await addCartItem();
    const idemKey = v4();

    const res = await request(app)
      .post('/api/orders/place')
      .set('Authorization', `Bearer ${dinerToken}`)
      .send({ idempotencyKey: idemKey });

    expect(res.status).toBe(201);
    expect(res.body.data.merged).toBe(false);
  });
});
