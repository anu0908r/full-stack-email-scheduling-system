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

    if (sender.userId !== null && sender.userId !== params.userId) {
      throw new Error(`Sender with ID ${params.senderId} does not belong to this user.`);
    }

    const startTime = params.startTime ? new Date(params.startTime) : new Date();
    if (isNaN(startTime.getTime())) {
      throw new Error('Invalid startTime format. Use ISO 8601 datetime.');
    }

    const startMs = Math.max(startTime.getTime(), Date.now());
    const delayBetweenMs = params.delayBetweenEmailsMs != null
      ? Math.max(config.minEmailDelayMs, params.delayBetweenEmailsMs)
      : config.minEmailDelayMs;
    const hourlyLimit = params.hourlyLimit ?? sender.hourlyLimit ?? config.maxEmailsPerHourPerSender;

    const now = Date.now();
    const createdEmails: Array<{ id: string; recipient: string; scheduledAt: Date; bullJobId: string }> = [];
    let currentScheduleMs = startMs;
    let countInCurrentHourWindow = 0;

    // Use UTC hour window to match rate limiter Redis keys
    const startDate = new Date(startMs);
    const windowStartMs = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), startDate.getUTCHours(), 0, 0, 0);
    let currentWindowStartMs = windowStartMs;

    // Build email records in memory first, then batch insert
    const emailRecords: Array<{
      campaignId: string;
      senderId: string;
      recipient: string;
      subject: string;
      body: string;
      scheduledAt: Date;
      status: string;
      idempotencyKey: string;
    }> = [];

    for (let i = 0; i < validRecipients.length; i++) {
      const recipient = validRecipients[i];

      countInCurrentHourWindow++;
      if (countInCurrentHourWindow > hourlyLimit) {
        currentWindowStartMs += 3600 * 1000;
        currentScheduleMs = Math.max(currentScheduleMs, currentWindowStartMs);
        countInCurrentHourWindow = 1;
      }

      const scheduledAt = new Date(currentScheduleMs);

      const idempotencyKey = crypto
        .createHash('sha256')
        .update(`${params.userId}:${params.senderId}:${recipient}:${scheduledAt.toISOString()}`)
        .digest('hex');

      emailRecords.push({
        campaignId: '', // placeholder — set after campaign creation
        senderId: sender.id,
        recipient,
        subject: params.subject,
        body: params.body,
        scheduledAt,
        status: 'SCHEDULED',
        idempotencyKey,
      });

      currentScheduleMs += delayBetweenMs;
    }

    // Create campaign and all emails in a single transaction
    const campaign = await prisma.$transaction(async (tx) => {
      const camp = await tx.campaign.create({
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

      // Set campaignId on all email records
      for (const record of emailRecords) {
        record.campaignId = camp.id;
      }

      // Batch insert all emails at once
      await tx.email.createMany({ data: emailRecords });

      return camp;
    });

    // Fetch the created emails to get their IDs (needed for BullMQ job IDs)
    const createdEmailRows = await prisma.email.findMany({
      where: { campaignId: campaign.id },
      orderBy: { scheduledAt: 'asc' },
    });

    // Add BullMQ delayed jobs (cannot batch — BullMQ requires per-job add)
    for (const emailRow of createdEmailRows) {
      const delayForBullMQ = Math.max(0, emailRow.scheduledAt.getTime() - now);
      const bullJobId = await addEmailToQueue(emailRow.id, delayForBullMQ);

      await prisma.email.update({
        where: { id: emailRow.id },
        data: { bullJobId },
      });

      createdEmails.push({ id: emailRow.id, recipient: emailRow.recipient, scheduledAt: emailRow.scheduledAt, bullJobId });
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
