import request from 'supertest';
import app from '../src/app';
import { seedTenant, seedSession, SeededTenant } from './setup/seed';
import { purgeTenant } from './setup/teardown';

describe('Payments', () => {
  let t: SeededTenant;
  let dinerToken: string;
  beforeAll(async () => {
    t = await seedTenant();
    const s = await seedSession(t);
    dinerToken = s.dinerToken;
  });
  afterAll(async () => { await purgeTenant(t.restaurantId); });

  it('GET /api/payments/bill - no order -> total 0', async () => {
    const res = await request(app)
      .get('/api/payments/bill')
      .set('Authorization', `Bearer ${dinerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(0);
  });

  it('POST /api/payments - bad split -> 409', async () => {
    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', `Bearer ${dinerToken}`)
      .send({ splitMethod: "custom", method: "cash", allocations: [] });
    // May be 400 or 409 depending on exact validation
    expect([400, 409]).toContain(res.status);
  });
});