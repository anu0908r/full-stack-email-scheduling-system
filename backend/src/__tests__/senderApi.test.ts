import request from 'supertest';
import app from '../server';
import { prisma } from '../db/prisma';

describe('Sender Management API Tests', () => {
  let authToken = '';

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/dev-login')
      .send({ email: 'sender.test@reachinbox.ai', name: 'Sender Tester' });
    authToken = res.body.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('GET /api/senders returns senders list (auto-provisions default)', async () => {
    const res = await request(app)
      .get('/api/senders')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.senders)).toBe(true);
    expect(res.body.senders.length).toBeGreaterThan(0);
  });

  it('POST /api/senders creates a new sender', async () => {
    const res = await request(app)
      .post('/api/senders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        email: `new.sender.${Date.now()}@reachinbox.ai`,
        displayName: 'Test New Sender',
        hourlyLimit: 100,
      });

    expect(res.status).toBe(201);
    expect(res.body.sender).toBeDefined();
    expect(res.body.sender.displayName).toBe('Test New Sender');
    expect(res.body.sender.hourlyLimit).toBe(100);
  });

  it('POST /api/senders rejects invalid email', async () => {
    const res = await request(app)
      .post('/api/senders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        email: 'not-an-email',
        displayName: 'Bad Email Sender',
      });

    expect(res.status).toBe(400);
  });

  it('POST /api/senders rejects missing displayName', async () => {
    const res = await request(app)
      .post('/api/senders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        email: 'valid@test.com',
        displayName: '',
      });

    expect(res.status).toBe(400);
  });

  it('DELETE /api/senders/:id deletes a sender with no active emails', async () => {
    // Create a sender to delete
    const createRes = await request(app)
      .post('/api/senders')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        email: `delete.me.${Date.now()}@reachinbox.ai`,
        displayName: 'To Delete',
      });

    const senderId = createRes.body.sender.id;

    const deleteRes = await request(app)
      .delete(`/api/senders/${senderId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(deleteRes.status).toBe(200);

    // Verify it's gone
    const sender = await prisma.sender.findUnique({ where: { id: senderId } });
    expect(sender).toBeNull();
  });

  it('DELETE /api/senders/:id returns 404 for non-existent sender', async () => {
    const res = await request(app)
      .delete('/api/senders/non-existent-id')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(404);
  });
});
