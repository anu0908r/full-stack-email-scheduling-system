import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/authMiddleware';
import { EmailSchedulingService } from '../services/emailSchedulingService';
import { prisma } from '../db/prisma';
import { emailQueue } from '../queues/emailQueue';

const scheduleEmailsSchema = z.object({
  senderId: z.string().min(1, 'senderId is required'),
  subject: z.string().min(1, 'Subject is required').max(200),
  body: z.string().min(1, 'Body is required'),
  recipients: z.array(z.string().min(1)).min(1, 'At least one recipient is required').max(5000, 'Maximum 5000 recipients per campaign'),
  startTime: z.string().datetime({ message: 'startTime must be a valid ISO 8601 datetime' }).optional(),
  delayBetweenEmailsMs: z.coerce.number().int().positive().max(3600000, 'Maximum delay is 1 hour').optional(),
  hourlyLimit: z.coerce.number().int().positive().max(10000).optional(),
});

const createSenderSchema = z.object({
  email: z.string().email('Invalid email format'),
  displayName: z.string().min(1, 'Display name is required').max(100),
  hourlyLimit: z.coerce.number().int().positive().max(10000).optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().int().positive().max(65535).optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
});

export class EmailController {
  /**
   * Schedule new email batch
   */
  public static async scheduleEmails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User unauthorized' });
        return;
      }

      const parsed = scheduleEmailsSchema.safeParse(req.body);
      if (!parsed.success) {
        const errors = parsed.error.issues.map((i) => i.message).join('; ');
        res.status(400).json({ error: `Validation failed: ${errors}` });
        return;
      }

      const { senderId, subject, body, recipients, startTime, delayBetweenEmailsMs, hourlyLimit } = parsed.data;

      const result = await EmailSchedulingService.scheduleCampaign({
        userId,
        senderId,
        subject,
        body,
        recipients,
        startTime,
        delayBetweenEmailsMs,
        hourlyLimit,
      });

      res.status(201).json({
        message: 'Email campaign scheduled successfully',
        data: result,
      });
    } catch (err: any) {
      console.error('[Schedule API Error]', err.message);
      const isClientError = err.message.includes('not found') ||
        err.message.includes('does not belong') ||
        err.message.includes('No valid email') ||
        err.message.includes('Invalid startTime');
      res.status(isClientError ? 400 : 500).json({ error: err.message });
    }
  }

  /**
   * List scheduled/processing emails (filtered by authenticated user)
   */
  public static async getScheduledEmails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User unauthorized' });
        return;
      }

      const page = Math.max(1, parseInt(req.query.page as string || '1', 10) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string || '50', 10) || 50));
      const skip = (page - 1) * limit;

      const scheduledStatuses = ['SCHEDULED', 'PROCESSING'];
      const whereClause = {
        status: { in: scheduledStatuses },
        campaign: { userId },
      };

      const [emails, total] = await Promise.all([
        prisma.email.findMany({
          where: whereClause,
          include: {
            sender: { select: { id: true, email: true, displayName: true } },
            campaign: { select: { id: true, subject: true } },
          },
          orderBy: { scheduledAt: 'asc' },
          skip,
          take: limit,
        }),
        prisma.email.count({ where: whereClause }),
      ]);

      res.json({
        emails,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * List sent/failed emails (filtered by authenticated user)
   */
  public static async getSentEmails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User unauthorized' });
        return;
      }

      const page = Math.max(1, parseInt(req.query.page as string || '1', 10) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string || '50', 10) || 50));
      const skip = (page - 1) * limit;

      const sentStatuses = ['SENT', 'FAILED'];
      const whereClause = {
        status: { in: sentStatuses },
        campaign: { userId },
      };

      const [emails, total] = await Promise.all([
        prisma.email.findMany({
          where: whereClause,
          include: {
            sender: { select: { id: true, email: true, displayName: true } },
            campaign: { select: { id: true, subject: true } },
          },
          orderBy: { sentAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.email.count({ where: whereClause }),
      ]);

      res.json({
        emails,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Get email details by ID
   */
  public static async getEmailById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User unauthorized' });
        return;
      }

      const { id } = req.params;
      const email = await prisma.email.findUnique({
        where: { id },
        include: { sender: true, campaign: true },
      });

      if (!email) {
        res.status(404).json({ error: 'Email record not found' });
        return;
      }

      if (email.campaign.userId !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      res.json({ email });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Delete a single email record by ID
   */
  public static async deleteEmailById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User unauthorized' });
        return;
      }

      const { id } = req.params;
      const email = await prisma.email.findUnique({
        where: { id },
        include: { campaign: true },
      });

      if (!email) {
        res.status(404).json({ error: 'Email record not found' });
        return;
      }

      if (email.campaign.userId !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // If scheduled with a BullMQ job, attempt to remove job from queue
      if (email.bullJobId) {
        try {
          const job = await emailQueue.getJob(email.bullJobId);
          if (job) await job.remove();
        } catch {
          // Ignore if job completed or already removed
        }
      }

      await prisma.email.delete({ where: { id } });

      res.json({ message: 'Email deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Clear emails by category ('scheduled', 'sent', 'all') for the logged in user
   */
  public static async clearEmailsByCategory(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User unauthorized' });
        return;
      }

      const category = (req.params.category || '').toLowerCase();
      let statusFilter: string[] = [];

      if (category === 'scheduled') {
        statusFilter = ['SCHEDULED', 'PROCESSING'];
      } else if (category === 'sent') {
        statusFilter = ['SENT', 'FAILED'];
      } else if (category === 'all') {
        statusFilter = ['SCHEDULED', 'PROCESSING', 'SENT', 'FAILED'];
      } else {
        res.status(400).json({ error: "Invalid category. Must be 'scheduled', 'sent', or 'all'." });
        return;
      }

      // Fetch emails to remove BullMQ jobs if scheduled
      const emailsToDelete = await prisma.email.findMany({
        where: {
          status: { in: statusFilter },
          campaign: { userId },
        },
        select: { id: true, bullJobId: true },
      });

      // Remove jobs from queue
      for (const email of emailsToDelete) {
        if (email.bullJobId) {
          try {
            const job = await emailQueue.getJob(email.bullJobId);
            if (job) await job.remove();
          } catch {
            // Ignore
          }
        }
      }

      const deleted = await prisma.email.deleteMany({
        where: {
          id: { in: emailsToDelete.map((e) => e.id) },
        },
      });

      res.json({ message: `Successfully deleted ${deleted.count} email records.`, count: deleted.count });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}

export { createSenderSchema };
