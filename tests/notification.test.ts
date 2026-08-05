import request from 'supertest';
import app from '../src/app';
import { seedTenant, SeededTenant } from './setup/seed';
import { purgeTenant } from './setup/teardown';

describe('Notification Log', () => {
  let t: SeededTenant;
  beforeAll(async () => { t = await seedTenant(); });
  afterAll(async () => { await purgeTenant(t.restaurantId); });

  it('GET /api/notifications — owner → 200 + array', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${t.ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/notifications — kitchen → 403', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${t.kitchenToken}`);

    expect(res.status).toBe(403);
  });

  it('GET /api/notifications?channel=push — filtered → 200', async () => {
    const res = await request(app)
      .get('/api/notifications?channel=push')
      .set('Authorization', `Bearer ${t.ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
