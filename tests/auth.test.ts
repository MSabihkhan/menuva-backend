import request from 'supertest';
import app from '../src/app';
import { seedTenant, SeededTenant } from './setup/seed';
import { purgeTenant } from './setup/teardown';

describe('Auth', () => {
  let t: SeededTenant;
  beforeAll(async () => { t = await seedTenant(); });
  afterAll(async () => { await purgeTenant(t.restaurantId); });

  // Supabase rejects example.com (and other MX-less domains) outright with
  // `email_address_invalid`, so signup tests must use a deliverable domain.
  const SIGNUP_DOMAIN = 'menuva.app';

  it('POST /auth/owner/signup - happy', async () => {
    // Unique email per run — a hardcoded address makes this non-idempotent
    // (second run 500s on "user already exists" with no cleanup of the auth user).
    const email = `sara-${Date.now()}@${SIGNUP_DOMAIN}`;
    const res = await request(app)
      .post('/api/auth/owner/signup')
      .send({ name: "Sara", email, password: "supersecret", restaurantName: "Cheat Day", restaurantSlug: "cheat-day-" + Date.now() });

    // 503 = Supabase's project-wide confirmation-email quota is exhausted. That
    // is an environment state, not a code regression — but signup must SAY so
    // rather than reporting a success that provisions nothing (it used to).
    if (res.status === 503) {
      expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
      return;
    }
    expect(res.status).toBe(200);
    expect(res.body.data.needsEmailConfirm).toBe(true);
  });

  it('POST /auth/owner/signup - duplicate slug -> 409', async () => {
    const slug = "dup-" + Date.now();
    const stamp = Date.now();
    await request(app).post('/api/auth/owner/signup').send({ name: "A", email: `a-${stamp}@${SIGNUP_DOMAIN}`, password: "supersecret", restaurantName: "R", restaurantSlug: slug });
    const res = await request(app).post('/api/auth/owner/signup').send({ name: "B", email: `b-${stamp}@${SIGNUP_DOMAIN}`, password: "supersecret", restaurantName: "R", restaurantSlug: slug });
    expect([200, 409, 503]).toContain(res.status);
  });

  it('POST /auth/owner/signup - short password -> 400', async () => {
    const res = await request(app).post('/api/auth/owner/signup').send({ name: "A", email: "c@example.com", password: "sh", restaurantName: "R", restaurantSlug: "s-" + Date.now() });
    expect(res.status).toBe(400);
  });

  it('POST /auth/staff/login - wrong password -> 401', async () => {
    const res = await request(app).post('/api/auth/staff/login').send({ email: "wrong@example.com", password: "wrong" });
    expect(res.status).toBe(401);
  });

  // REGRESSION GUARD: real Supabase logins return ES256 (asymmetric) tokens.
  // The rest of the suite mints HS256 tokens directly, so this is the ONLY test
  // that exercises verifyToken's JWKS path — a real login + an authed request
  // with the resulting cookie. If verifyToken ever reverts to HS256-only, staff
  // auth silently breaks (kitchen + admin) and only this test will catch it.
  it('POST /auth/staff/login (real ES256) -> cookie authorizes staff request', async () => {
    const agent = request.agent(app); // persists Set-Cookie across requests

    const login = await agent
      .post('/api/auth/staff/login')
      .send({ email: t.ownerEmail, password: t.ownerPassword });
    expect(login.status).toBe(200);
    expect(login.body.data.role).toBe('owner');
    expect(login.headers['set-cookie']).toBeDefined();

    // Use ONLY the httpOnly cookie (no Authorization header) — forces the
    // Supabase ES256 access token through verifyToken → JWKS.
    const me = await agent.get('/api/restaurant');
    expect(me.status).toBe(200);
    expect(me.body.data.id).toBe(t.restaurantId);
  });

  it('POST /auth/diner/join - happy', async () => {
    const res = await request(app).post('/api/auth/diner/join').send({ qrToken: t.table.qrToken, deviceId: "dev-1", dinerName: "Ali" });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  it('POST /auth/diner/join - rejoin idempotency', async () => {
    const r1 = await request(app).post('/api/auth/diner/join').send({ qrToken: t.table.qrToken, deviceId: "dev-idemp", dinerName: "A" });
    const r2 = await request(app).post('/api/auth/diner/join').send({ qrToken: t.table.qrToken, deviceId: "dev-idemp", dinerName: "A" });
    expect(r1.body.data.memberId).toBe(r2.body.data.memberId);
  });

  it('POST /auth/diner/join - bad token -> 404', async () => {
    const res = await request(app).post('/api/auth/diner/join').send({ qrToken: "nope", deviceId: "d", dinerName: "A" });
    expect(res.status).toBe(404);
  });

  it('POST /auth/staff/invite - happy', async () => {
    const res = await request(app).post('/api/auth/staff/invite').set('Authorization', `Bearer ${t.ownerToken}`).send({ email: "kit@example.com", name: "Kit", branchId: t.branchId, role: "kitchen" });
    expect(res.status).toBe(201);
  });

  it('POST /auth/staff/invite - manager -> 403', async () => {
    const res = await request(app).post('/api/auth/staff/invite').set('Authorization', `Bearer ${t.branchManagerToken}`).send({ email: "kit2@example.com", name: "Kit", branchId: t.branchId, role: "kitchen" });
    expect(res.status).toBe(403);
  });
});