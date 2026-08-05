import request from 'supertest';
import app from '../src/app';
import { seedTenant, seedSession, SeededTenant } from './setup/seed';
import { purgeTenant } from './setup/teardown';

describe('Reviews', () => {
  let t: SeededTenant;
  let dinerToken: string;
  beforeAll(async () => {
    t = await seedTenant();
    const s = await seedSession(t);
    dinerToken = s.dinerToken;
  });
  afterAll(async () => { await purgeTenant(t.restaurantId); });

  it('POST /api/reviews - happy', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${dinerToken}`)
      .send({ rating: 5, comment: "great" });
    expect(res.status).toBe(201);
  });

  it('POST /api/reviews - bad rating -> 400', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${dinerToken}`)
      .send({ rating: 6 });
    expect(res.status).toBe(400);
  });
});