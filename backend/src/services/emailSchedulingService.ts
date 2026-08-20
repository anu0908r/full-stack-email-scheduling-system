import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { addEmailToQueue } from '../queues/emailQueue';
import { config } from '../config';

export interface ScheduleCampaignParams {
  userId: string;
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime?: string | Date;
  delayBetweenEmailsMs?: number;
  hourlyLimit?: number;
}

export class EmailSchedulingService {
  /**
   * Validates and sanitizes email address list.
   */
  public static parseAndValidateRecipients(recipients: string[]): { valid: string[]; invalid: string[] } {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validSet = new Set<string>();
    const invalidSet = new Set<string>();

    for (const raw of recipients) {
      const email = raw.trim().toLowerCase();
      if (!email) continue;
      if (emailRegex.test(email)) {
        validSet.add(email);
      } else {
        invalidSet.add(raw);
      }
    }

    return {
      valid: Array.from(validSet),
      invalid: Array.from(invalidSet),
    };
  }

  /**
   * Core Campaign & Email Batch Scheduling
   */
  public static async scheduleCampaign(params: ScheduleCampaignParams) {
    const { valid: validRecipients, invalid: invalidRecipients } = this.parseAndValidateRecipients(params.recipients);

    if (validRecipients.length === 0) {
      throw new Error('No valid email recipients provided.');
    }

    const sender = await prisma.sender.findUnique({ where: { id: params.senderId } });
    if (!sender) {
      throw new Error(`Sender with ID ${params.senderId} not found.`);
    }

    const startTime = params.startTime ? new Date(params.startTime) : new Date();
    const startMs = Math.max(startTime.getTime(), Date.now());
    const delayBetweenMs = params.delayBetweenEmailsMs ?? sender.hourlyLimit ? Math.max(config.minEmailDelayMs, params.delayBetweenEmailsMs || 2000) : config.minEmailDelayMs;
    const hourlyLimit = params.hourlyLimit ?? sender.hourlyLimit ?? config.maxEmailsPerHourPerSender;

    // Create Campaign DB Record
    const campaign = await prisma.campaign.create({
      data: {
        userId: params.userId,
        subject: params.subject,
        body: params.body,
        startTime: new Date(startMs),
        delayBetweenEmailsMs: delayBetweenMs,
        hourlyLimit: hourlyLimit,
        status: 'SCHEDULED',
      },
    });

    const now = Date.now();
    const createdEmails = [];
    let currentScheduleMs = startMs;
    let countInCurrentHourWindow = 0;
    let windowStartMs = new Date(startMs).setMinutes(0, 0, 0);

    for (let i = 0; i < validRecipients.length; i++) {
      const recipient = validRecipients[i];

      // Check hourly limit window distribution for large batches
      countInCurrentHourWindow++;
      if (countInCurrentHourWindow > hourlyLimit) {
        // Bump schedule to next hour window
        windowStartMs += 3600 * 1000;
        currentScheduleMs = Math.max(currentScheduleMs, windowStartMs);
        countInCurrentHourWindow = 1;
      }

      const scheduledAt = new Date(currentScheduleMs);

      // Generate deterministic idempotency key
      const idempotencyKey = crypto
        .createHash('sha256')
        .update(`${campaign.id}:${recipient}:${scheduledAt.toISOString()}`)
        .digest('hex');

      // DB Persistent Email Record
      const email = await prisma.email.create({
        data: {
          campaignId: campaign.id,
          senderId: sender.id,
          recipient,
          subject: params.subject,
          body: params.body,
          scheduledAt,
          status: 'SCHEDULED',
          idempotencyKey,
        },
      });

      // Calculate BullMQ delay relative to current server time
      const delayForBullMQ = Math.max(0, scheduledAt.getTime() - now);

      // Add Delayed Job to BullMQ
      const bullJobId = await addEmailToQueue(email.id, delayForBullMQ);

      // Update bullJobId in DB
      await prisma.email.update({
        where: { id: email.id },
        data: { bullJobId },
      });

      createdEmails.push({ ...email, bullJobId });

      // Increment schedule timestamp for next recipient
      currentScheduleMs += delayBetweenMs;
    }

    return {
      campaign,
      recipientCount: validRecipients.length,
      invalidCount: invalidRecipients.length,
      invalidRecipients,
      scheduledEmails: createdEmails.length,
    };
  }
}
