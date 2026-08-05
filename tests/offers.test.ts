import request from 'supertest';
import app from '../src/app';
import { seedTenant, SeededTenant } from './setup/seed';
import { purgeTenant } from './setup/teardown';

describe('Offers', () => {
  let t: SeededTenant;
  beforeAll(async () => { t = await seedTenant(); });
  afterAll(async () => { await purgeTenant(t.restaurantId); });

  it('POST /api/offers - happy', async () => {
    const res = await request(app)
      .post('/api/offers')
      .set('Authorization', `Bearer ${t.ownerToken}`)
      .send({ name: "Eid", discountType: "percentage", discountValue: 1000 });
    expect(res.status).toBe(201);
  });

  it('POST /api/offers - bad value -> 400', async () => {
    const res = await request(app)
      .post('/api/offers')
      .set('Authorization', `Bearer ${t.ownerToken}`)
      .send({ name: "Eid", discountType: "percentage", discountValue: -1 });
    expect(res.status).toBe(400);
  });
});