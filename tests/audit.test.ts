import request from 'supertest';
import app from '../src/app';
import { seedTenant, SeededTenant } from './setup/seed';
import { purgeTenant } from './setup/teardown';

describe('Audit Log', () => {
  let t: SeededTenant;
  beforeAll(async () => { t = await seedTenant(); });
  afterAll(async () => { await purgeTenant(t.restaurantId); });

  it('GET /api/audit-log — owner → 200 + array', async () => {
    const res = await request(app)
      .get('/api/audit-log')
      .set('Authorization', `Bearer ${t.ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /api/audit-log — kitchen → 403', async () => {
    const res = await request(app)
      .get('/api/audit-log')
      .set('Authorization', `Bearer ${t.kitchenToken}`);

    expect(res.status).toBe(403);
  });

  it('GET /api/audit-log?entityType=menu_item — filtered → 200', async () => {
    const res = await request(app)
      .get('/api/audit-log?entityType=menu_item')
      .set('Authorization', `Bearer ${t.ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
