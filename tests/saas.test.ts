import request from 'supertest';
import app from '../src/app';
import { seedTenant, SeededTenant } from './setup/seed';
import { purgeTenant } from './setup/teardown';

describe('SaaS', () => {
  let t: SeededTenant;
  beforeAll(async () => { t = await seedTenant(); });
  afterAll(async () => { await purgeTenant(t.restaurantId); });

  it('GET /api/saas/tenants - owner -> 401', async () => {
    const res = await request(app)
      .get('/api/saas/tenants')
      .set('Authorization', `Bearer ${t.ownerToken}`);
    expect(res.status).toBe(401);
  });

  it('GET /api/saas/analytics - platform admin -> 200', async () => {
    const res = await request(app)
      .get('/api/saas/analytics')
      .set('Authorization', `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`);
    
    expect(res.status).toBe(200);
    expect(res.body.data.analytics).toHaveProperty('totalGmv');
    expect(res.body.data.analytics).toHaveProperty('activeClients');
    expect(res.body.data.analytics).toHaveProperty('churnAlerts');
  });
});