import request from 'supertest';
import app from '../src/app';
import { seedTenant, seedSession, SeededTenant } from './setup/seed';
import { purgeTenant } from './setup/teardown';

describe('Upsell', () => {
  let t: SeededTenant;
  let dinerToken: string;
  beforeAll(async () => {
    t = await seedTenant();
    const s = await seedSession(t);
    dinerToken = s.dinerToken;
  });
  afterAll(async () => { await purgeTenant(t.restaurantId); });

  it('POST /api/upsell/suggestions - after RPC (no crash)', async () => {
    const res = await request(app)
      .post('/api/upsell/suggestions')
      .set('Authorization', `Bearer ${dinerToken}`)
      .send({ cartItemIds: [] });
    // Depending on what endpoint does, it could be 200 or 501
    expect([200, 400, 501]).toContain(res.status);
  });

  it('POST /api/upsell/suggestions - non-diner -> 403', async () => {
    const res = await request(app)
      .post('/api/upsell/suggestions')
      .set('Authorization', `Bearer ${t.ownerToken}`);
    expect(res.status).toBe(403);
  });

  it('POST /api/upsell/events - resilience -> 202', async () => {
    const res = await request(app)
      .post('/api/upsell/events')
      .set('Authorization', `Bearer ${dinerToken}`)
      .send({ eventType: "upsell_shown", payload: { malformed: true } });
    expect(res.status).toBe(202);
  });

  it('PATCH /api/upsell/rules - happy', async () => {
    const res = await request(app)
      .patch('/api/upsell/rules')
      .set('Authorization', `Bearer ${t.ownerToken}`)
      .send({ maxSuggestionsAddCart: 3, minimumLiftBps: 12000 });
    expect(res.status).toBe(200);
  });

  it('PATCH /api/upsell/rules - validation -> 400', async () => {
    const res = await request(app)
      .patch('/api/upsell/rules')
      .set('Authorization', `Bearer ${t.ownerToken}`)
      .send({ maxSuggestionsAddCart: 0, minimumLiftBps: 12000 });
    expect(res.status).toBe(400);
  });

  it('PATCH /api/upsell/rules - editor -> 403', async () => {
    const res = await request(app)
      .patch('/api/upsell/rules')
      .set('Authorization', `Bearer ${t.editorToken}`)
      .send({ maxSuggestionsAddCart: 3, minimumLiftBps: 12000 });
    expect(res.status).toBe(403);
  });
});