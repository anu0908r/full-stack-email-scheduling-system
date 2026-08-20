import { Worker, Job } from 'bullmq';
import { redisConnection } from '../db/redis';
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

      // 3. Atomic State Claim (Concurrency & Race Condition Guard)
      const claimResult = await prisma.email.updateMany({
        where: {
          id: emailId,
          status: { in: ['SCHEDULED', 'FAILED'] },
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
      const hourlyLimit = email.sender?.hourlyLimit || config.maxEmailsPerHourPerSender;

      // 4. Per-Sender Throttling Check (Minimum delay between emails)
      const throttleCheck = await RateLimiterService.checkAndSetSenderDelayLock(senderId, config.minEmailDelayMs);
      if (!throttleCheck.allowed) {
        console.log(`[Worker] Sender ${senderId} throttled. Re-queueing job after ${throttleCheck.retryAfterMs}ms.`);
        
        // Re-set DB status back to SCHEDULED
        await prisma.email.update({
          where: { id: emailId },
          data: { status: 'SCHEDULED' },
        });

        // Re-add job to BullMQ with delay
        await addEmailToQueue(emailId, throttleCheck.retryAfterMs);
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

        // Re-enqueue delayed job for next window
        await addEmailToQueue(emailId, delayUntilNextWindow);
        return;
      }

      // 6. SMTP Email Delivery via Ethereal
      try {
        const smtpResult = await sendEmailViaSMTP({
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

        // Check if Campaign is fully completed
        const pendingCount = await prisma.email.count({
          where: {
            campaignId: email.campaignId,
            status: { in: ['SCHEDULED', 'PROCESSING'] },
          },
        });

        if (pendingCount === 0) {
          await prisma.campaign.update({
            where: { id: email.campaignId },
            data: { status: 'COMPLETED' },
          });
          console.log(`[Campaign Completed] All emails for campaign ${email.campaignId} finished.`);
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

        throw err; // Allow BullMQ attempt retry strategy if configured
      }
    },
    {
      connection: redisConnection,
      concurrency: config.workerConcurrency,
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
