import request from 'supertest';
import app from '../server';
import { prisma } from '../db/prisma';

describe('Full-Stack Email Scheduling API Integration Tests', () => {
  let authToken = '';
  let senderId = '';

  beforeAll(async () => {
    // 1. Dev Login to obtain token
    const res = await request(app)
      .post('/api/auth/dev-login')
      .send({ email: 'test.engineer@reachinbox.ai', name: 'Test Engineer' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    authToken = res.body.token;

    // 2. Fetch or create sender
    const sendersRes = await request(app)
      .get('/api/senders')
      .set('Authorization', `Bearer ${authToken}`);

    expect(sendersRes.status).toBe(200);
    expect(sendersRes.body.senders.length).toBeGreaterThan(0);
    senderId = sendersRes.body.senders[0].id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('GET /api/health should return ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /api/emails/schedule should schedule emails successfully', async () => {
    const res = await request(app)
      .post('/api/emails/schedule')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        senderId,
        subject: 'Integration Test Campaign',
        body: 'Hello World from ReachInbox integration test',
        recipients: ['lead1@example.com', 'lead2@example.com', 'invalid-lead'],
        delayBetweenEmailsMs: 1000,
        hourlyLimit: 10,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.recipientCount).toBe(2);
    expect(res.body.data.invalidCount).toBe(1);
    expect(res.body.data.scheduledEmails).toBe(2);
  });

  it('GET /api/emails/scheduled should return scheduled list', async () => {
    const res = await request(app)
      .get('/api/emails/scheduled')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.emails)).toBe(true);
  });
});
