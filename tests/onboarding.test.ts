import request from 'supertest';
import app from '../src/app';
import { purgeTenant } from './setup/teardown';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from './setup/supabaseAdmin';
import { mintStaffJwt } from './setup/tokens';

describe('Onboarding Bootstrap', () => {
  let restaurantId: string;
  let ownerToken: string;
  let editorToken: string;

  beforeAll(async () => {
    restaurantId = randomUUID();
    const ownerId = randomUUID();
    
    // Create minimal restaurant for bootstrap testing
    await supabaseAdmin.from('restaurants').insert({
      id: restaurantId,
      name: 'Bootstrap Test',
      slug: `boot-${randomUUID().slice(0, 8)}`,
      currency: 'PKR',
      tax_rate_bps: 0
    });
    
    ownerToken = mintStaffJwt({ userId: ownerId, restaurantId, role: 'owner' });
    editorToken = mintStaffJwt({ restaurantId, role: 'editor', employeeId: randomUUID() });
  });

  afterAll(async () => {
    await purgeTenant(restaurantId);
  });

  it('POST /api/onboarding/bootstrap - editor -> 403', async () => {
    const res = await request(app)
      .post('/api/onboarding/bootstrap')
      .set('Authorization', `Bearer ${editorToken}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('POST /api/onboarding/bootstrap - owner -> 201', async () => {
    const res = await request(app)
      .post('/api/onboarding/bootstrap')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        branchName: 'Downtown',
        branchSlug: 'downtown',
        tableCount: 3,
        seedSampleMenu: true
      });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.branch.name).toBe('Downtown');
    expect(res.body.data.tables.length).toBe(3);
    expect(res.body.data.menuSeeded).toBe(true);
  });

  it('POST /api/onboarding/bootstrap - idempotent -> 201', async () => {
    const res = await request(app)
      .post('/api/onboarding/bootstrap')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    // Should return existing
    expect(res.body.data.branch.name).toBe('Downtown');
    expect(res.body.data.tables.length).toBe(3);
    expect(res.body.data.menuSeeded).toBe(false); // Already seeded, so doesn't seed again
  });
});
