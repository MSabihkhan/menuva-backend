import request from 'supertest';
import app from '../src/app';
import { seedTenant, seedSession, SeededTenant } from './setup/seed';
import { purgeTenant } from './setup/teardown';
import { expiredDinerToken } from './setup/tokens';

describe('Menu', () => {
  let t: SeededTenant;
  let dinerToken: string;
  beforeAll(async () => {
    t = await seedTenant();
    const s = await seedSession(t);
    dinerToken = s.dinerToken;
  });
  afterAll(async () => { await purgeTenant(t.restaurantId); });

  it('GET /api/menu - happy', async () => {
    const res = await request(app)
      .get('/api/menu')
      .set('Authorization', `Bearer ${dinerToken}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/menu - no token -> 401', async () => {
    const res = await request(app).get('/api/menu');
    expect(res.status).toBe(401);
  });

  it('GET /api/menu - expired -> 401', async () => {
    const res = await request(app)
      .get('/api/menu')
      .set('Authorization', `Bearer ${expiredDinerToken()}`);
    expect(res.status).toBe(401);
  });

  it('POST /api/menu/items - editor happy', async () => {
    const res = await request(app)
      .post('/api/menu/items')
      .set('Authorization', `Bearer ${t.editorToken}`)
      .send({ categoryId: t.categoryId, name: "Fries 2", price: 25000 });
    expect(res.status).toBe(201);
  });

  it('POST /api/menu/items - diner -> 403', async () => {
    const res = await request(app)
      .post('/api/menu/items')
      .set('Authorization', `Bearer ${dinerToken}`)
      .send({ categoryId: t.categoryId, name: "Fries", price: 25000 });
    expect(res.status).toBe(403);
  });

  it('POST /api/menu/items - negative price -> 400', async () => {
    const res = await request(app)
      .post('/api/menu/items')
      .set('Authorization', `Bearer ${t.editorToken}`)
      .send({ categoryId: t.categoryId, name: "Fries", price: -5 });
    expect(res.status).toBe(400);
  });

  it('PATCH /api/menu/items/:id/price - owner', async () => {
    const res = await request(app)
      .patch(`/api/menu/items/${t.itemB.id}/price`)
      .set('Authorization', `Bearer ${t.ownerToken}`)
      .send({ price: 30000 });
    expect(res.status).toBe(202);
  });

  it('DELETE /api/menu/items/:id - owner', async () => {
    const res = await request(app)
      .delete(`/api/menu/items/${t.itemA.id}`)
      .set('Authorization', `Bearer ${t.ownerToken}`);
    expect(res.status).toBe(200);
  });
});