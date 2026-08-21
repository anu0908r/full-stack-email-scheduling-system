import { Worker, Job } from 'bullmq';
import { redisWorker } from '../db/redis';
import { EMAIL_QUEUE_NAME, EmailJobData, addEmailToQueue } from '../queues/emailQueue';
import { prisma } from '../db/prisma';
import { sendEmailViaSMTP } from '../services/smtpService';
import { RateLimiterService } from '../services/rateLimiterService';
import { config } from '../config';

export const createEmailWorker = () => {
  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const { emailId } = job.data;
      console.log(`[Worker] Processing job ${job.id} for emailId: ${emailId}`);

      // 1. Fetch persistent Email record from Database
      const email = await prisma.email.findUnique({
        where: { id: emailId },
        include: { sender: true, campaign: true },
      });

      if (!email) {
        console.warn(`[Worker] Email record ${emailId} not found in database. Skipping.`);
        return;
      }

      // 2. Idempotency Guard: Never resend an already sent email
      if (email.status === 'SENT') {
        console.log(`[Worker] Email ${emailId} is already marked as SENT. Skipping duplicate execution.`);
        return;
      }

      // 2b. Crash recovery guard: if email has etherealMessageId, it was sent but status wasn't updated
      if (email.etherealMessageId) {
        console.log(`[Worker] Email ${emailId} already has SMTP receipt (${email.etherealMessageId}). Marking SENT.`);
        await prisma.email.update({
          where: { id: emailId },
          data: { status: 'SENT', sentAt: email.sentAt || new Date() },
        });
        return;
      }

      // 2c. Stuck PROCESSING recovery: if email is PROCESSING for > 15 seconds, process it
      if (email.status === 'PROCESSING') {
        const stuckDuration = Date.now() - new Date(email.updatedAt).getTime();
        if (stuckDuration > 15000) {
          console.log(`[Worker] Email ${emailId} stuck in PROCESSING for ${Math.round(stuckDuration / 1000)}s. Resuming execution.`);
        } else {
          console.log(`[Worker] Email ${emailId} is PROCESSING (${Math.round(stuckDuration / 1000)}s). Skipping.`);
          return;
        }
      }

      // 3. Atomic State Claim (Concurrency & Race Condition Guard)
      const claimResult = await prisma.email.updateMany({
        where: {
          id: emailId,
          status: { in: ['SCHEDULED', 'FAILED', 'PROCESSING'] },
        },
        data: {
          status: 'PROCESSING',
          attempts: { increment: 1 },
        },
      });

      if (claimResult.count === 0) {
        console.log(`[Worker] Email ${emailId} was already claimed or processed by another worker. Skipping.`);
        return;
      }

      const senderId = email.senderId;
      const hourlyLimit = email.sender?.hourlyLimit ?? config.maxEmailsPerHourPerSender;

      // 4. Per-Sender Throttling Check (Minimum delay between emails)
      const throttleCheck = await RateLimiterService.checkAndSetSenderDelayLock(senderId, config.minEmailDelayMs);
      if (!throttleCheck.allowed) {
        console.log(`[Worker] Sender ${senderId} throttled. Re-queueing job after ${throttleCheck.retryAfterMs}ms.`);
        
        // Re-set DB status back to SCHEDULED
        await prisma.email.update({
          where: { id: emailId },
          data: { status: 'SCHEDULED' },
        });

        await addEmailToQueue(emailId, throttleCheck.retryAfterMs, `throttle-${emailId}`);
        return;
      }

      // 5. Hourly Rate Limit Enforcement & Intelligent Rescheduling
      const rateLimitCheck = await RateLimiterService.checkAndConsumeRateLimit(senderId, hourlyLimit);

      if (!rateLimitCheck.allowed) {
        const nextWindowMs = rateLimitCheck.nextWindowStart.getTime();
        const delayUntilNextWindow = Math.max(1000, nextWindowMs - Date.now());

        console.log(
          `[Worker Rate Limit] Hourly limit of ${hourlyLimit} reached for sender ${senderId}. ` +
          `Rescheduling email ${emailId} to next window: ${rateLimitCheck.nextWindowStart.toISOString()} (in ${Math.round(delayUntilNextWindow / 1000)}s)`
        );

        // Update DB record with new scheduledAt and status SCHEDULED
        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'SCHEDULED',
            scheduledAt: rateLimitCheck.nextWindowStart,
          },
        });

        await addEmailToQueue(emailId, delayUntilNextWindow, `ratelimit-${emailId}`);
        return;
      }

      // 6. SMTP Email Delivery via Ethereal with timeout
      try {
        const smtpPromise = sendEmailViaSMTP({
          senderEmail: email.sender.email,
          senderName: email.sender.displayName,
          recipient: email.recipient,
          subject: email.subject,
          body: email.body,
          smtpHost: email.sender.smtpHost,
          smtpPort: email.sender.smtpPort,
          smtpUser: email.sender.smtpUser,
          smtpPass: email.sender.smtpPass,
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('SMTP timeout after 15s')), 15000)
        );

        const smtpResult = await Promise.race([smtpPromise, timeoutPromise]);

        // 7. Success State Persistence
        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            etherealMessageId: smtpResult.messageId,
            etherealPreviewUrl: smtpResult.previewUrl,
            errorMessage: null,
          },
        });

        console.log(`[Worker Success] Email ${emailId} successfully sent to ${email.recipient}!`);

        // Check if Campaign is fully completed or failed
        const pendingCount = await prisma.email.count({
          where: {
            campaignId: email.campaignId,
            status: { in: ['SCHEDULED', 'PROCESSING'] },
          },
        });

        if (pendingCount === 0) {
          // Check if any emails in this campaign are SENT (success) vs all FAILED
          const sentCount = await prisma.email.count({
            where: {
              campaignId: email.campaignId,
              status: 'SENT',
            },
          });

          const campaignStatus = sentCount > 0 ? 'COMPLETED' : 'FAILED';

          await prisma.campaign.update({
            where: { id: email.campaignId },
            data: { status: campaignStatus },
          });
          console.log(`[Campaign ${campaignStatus}] All emails for campaign ${email.campaignId} finished. (${sentCount} sent)`);
        }
      } catch (err: any) {
        console.error(`[Worker Failure] Failed sending email ${emailId}: ${err.message}`);

        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'FAILED',
            errorMessage: err.message || 'SMTP delivery failure',
          },
        });

        // After this failure, check if all campaign emails are done (no more SCHEDULED/PROCESSING)
        const pendingCount = await prisma.email.count({
          where: {
            campaignId: email.campaignId,
            status: { in: ['SCHEDULED', 'PROCESSING'] },
          },
        });

        if (pendingCount === 0) {
          const sentCount = await prisma.email.count({
            where: { campaignId: email.campaignId, status: 'SENT' },
          });
          const campaignStatus = sentCount > 0 ? 'COMPLETED' : 'FAILED';
          await prisma.campaign.update({
            where: { id: email.campaignId },
            data: { status: campaignStatus },
          });
          console.log(`[Campaign ${campaignStatus}] All emails for campaign ${email.campaignId} finished.`);
        }

        throw err; // Allow BullMQ attempt retry strategy if configured
      }
    },
    {
      connection: redisWorker,
      concurrency: 1,
      lockDuration: 60000,
      stalledInterval: 30000,
      maxStalledCount: 3,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed with error: ${err.message}`);
  });

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed successfully.`);
  });

  return worker;
};
