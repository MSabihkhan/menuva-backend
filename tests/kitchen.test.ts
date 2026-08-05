import request from 'supertest';
import app from '../src/app';
import { seedTenant, SeededTenant } from './setup/seed';
import { purgeTenant } from './setup/teardown';

describe('Kitchen', () => {
  let t: SeededTenant;
  beforeAll(async () => { t = await seedTenant(); });
  afterAll(async () => { await purgeTenant(t.restaurantId); });

  it('GET /api/kitchen/board - kitchen token', async () => {
    const res = await request(app)
      .get('/api/kitchen/board')
      .set('Authorization', `Bearer ${t.kitchenToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/kitchen/board - editor -> 403', async () => {
    const res = await request(app)
      .get('/api/kitchen/board')
      .set('Authorization', `Bearer ${t.editorToken}`);
    expect(res.status).toBe(403);
  });

  it('POST /api/orders/:id/advance - 404 order not found', async () => {
    const res = await request(app)
      .post('/api/orders/random-id/advance')
      .set('Authorization', `Bearer ${t.kitchenToken}`);
    // Assuming no order seeded yet, should return 404 or validation error on ID
    expect([400, 404]).toContain(res.status);
  });
});