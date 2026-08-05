import request from 'supertest';
import app from '../src/app';

describe('Health', () => {
  it('GET /api/health should return 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('up');
  });
});