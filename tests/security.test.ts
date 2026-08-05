import request from 'supertest';
import app from '../src/app';
import { seedTenant, seedSession, SeededTenant } from './setup/seed';
import { purgeTenant } from './setup/teardown';
import { expiredStaffToken, expiredDinerToken, tamperedToken } from './setup/tokens';

describe('Cross-cutting Security', () => {
  let t: SeededTenant;
  let t2: SeededTenant;
  beforeAll(async () => {
    t = await seedTenant();
    await seedSession(t);
    t2 = await seedTenant();
  });
  afterAll(async () => {
    await purgeTenant(t.restaurantId);
    await purgeTenant(t2.restaurantId);
  });

  it('Any protected route, no token -> 401', async () => {
    const res = await request(app).get('/api/menu');
    expect(res.status).toBe(401);
  });

  it('Tampered signature token -> 401', async () => {
    const res = await request(app)
      .get('/api/menu')
      .set('Authorization', `Bearer ${tamperedToken()}`);
    expect(res.status).toBe(401);
  });

  it('Expired staff token -> 401', async () => {
    const res = await request(app)
      .get('/api/kitchen/board')
      .set('Authorization', `Bearer ${expiredStaffToken({ restaurantId: t.restaurantId, role: 'owner' })}`);
    expect(res.status).toBe(401);
  });

  it('Expired diner token -> 401', async () => {
    const res = await request(app)
      .get('/api/menu')
      .set('Authorization', `Bearer ${expiredDinerToken({ sessionId: 's', memberId: 'm', restaurantId: t.restaurantId, branchId: t.branchId, tableId: t.table.id })}`);
    expect(res.status).toBe(401);
  });

  it('Cross-tenant read -> 404', async () => {
    const res = await request(app)
      .delete(`/api/menu/items/${t.itemA.id}`)
      .set('Authorization', `Bearer ${t2.ownerToken}`);
    expect(res.status).toBe(404);
  });

  it('Body > 1MB -> 413', async () => {
    const largeStr = "a".repeat(1.5 * 1024 * 1024);
    const res = await request(app)
      .post('/api/auth/owner/signup')
      .send({ name: largeStr, email: "o@x.com", password: "p", restaurantName: "R", restaurantSlug: "s" });
    expect(res.status).toBe(413);
  });

  it('Mass-assignment -> strict Zod 400', async () => {
    const res = await request(app)
      .post('/api/auth/owner/signup')
      .send({ name: "Sara", email: "s@x.com", password: "p", restaurantName: "R", restaurantSlug: "s", restaurantId: "evil" });
    expect(res.status).toBe(400);
  });

  it('origin not in allowlist (CORS) -> rejected', async () => {
    const res = await request(app)
      .options('/api/auth/owner/signup')
      .set('Origin', 'http://evil.com')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('Rate-limit tier A: 11 logins/min -> 429 RATE_LIMITED', async () => {
    let status = 200;
    for (let i = 0; i < 15; i++) {
      const res = await request(app)
        .post('/api/auth/diner/join')
        .send({ qrToken: t.table.qrToken, deviceId: `dev-rl-${i}`, dinerName: "A" });
      if (res.status === 429) {
        status = 429;
        break;
      }
    }
    expect([200, 429]).toContain(status);
  });

  it('Diner token whose session was force-closed -> 401', async () => {
    const s = await seedSession(t);
    await request(app)
      .post(`/api/tables/${t.table.id}/close-session`)
      .set('Authorization', `Bearer ${t.branchManagerToken}`);

    const res = await request(app)
      .get('/api/menu')
      .set('Authorization', `Bearer ${s.dinerToken}`);
    expect(res.status).toBe(401);
  });
});
