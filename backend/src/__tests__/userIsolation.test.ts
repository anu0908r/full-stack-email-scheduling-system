import request from 'supertest';
import app from '../server';
import { prisma } from '../db/prisma';

describe('User Isolation Security Integration Tests', () => {
  let userAToken = '';
  let userBToken = '';
  let senderId = '';

  beforeAll(async () => {
    await prisma.email.deleteMany();
    await prisma.campaign.deleteMany();

    // 1. Dev Login User A
    const resA = await request(app)
      .post('/api/auth/dev-login')
      .send({ email: 'usera.unique@reachinbox.ai', name: 'User A' });
    userAToken = resA.body.token;

    // 2. Dev Login User B
    const resB = await request(app)
      .post('/api/auth/dev-login')
      .send({ email: 'userb.unique@reachinbox.ai', name: 'User B' });
    userBToken = resB.body.token;

    // Fetch sender
    const sendersRes = await request(app)
      .get('/api/senders')
      .set('Authorization', `Bearer ${userAToken}`);
    senderId = sendersRes.body.senders[0].id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('User A schedules future campaign; User B must NOT see User A emails', async () => {
    const futureTime = new Date(Date.now() + 600000).toISOString();
    const recipientEmail = `usera.isolation.${Date.now()}@example.com`;

    // User A schedules email
    const scheduleRes = await request(app)
      .post('/api/emails/schedule')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        senderId,
        subject: 'Confidential User A Email',
        body: 'Private Content',
        recipients: [recipientEmail],
        startTime: futureTime,
      });

    expect(scheduleRes.status).toBe(201);

    const allCampaigns = await prisma.campaign.findMany();
    const allEmails = await prisma.email.findMany({ include: { campaign: true } });
    console.log('[DEBUG DB] All Campaigns:', allCampaigns);
    console.log('[DEBUG DB] All Emails:', allEmails.map((e) => ({ id: e.id, recipient: e.recipient, campaignUserId: e.campaign.userId })));

    // User A checks scheduled emails -> sees email
    const resUserA = await request(app)
      .get('/api/emails/scheduled')
      .set('Authorization', `Bearer ${userAToken}`);

    console.log('[DEBUG API] resUserA:', resUserA.body.emails.map((e: any) => ({ recipient: e.recipient, campaignUserId: e.campaign?.userId })));

    // User B checks scheduled emails -> must NOT see User A email!
    const resUserB = await request(app)
      .get('/api/emails/scheduled')
      .set('Authorization', `Bearer ${userBToken}`);

    console.log('[DEBUG API] resUserB:', resUserB.body.emails.map((e: any) => ({ recipient: e.recipient, campaignUserId: e.campaign?.userId })));

    const userBEmails = resUserB.body.emails.filter((e: any) => e.recipient === recipientEmail.toLowerCase());
    expect(userBEmails.length).toBe(0);
  });
});
