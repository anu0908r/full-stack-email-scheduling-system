import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { prisma } from '../db/prisma';
import { config } from '../config';
import { createSenderSchema } from './emailController';

export class SenderController {
  public static async listSenders(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User unauthorized' });
        return;
      }

      let senders = await prisma.sender.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      if (senders.length === 0) {
        const defaultSender = await prisma.sender.create({
          data: {
            userId,
            email: 'outreach@reachinbox.ai',
            displayName: 'ReachInbox Primary Sender',
            hourlyLimit: config.maxEmailsPerHourPerSender,
          },
        });
        senders = [defaultSender];
      }

      res.json({ senders });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async createSender(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User unauthorized' });
        return;
      }

      const parsed = createSenderSchema.safeParse(req.body);
      if (!parsed.success) {
        const errors = parsed.error.issues.map((i) => i.message).join('; ');
        res.status(400).json({ error: `Validation failed: ${errors}` });
        return;
      }

      const { email, displayName, hourlyLimit, smtpHost, smtpPort, smtpUser, smtpPass } = parsed.data;

      const sender = await prisma.sender.create({
        data: {
          userId,
          email: email.trim().toLowerCase(),
          displayName,
          hourlyLimit: hourlyLimit ?? config.maxEmailsPerHourPerSender,
          smtpHost: smtpHost || null,
          smtpPort: smtpPort ?? null,
          smtpUser: smtpUser || null,
          smtpPass: smtpPass || null,
        },
      });

      res.status(201).json({ sender });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async deleteSender(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User unauthorized' });
        return;
      }

      const { id } = req.params;

      const sender = await prisma.sender.findUnique({ where: { id } });
      if (!sender) {
        res.status(404).json({ error: 'Sender not found.' });
        return;
      }

      if (sender.userId !== userId) {
        res.status(403).json({ error: 'Access denied.' });
        return;
      }

      const activeEmails = await prisma.email.count({
        where: { senderId: id, status: { in: ['SCHEDULED', 'PROCESSING'] } },
      });

      if (activeEmails > 0) {
        res.status(400).json({ error: `Cannot delete sender with ${activeEmails} active email(s). Wait for them to complete or fail.` });
        return;
      }

      await prisma.sender.delete({ where: { id } });
      res.json({ message: 'Sender deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
