import request from 'supertest';
import app from '../server';
import { prisma } from '../db/prisma';

describe('Idempotency & Duplicate Prevention Tests', () => {
  let authToken = '';
  let senderId = '';

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/dev-login')
      .send({ email: 'idempotent.test@reachinbox.ai', name: 'Idempotency Tester' });
    authToken = res.body.token;

    const sendersRes = await request(app)
      .get('/api/senders')
      .set('Authorization', `Bearer ${authToken}`);
    senderId = sendersRes.body.senders[0].id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should handle duplicate API requests — creates separate campaigns but deduplicates recipients within each', async () => {
    const payload = {
      senderId,
      subject: 'Idempotency Test',
      body: 'Body',
      recipients: ['idem@test.com', 'idem@test.com'],
    };

    const res1 = await request(app)
      .post('/api/emails/schedule')
      .set('Authorization', `Bearer ${authToken}`)
      .send(payload);

    const res2 = await request(app)
      .post('/api/emails/schedule')
      .set('Authorization', `Bearer ${authToken}`)
      .send(payload);

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);

    // Each campaign has 1 unique recipient (deduplicated within batch)
    expect(res1.body.data.recipientCount).toBe(1);
    expect(res2.body.data.recipientCount).toBe(1);
  });

  it('should create unique idempotency keys per email', async () => {
    const res = await request(app)
      .post('/api/emails/schedule')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        senderId,
        subject: 'Unique Key Test',
        body: 'Body',
        recipients: ['unique@test.com'],
      });

    expect(res.status).toBe(201);

    // Verify the email has a unique idempotency key in DB
    const emails = await prisma.email.findMany({
      where: { recipient: 'unique@test.com' },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    expect(emails.length).toBe(1);
    expect(emails[0].idempotencyKey).toBeDefined();
    expect(emails[0].idempotencyKey.length).toBe(64); // SHA-256 hex
  });

  it('user isolation: different users cannot see each other emails', async () => {
    // User A schedules
    await request(app)
      .post('/api/emails/schedule')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        senderId,
        subject: 'User A Private',
        body: 'Private',
        recipients: ['usera.private@test.com'],
      });

    // User B logs in
    const userBRes = await request(app)
      .post('/api/auth/dev-login')
      .send({ email: 'isolation.b@reachinbox.ai', name: 'User B' });
    const userBToken = userBRes.body.token;

    // User B should NOT see User A's emails
    const res = await request(app)
      .get('/api/emails/scheduled')
      .set('Authorization', `Bearer ${userBToken}`);

    const userAEmails = res.body.emails.filter(
      (e: any) => e.recipient === 'usera.private@test.com'
    );
    expect(userAEmails.length).toBe(0);
  });
});
