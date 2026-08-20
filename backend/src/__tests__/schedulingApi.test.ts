import request from 'supertest';
import app from '../server';
import { prisma } from '../db/prisma';

describe('Email Scheduling API Tests', () => {
  let authToken = '';
  let senderId = '';

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/dev-login')
      .send({ email: 'sched.test@reachinbox.ai', name: 'Scheduling Tester' });
    authToken = res.body.token;

    const sendersRes = await request(app)
      .get('/api/senders')
      .set('Authorization', `Bearer ${authToken}`);
    senderId = sendersRes.body.senders[0].id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should schedule a single email successfully', async () => {
    const res = await request(app)
      .post('/api/emails/schedule')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        senderId,
        subject: 'Single Email Test',
        body: 'Test body content',
        recipients: ['single.test@example.com'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.recipientCount).toBe(1);
    expect(res.body.data.scheduledEmails).toBe(1);
    expect(res.body.data.invalidCount).toBe(0);
  });

  it('should schedule multiple emails and deduplicate', async () => {
    const res = await request(app)
      .post('/api/emails/schedule')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        senderId,
        subject: 'Multi Email Test',
        body: 'Test body',
        recipients: ['a@test.com', 'b@test.com', 'a@test.com', 'c@test.com'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.recipientCount).toBe(3); // deduplicated
    expect(res.body.data.scheduledEmails).toBe(3);
  });

  it('should reject schedule with no recipients', async () => {
    const res = await request(app)
      .post('/api/emails/schedule')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        senderId,
        subject: 'No Recipients',
        body: 'Body',
        recipients: [],
      });

    expect(res.status).toBe(400);
  });

  it('should reject schedule with invalid recipients only', async () => {
    const res = await request(app)
      .post('/api/emails/schedule')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        senderId,
        subject: 'Invalid Only',
        body: 'Body',
        recipients: ['not-an-email', 'also-bad'],
      });

    expect(res.status).toBe(400);
  });

  it('should reject schedule with missing subject', async () => {
    const res = await request(app)
      .post('/api/emails/schedule')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        senderId,
        subject: '',
        body: 'Body',
        recipients: ['test@example.com'],
      });

    expect(res.status).toBe(400);
  });

  it('should reject schedule with missing senderId', async () => {
    const res = await request(app)
      .post('/api/emails/schedule')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        senderId: '',
        subject: 'Test',
        body: 'Body',
        recipients: ['test@example.com'],
      });

    expect(res.status).toBe(400);
  });

  it('should reject schedule with non-existent sender', async () => {
    const res = await request(app)
      .post('/api/emails/schedule')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        senderId: 'non-existent-sender-id',
        subject: 'Test',
        body: 'Body',
        recipients: ['test@example.com'],
      });

    expect(res.status).toBe(400);
  });

  it('should handle future scheduled time', async () => {
    const futureTime = new Date(Date.now() + 600000).toISOString();
    const res = await request(app)
      .post('/api/emails/schedule')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        senderId,
        subject: 'Future Schedule Test',
        body: 'Body',
        recipients: ['future.test@example.com'],
        startTime: futureTime,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.scheduledEmails).toBe(1);
  });

  it('GET /api/emails/scheduled should return user emails only', async () => {
    const res = await request(app)
      .get('/api/emails/scheduled')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.emails)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  it('GET /api/emails/sent should return user emails only', async () => {
    const res = await request(app)
      .get('/api/emails/sent')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.emails)).toBe(true);
  });

  it('should return mixed valid/invalid recipients with correct counts', async () => {
    const res = await request(app)
      .post('/api/emails/schedule')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        senderId,
        subject: 'Mixed Recipients Test',
        body: 'Body',
        recipients: ['valid@test.com', 'invalid-email', 'also-valid@test.com', 'bad@'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.recipientCount).toBe(2);
    expect(res.body.data.invalidCount).toBe(2);
  });
});
