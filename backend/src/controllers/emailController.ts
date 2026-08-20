import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { EmailSchedulingService } from '../services/emailSchedulingService';
import { prisma } from '../db/prisma';

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

      const { senderId, subject, body, recipients, startTime, delayBetweenEmailsMs, hourlyLimit } = req.body;

      if (!senderId || !subject || !body || !Array.isArray(recipients) || recipients.length === 0) {
        res.status(400).json({ error: 'Missing required parameters: senderId, subject, body, recipients array' });
        return;
      }

      const result = await EmailSchedulingService.scheduleCampaign({
        userId,
        senderId,
        subject,
        body,
        recipients,
        startTime,
        delayBetweenEmailsMs: delayBetweenEmailsMs ? parseInt(delayBetweenEmailsMs, 10) : undefined,
        hourlyLimit: hourlyLimit ? parseInt(hourlyLimit, 10) : undefined,
      });

      res.status(201).json({
        message: 'Email campaign scheduled successfully',
        data: result,
      });
    } catch (err: any) {
      console.error('[Schedule API Error]', err.message);
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * List scheduled/processing emails
   */
  public static async getScheduledEmails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '50', 10);
      const skip = (page - 1) * limit;

      const [emails, total] = await Promise.all([
        prisma.email.findMany({
          where: {
            status: { in: ['SCHEDULED', 'PROCESSING'] },
          },
          include: {
            sender: { select: { id: true, email: true, displayName: true } },
            campaign: { select: { id: true, subject: true } },
          },
          orderBy: { scheduledAt: 'asc' },
          skip,
          take: limit,
        }),
        prisma.email.count({
          where: { status: { in: ['SCHEDULED', 'PROCESSING'] } },
        }),
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
   * List sent/failed emails
   */
  public static async getSentEmails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '50', 10);
      const skip = (page - 1) * limit;

      const [emails, total] = await Promise.all([
        prisma.email.findMany({
          where: {
            status: { in: ['SENT', 'FAILED'] },
          },
          include: {
            sender: { select: { id: true, email: true, displayName: true } },
            campaign: { select: { id: true, subject: true } },
          },
          orderBy: { sentAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.email.count({
          where: { status: { in: ['SENT', 'FAILED'] } },
        }),
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
      const { id } = req.params;
      const email = await prisma.email.findUnique({
        where: { id },
        include: { sender: true, campaign: true },
      });

      if (!email) {
        res.status(404).json({ error: 'Email record not found' });
        return;
      }

      res.json({ email });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
