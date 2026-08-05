import request from 'supertest';
import app from '../src/app';
import { seedTenant, SeededTenant } from './setup/seed';
import { purgeTenant } from './setup/teardown';

describe('Analytics', () => {
  let t: SeededTenant;
  beforeAll(async () => { t = await seedTenant(); });
  afterAll(async () => { await purgeTenant(t.restaurantId); });

  it('GET /api/analytics/sales - owner', async () => {
    const res = await request(app)
      .get(`/api/analytics/sales?from=${new Date().toISOString()}&to=${new Date().toISOString()}`)
      .set('Authorization', `Bearer ${t.ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('revenuePerDay');
    expect(res.body.data).toHaveProperty('topItems');
    expect(res.body.data).toHaveProperty('revenueByCategory');
    expect(Array.isArray(res.body.data.topItems)).toBe(true);
    expect(Array.isArray(res.body.data.revenueByCategory)).toBe(true);
  });

  it('GET /api/analytics/sales - kitchen -> 403', async () => {
    const res = await request(app)
      .get(`/api/analytics/sales?from=${new Date().toISOString()}&to=${new Date().toISOString()}`)
      .set('Authorization', `Bearer ${t.kitchenToken}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/analytics/sales - branch_manager', async () => {
    const res = await request(app)
      .get(`/api/analytics/sales?from=${new Date().toISOString()}&to=${new Date().toISOString()}`)
      .set('Authorization', `Bearer ${t.branchManagerToken}`);
    expect(res.status).toBe(200);
  });

  // /menu-performance
  it('GET /api/analytics/menu-performance - owner', async () => {
    const res = await request(app)
      .get('/api/analytics/menu-performance')
      .set('Authorization', `Bearer ${t.ownerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.matrix)).toBe(true);
    expect(typeof res.body.data.conversionLiftBps).toBe('number');
  });

  it('GET /api/analytics/menu-performance - kitchen -> 403', async () => {
    const res = await request(app)
      .get('/api/analytics/menu-performance')
      .set('Authorization', `Bearer ${t.kitchenToken}`);
    expect(res.status).toBe(403);
  });

  // /kitchen-timing
  it('GET /api/analytics/kitchen-timing - owner', async () => {
    const res = await request(app)
      .get('/api/analytics/kitchen-timing')
      .set('Authorization', `Bearer ${t.ownerToken}`);
    if (res.status === 500) {
      console.log('500 ERROR:', res.body);
    }
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('avgDeltas');
    expect(Array.isArray(res.body.data.perItemTimes)).toBe(true);
    expect(Array.isArray(res.body.data.peakHeatmap)).toBe(true);
  });

  it('GET /api/analytics/kitchen-timing - kitchen -> 403', async () => {
    const res = await request(app)
      .get('/api/analytics/kitchen-timing')
      .set('Authorization', `Bearer ${t.kitchenToken}`);
    expect(res.status).toBe(403);
  });

  // /upsell
  it('GET /api/analytics/upsell - owner', async () => {
    const res = await request(app)
      .get('/api/analytics/upsell')
      .set('Authorization', `Bearer ${t.ownerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('acceptanceRateByTrigger');
    expect(typeof res.body.data.ignoreRate).toBe('number');
  });

  it('GET /api/analytics/upsell - kitchen -> 403', async () => {
    const res = await request(app)
      .get('/api/analytics/upsell')
      .set('Authorization', `Bearer ${t.kitchenToken}`);
    expect(res.status).toBe(403);
  });
});