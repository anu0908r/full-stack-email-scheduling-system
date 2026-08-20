import { RecoveryService } from '../services/recoveryService';
import { prisma } from '../db/prisma';
import { emailQueue, addEmailToQueue } from '../queues/emailQueue';

describe('RecoveryService Tests', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should reset stuck PROCESSING emails to SCHEDULED', async () => {
    // Create a test user, sender, campaign, and email stuck in PROCESSING
    const user = await prisma.user.upsert({
      where: { email: 'recovery.test@reachinbox.ai' },
      update: {},
      create: { googleId: 'recovery-test-user', email: 'recovery.test@reachinbox.ai', name: 'Recovery Tester' },
    });

    let sender = await prisma.sender.findFirst();
    if (!sender) {
      sender = await prisma.sender.create({
        data: { email: 'recovery.sender@reachinbox.ai', displayName: 'Recovery Sender', hourlyLimit: 100 },
      });
    }

    const campaign = await prisma.campaign.create({
      data: {
        userId: user.id,
        subject: 'Recovery Test',
        body: 'Body',
        startTime: new Date(),
        delayBetweenEmailsMs: 2000,
        hourlyLimit: 100,
        status: 'SCHEDULED',
      },
    });

    const email = await prisma.email.create({
      data: {
        campaignId: campaign.id,
        senderId: sender.id,
        recipient: 'recovery.lead@test.com',
        subject: 'Recovery Test',
        body: 'Body',
        scheduledAt: new Date(Date.now() + 3600000),
        status: 'PROCESSING',
        idempotencyKey: `recovery-test-${Date.now()}`,
      },
    });

    // Run reconciliation
    const result = await RecoveryService.reconcileScheduledJobs();

    expect(result.resetProcessing).toBeGreaterThanOrEqual(1);

    // Verify email was reset
    const updatedEmail = await prisma.email.findUnique({ where: { id: email.id } });
    expect(updatedEmail?.status).toBe('SCHEDULED');

    // Cleanup
    await prisma.email.delete({ where: { id: email.id } });
    await prisma.campaign.delete({ where: { id: campaign.id } });
  });

  it('should re-enqueue SCHEDULED emails missing BullMQ jobs', async () => {
    const user = await prisma.user.upsert({
      where: { email: 'recovery.test@reachinbox.ai' },
      update: {},
      create: { googleId: 'recovery-test-user', email: 'recovery.test@reachinbox.ai', name: 'Recovery Tester' },
    });

    let sender = await prisma.sender.findFirst();
    if (!sender) {
      sender = await prisma.sender.create({
        data: { email: 'recovery.sender@reachinbox.ai', displayName: 'Recovery Sender', hourlyLimit: 100 },
      });
    }

    const campaign = await prisma.campaign.create({
      data: {
        userId: user.id,
        subject: 'Requeue Test',
        body: 'Body',
        startTime: new Date(),
        delayBetweenEmailsMs: 2000,
        hourlyLimit: 100,
        status: 'SCHEDULED',
      },
    });

    const email = await prisma.email.create({
      data: {
        campaignId: campaign.id,
        senderId: sender.id,
        recipient: 'requeue.lead@test.com',
        subject: 'Requeue Test',
        body: 'Body',
        scheduledAt: new Date(Date.now() + 3600000),
        status: 'SCHEDULED',
        idempotencyKey: `requeue-test-${Date.now()}`,
        bullJobId: null, // No BullMQ job
      },
    });

    const result = await RecoveryService.reconcileScheduledJobs();

    // Should have requeued at least this email
    expect(result.requeuedJobs).toBeGreaterThanOrEqual(1);

    // Verify bullJobId was set
    const updatedEmail = await prisma.email.findUnique({ where: { id: email.id } });
    expect(updatedEmail?.bullJobId).toBeDefined();

    // Cleanup
    if (updatedEmail?.bullJobId) {
      const job = await emailQueue.getJob(updatedEmail.bullJobId);
      if (job) await job.remove();
    }
    await prisma.email.delete({ where: { id: email.id } });
    await prisma.campaign.delete({ where: { id: campaign.id } });
  });

  it('should not duplicate SENT emails', async () => {
    const user = await prisma.user.upsert({
      where: { email: 'recovery.test@reachinbox.ai' },
      update: {},
      create: { googleId: 'recovery-test-user', email: 'recovery.test@reachinbox.ai', name: 'Recovery Tester' },
    });

    let sender = await prisma.sender.findFirst();
    if (!sender) {
      sender = await prisma.sender.create({
        data: { email: 'recovery.sender@reachinbox.ai', displayName: 'Recovery Sender', hourlyLimit: 100 },
      });
    }

    const campaign = await prisma.campaign.create({
      data: {
        userId: user.id,
        subject: 'Sent No Dup Test',
        body: 'Body',
        startTime: new Date(),
        delayBetweenEmailsMs: 2000,
        hourlyLimit: 100,
        status: 'COMPLETED',
      },
    });

    const email = await prisma.email.create({
      data: {
        campaignId: campaign.id,
        senderId: sender.id,
        recipient: 'sent.nodup@test.com',
        subject: 'Sent No Dup',
        body: 'Body',
        scheduledAt: new Date(Date.now() - 3600000),
        status: 'SENT',
        sentAt: new Date(),
        idempotencyKey: `sent-nodup-${Date.now()}`,
      },
    });

    // Run reconciliation — SENT emails should NOT be requeued
    const result = await RecoveryService.reconcileScheduledJobs();

    // The email should still be SENT
    const updatedEmail = await prisma.email.findUnique({ where: { id: email.id } });
    expect(updatedEmail?.status).toBe('SENT');
    expect(updatedEmail?.bullJobId).toBeNull();

    // Cleanup
    await prisma.email.delete({ where: { id: email.id } });
    await prisma.campaign.delete({ where: { id: campaign.id } });
  });

  it('recovery should be idempotent — running twice produces same result', async () => {
    const result1 = await RecoveryService.reconcileScheduledJobs();
    const result2 = await RecoveryService.reconcileScheduledJobs();

    // Second run should have 0 new resets and 0 new requeues
    expect(result2.resetProcessing).toBe(0);
    expect(result2.requeuedJobs).toBe(0);
  });
});
