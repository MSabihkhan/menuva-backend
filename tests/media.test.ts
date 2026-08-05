import request from 'supertest';
import app from '../src/app';
import { seedTenant, seedSession, SeededTenant } from './setup/seed';
import { purgeTenant } from './setup/teardown';
import { supabaseAdmin } from './setup/supabaseAdmin';

describe('Media', () => {
  let t: SeededTenant;
  let dinerToken: string;
  let uploadedImageId: string | null = null;
  const uploadedStoragePaths: string[] = [];

  beforeAll(async () => {
    t = await seedTenant();
    const s = await seedSession(t);
    dinerToken = s.dinerToken;
  });

  afterAll(async () => {
    // Clean up uploaded storage files
    if (uploadedStoragePaths.length > 0) {
      await supabaseAdmin.storage.from('menu-media').remove(uploadedStoragePaths);
    }
    await purgeTenant(t.restaurantId);
  });

  it('POST /api/menu/items/:id/images — editor with valid JPEG → 201', async () => {
    // Create a tiny valid 1x1 JPEG buffer
    const jpegBuffer = Buffer.from(
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=',
      'base64'
    );

    const res = await request(app)
      .post(`/api/menu/items/${t.itemA.id}/images`)
      .set('Authorization', `Bearer ${t.editorToken}`)
      .attach('file', jpegBuffer, { filename: 'test.jpg', contentType: 'image/jpeg' })
      .field('altText', 'A tasty burger')
      .field('isPrimary', 'true');

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('url');
    uploadedImageId = res.body.data.id;

    // Track the storage path for cleanup
    const url = res.body.data.url as string;
    const pathMatch = url.match(/menu-media\/(.+)$/);
    if (pathMatch) uploadedStoragePaths.push(pathMatch[1]);
  });

  it('POST /api/menu/items/:id/images — diner → 403', async () => {
    const jpegBuffer = Buffer.from(
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=',
      'base64'
    );

    const res = await request(app)
      .post(`/api/menu/items/${t.itemA.id}/images`)
      .set('Authorization', `Bearer ${dinerToken}`)
      .attach('file', jpegBuffer, { filename: 'test.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(403);
  });

  it('GET /api/menu/items/:id/images — diner can read → 200', async () => {
    const res = await request(app)
      .get(`/api/menu/items/${t.itemA.id}/images`)
      .set('Authorization', `Bearer ${dinerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('DELETE /api/media/images/:id — owner → 200', async () => {
    if (!uploadedImageId) {
      console.warn('Skipping delete — no uploaded image');
      return;
    }
    const res = await request(app)
      .delete(`/api/media/images/${uploadedImageId}`)
      .set('Authorization', `Bearer ${t.ownerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
