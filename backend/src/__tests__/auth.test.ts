import request from 'supertest';
import app from '../server';
import { prisma } from '../db/prisma';

describe('Authentication & Authorization Tests', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('GET /api/health should return ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('unauthenticated request to protected endpoint returns 401', async () => {
    const res = await request(app).get('/api/emails/scheduled');
    expect(res.status).toBe(401);
  });

  it('invalid token returns 401', async () => {
    const res = await request(app)
      .get('/api/emails/scheduled')
      .set('Authorization', 'Bearer invalid-token-123');
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/dev-login creates user and returns token', async () => {
    const res = await request(app)
      .post('/api/auth/dev-login')
      .send({ email: 'auth.test@reachinbox.ai', name: 'Auth Tester' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('auth.test@reachinbox.ai');
    expect(res.body.user.name).toBe('Auth Tester');
  });

  it('GET /api/auth/me returns user with valid token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/dev-login')
      .send({ email: 'me.test@reachinbox.ai', name: 'Me Tester' });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me.test@reachinbox.ai');
  });

  it('POST /api/auth/logout returns success', async () => {
    const loginRes = await request(app)
      .post('/api/auth/dev-login')
      .send({ email: 'logout.test@reachinbox.ai', name: 'Logout Tester' });

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    expect(res.status).toBe(200);
  });
});
