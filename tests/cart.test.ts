import request from 'supertest';
import app from '../src/app';
import { seedTenant, seedSession, SeededTenant } from './setup/seed';
import { purgeTenant } from './setup/teardown';

describe('Cart', () => {
  let t: SeededTenant;
  let dinerToken: string;
  beforeAll(async () => {
    t = await seedTenant();
    const s = await seedSession(t);
    dinerToken = s.dinerToken;
  });
  afterAll(async () => { await purgeTenant(t.restaurantId); });

  it('POST /api/cart/items - happy', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${dinerToken}`)
      .send({ menuItemId: t.itemB.id, quantity: 2 });
    expect(res.status).toBe(201);
  });

  it('POST /api/cart/items - missing required modifier -> 409', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${dinerToken}`)
      .send({ menuItemId: t.itemA.id, quantity: 1, modifiers: [] });
    expect(res.status).toBe(409);
  });
});